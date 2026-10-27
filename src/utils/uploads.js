/**
 * Supabase Storage for the Client module.
 *
 * Path layout (also enforced by the RLS policy in supabase/clients.sql):
 *   client-documents / clients / {userId} / {clientId} / {docId}.{ext}
 *   client-pdfs       / clients / {userId} / {clientId} / document.pdf
 */

import { supabase } from '../lib/supabase.js';

export const DOCUMENTS_BUCKET = 'client-documents';
export const PDFS_BUCKET = 'client-pdfs';

export const DOCUMENT_TYPES = [
  { id: 'visa', label: 'Visa', accept: 'application/pdf', optional: true },
  { id: 'passport', label: 'Passport' },
  { id: 'photo', label: 'Personal Photo' },
  { id: 'other', label: 'Other Document', multiple: true, accept: 'application/pdf' },
];

export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,application/pdf';
export const OTHER_DOCUMENT_ACCEPT = 'application/pdf';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Old clients stored a single `id` file. Fold it into the `other` list so
 * nothing uploaded before disappears, and always hand back an array.
 */
export function normalizeDocuments(documents) {
  const docs = { ...(documents || {}) };
  const legacyId = docs.id;
  delete docs.id;
  const list = Array.isArray(docs.other)
    ? docs.other.filter(Boolean)
    : docs.other
      ? [docs.other]
      : [];
  const withLegacy = legacyId ? [...list, legacyId] : list;
  docs.other = withLegacy.map((meta) => ({
    ...meta,
    key: meta.key || meta.path || `k-${Math.random().toString(36).slice(2, 10)}`,
  }));
  return docs;
}

const SIGN_TTL = 60 * 60;

export function visaVisibility(canVisa, meta, published) {
  const hasMeta = Boolean(meta && meta.path);
  const released = hasMeta && Boolean(published);
  return {
    show: Boolean(canVisa) || released,
    canDownload: hasMeta && (Boolean(canVisa) || Boolean(published)),
    canUpload: Boolean(canVisa),
    canPublish: Boolean(canVisa) && hasMeta && !published,
    published: Boolean(published),
  };
}


export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

function extensionOf(file) {
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name || '');
  if (fromName) return fromName[1].toLowerCase();
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

function documentPath(userId, clientId, docId, file, key) {
  const suffix = key ? `-${key}` : '';
  return `clients/${userId}/${clientId}/${docId}${suffix}.${extensionOf(file)}`;
}

export function describeFile(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export async function uploadClientDocument(userId, clientId, docId, file, key) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is larger than 10 MB.');
  }
  const path = documentPath(userId, clientId, docId, file, key);
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return { path, key, ...describeFile(file) };
}

export async function removeClientDocument(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw error;
}

async function signedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGN_TTL);
  if (error) throw error;
  return data?.signedUrl || null;
}

export function documentUrl(path) {
  return signedUrl(DOCUMENTS_BUCKET, path);
}

export function pdfUrl(path) {
  return signedUrl(PDFS_BUCKET, path);
}

export async function documentBytes(path) {
  const url = await documentUrl(path);
  if (!url) throw new Error('File not found.');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Unable to read the uploaded file.');
  return {
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') || '',
  };
}

export async function uploadClientPdf(userId, clientId, bytes, filename) {
  const path = `clients/${userId}/${clientId}/document.pdf`;
  const { error } = await supabase.storage
    .from(PDFS_BUCKET)
    .upload(path, bytes, {
      upsert: true,
      contentType: 'application/pdf',
      duplex: 'half',
    });
  if (error) throw error;
  void filename;
  return path;
}

export async function removeClientFiles(clientId) {
  const userId = await currentUserId();
  if (!userId || !clientId) return;
  const prefix = `${userId}/${clientId}/`;
  for (const bucket of [DOCUMENTS_BUCKET, PDFS_BUCKET]) {
    const { data } = await supabase.storage.from(bucket).list(`${prefix}`);
    const files = (data || []).map((f) => `${prefix}${f.name}`);
    if (files.length) await supabase.storage.from(bucket).remove(files);
  }
}
