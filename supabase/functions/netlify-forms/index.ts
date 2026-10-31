// AL BALQAN — Netlify Forms proxy (Supabase Edge Function).
// The Netlify token lives ONLY here (secret NETLIFY_TOKEN).
//
// POST /  { "action": "submissions" }  -> sync all submissions into public.consultation_requests
//        (skips tombstoned ids, dedupes content-identical double-fires,
//         and auto-heals duplicates already in the table)
// POST /  { "action": "forms" }        -> return the consultation form definition (fields)
// POST /  { "action": "delete", "submission_id": "..." }
//        -> tombstone the id, delete the submission on Netlify Forms AND its row
// GET  /?action=submissions|forms      -> same actions via query string
//
// Two ways in:
//   * a signed-in user (Authorization: Bearer <user jwt>) — the app's
//     "Sync from Netlify Forms" button and its periodic re-sync;
//   * the scheduler (header x-sync-secret: <NETLIFY_SYNC_SECRET>) — a
//     pg_cron/pg_net job that keeps the table fresh with nobody logged in;
//     imported rows are owned by NETLIFY_SYNC_USER_ID so RLS still applies.
// Either way, freshly imported rows raise a bell notification for every
// active user who holds the consultations page (notify_new_consultations).
//
// Deploy:
//   supabase functions deploy netlify-forms
//   supabase secrets set NETLIFY_TOKEN=<personal access token>
//   supabase secrets set NETLIFY_SYNC_SECRET=<random>
//   supabase secrets set NETLIFY_SYNC_USER_ID=<admin uuid>
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const NETLIFY_TOKEN = Deno.env.get('NETLIFY_TOKEN') ?? '';
const NETLIFY_SITE_ID =
  Deno.env.get('NETLIFY_SITE_ID') ?? 'c62355e1-108a-4b41-bc0d-6e5a6acda6ed';

// Scheduled server-to-server sync (pg_cron + pg_net): the caller proves
// itself with a shared secret instead of a user JWT. New rows then belong
// to the standing admin so RLS keeps them visible in the app.
const SYNC_SECRET = Deno.env.get('NETLIFY_SYNC_SECRET') ?? '';
const SYNC_USER_ID = Deno.env.get('NETLIFY_SYNC_USER_ID') ?? '';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const FORM_NAME = 'consultation';
const MAX_PAGES = 500;
const UPSERT_CHUNK = 50;

const KNOWN_COLUMNS = [
  'full_name',
  'email',
  'phone',
  'nationality',
  'country',
  'residence',
  'service',
  'details',
];

function normalizeKey(key: string): string {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const COLUMN_BY_NORM: Record<string, string> = {};
for (const column of KNOWN_COLUMNS) {
  COLUMN_BY_NORM[normalizeKey(column)] = column;
}

// Alternative field names seen on real forms -> our columns.
const ALIASES: Record<string, string> = {
  name: 'full_name',
  yourname: 'full_name',
  customername: 'full_name',
  fullnamelegalname: 'full_name',
  contactname: 'full_name',
  emailaddress: 'email',
  mail: 'email',
  emailid: 'email',
  phonenumber: 'phone',
  mobile: 'phone',
  mobilenumber: 'phone',
  whatsapp: 'phone',
  contactnumber: 'phone',
  tel: 'phone',
  destination: 'country',
  countryofdestination: 'country',
  targetcountry: 'country',
  preferredcountry: 'country',
  countryofresidence: 'residence',
  currentresidence: 'residence',
  currentcountry: 'residence',
  livingin: 'residence',
  residencecountry: 'residence',
  servicetype: 'service',
  pathway: 'service',
  interestedservice: 'service',
  serviceofinterest: 'service',
  message: 'details',
  detailsmessage: 'details',
  additionalinformation: 'details',
  additionaldetails: 'details',
  tellus: 'details',
  notes: 'details',
  agree: 'consent',
  agreement: 'consent',
  checkbox: 'consent',
  privacyconsent: 'consent',
  consentgiven: 'consent',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function parseNextLink(linkHeader: string): string | null {
  for (const part of linkHeader.split(',')) {
    if (!/rel="next"/.test(part)) continue;
    const match = part.match(/<([^>]+)>/);
    if (match) return match[1];
  }
  return null;
}

async function netlifyGet(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* body unavailable */
    }
    const hint =
      res.status === 401 || res.status === 403
        ? 'netlify token rejected'
        : res.status === 404
          ? 'site or endpoint not found'
          : '';
    throw new Error(`netlify_${res.status} ${hint} ${detail}`.trim());
  }
  return res;
}

function textOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function booleanOf(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase().trim();
  if (['true', 'yes', 'on', '1', 'y', 'i agree', 'agree'].includes(text)) return true;
  if (['false', 'no', 'off', '0', 'n'].includes(text)) return false;
  return null;
}

function timestampOf(value: unknown): string | undefined {
  const text = textOf(value);
  if (!text) return undefined;
  return Number.isNaN(Date.parse(text)) ? undefined : new Date(text).toISOString();
}

// Two submissions with identical content within this window are the same
// request (the website form can double-fire); anything further apart is a
// genuine re-contact and stays.
const DUPLICATE_WINDOW_MS = 72 * 60 * 60 * 1000;

function fingerprint(fields: Record<string, unknown>): string {
  return [
    textOf(fields.full_name) ?? '',
    textOf(fields.phone) ?? '',
    textOf(fields.email) ?? '',
    textOf(fields.service) ?? '',
    textOf(fields.country) ?? '',
    (textOf(fields.details) ?? '').slice(0, 300),
  ]
    .map((part) => part.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');
}

function timeOf(value: unknown): number {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Best-effort removal on Netlify; true when the submission is gone. */
async function deleteOnNetlify(submissionId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${NETLIFY_API}/sites/${NETLIFY_SITE_ID}/submissions/${encodeURIComponent(submissionId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } },
    );
    return res.ok || res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

async function tombstone(db: ReturnType<typeof createClient>, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const { error } = await db
    .from('consultation_deleted')
    .upsert(unique.map((netlify_id) => ({ netlify_id })));
  if (error) throw new Error(`db_tombstone: ${error.message}`);
}

function buildRow(submission: Record<string, unknown>) {
  const rawData =
    submission && typeof submission.data === 'object' && submission.data !== null
      ? (submission.data as Record<string, unknown>)
      : {};

  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawData)) {
    const normalized = normalizeKey(key);
    if (!normalized) continue;
    const column = COLUMN_BY_NORM[normalized] ?? ALIASES[normalized];
    if (!column || mapped[column] !== undefined) continue;
    mapped[column] = value;
  }

  const row: Record<string, unknown> = {
    netlify_id: String(submission.id ?? ''),
    form_name: textOf(submission.form_name) ?? FORM_NAME,
    full_name: textOf(mapped.full_name),
    email: textOf(mapped.email),
    phone: textOf(mapped.phone),
    nationality: textOf(mapped.nationality),
    country: textOf(mapped.country),
    residence: textOf(mapped.residence),
    service: textOf(mapped.service),
    details: textOf(mapped.details),
    consent: booleanOf(mapped.consent),
    submitted_at: timestampOf(submission.created_at),
    raw_data: rawData,
  };
  if (!row.netlify_id) return null;
  return row;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const syncSecret = req.headers.get('x-sync-secret') ?? '';

    let db: ReturnType<typeof createClient>;
    if (SYNC_SECRET && syncSecret !== '' && syncSecret === SYNC_SECRET) {
      // Cron path: no user, service role — rows are owned by SYNC_USER_ID.
      db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
    } else {
      if (!authHeader) return json({ error: 'auth_required' }, 401);
      db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError || !userData?.user) return json({ error: 'auth_invalid' }, 401);
    }

    let action = 'submissions';
    let payload: { action?: unknown; submission_id?: unknown } | null = null;
    if (req.method === 'GET') {
      action = new URL(req.url).searchParams.get('action') ?? 'submissions';
    } else {
      try {
        payload = (await req.json()) as { action?: unknown; submission_id?: unknown } | null;
        if (payload && typeof payload.action === 'string') action = payload.action;
      } catch {
        /* empty body -> default action */
      }
    }

    if (!NETLIFY_TOKEN) {
      return json(
        { error: 'netlify_token_missing', hint: 'supabase secrets set NETLIFY_TOKEN=...' },
        500,
      );
    }

    if (action === 'delete') {
      const submissionId = String(payload?.submission_id ?? '').trim();
      if (!submissionId) {
        return json({ error: 'submission_id_required' }, 400);
      }
      const delRes = await fetch(
        `${NETLIFY_API}/sites/${NETLIFY_SITE_ID}/submissions/${encodeURIComponent(submissionId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } },
      );
      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
        let detail = '';
        try {
          detail = (await delRes.text()).slice(0, 300);
        } catch {
          /* body unavailable */
        }
        return json(
          { error: 'netlify_delete_failed', detail: `netlify_${delRes.status} ${detail}`.trim() },
          502,
        );
      }
      // Tombstone FIRST: even if the row delete below fails, the submission
      // can never be re-imported by a later sync.
      await tombstone(db, [submissionId]);
      const { error: deleteError } = await db
        .from('consultation_requests')
        .delete()
        .eq('netlify_id', submissionId);
      if (deleteError) {
        return json({ error: 'db_delete', detail: deleteError.message }, 502);
      }
      return json({ deleted: submissionId, netlify_gone: delRes.status !== 404 && delRes.status !== 410 });
    }

    const formsRes = await netlifyGet(`${NETLIFY_API}/sites/${NETLIFY_SITE_ID}/forms`);
    const forms = (await formsRes.json()) as Array<Record<string, unknown>> | null;
    const form = Array.isArray(forms)
      ? forms.find((f) => String(f?.name ?? '') === FORM_NAME) ??
        forms.find((f) => String(f?.name ?? '').toLowerCase().includes('consultation')) ??
        null
      : null;

    if (!form) {
      return json({ error: 'form_not_found', form: FORM_NAME }, 404);
    }

    if (action === 'forms') {
      return json({
        form: {
          id: form.id ?? null,
          name: form.name ?? FORM_NAME,
          fields: form.fields ?? [],
        },
      });
    }

    // --- submissions with full pagination (Link rel="next") ---
    let url: string | null = `${NETLIFY_API}/sites/${NETLIFY_SITE_ID}/submissions?per_page=100`;
    const submissions: Array<Record<string, unknown>> = [];
    let pages = 0;
    while (url && pages < MAX_PAGES) {
      const res = await netlifyGet(url);
      const batch = (await res.json()) as unknown;
      if (Array.isArray(batch)) {
        submissions.push(...(batch as Array<Record<string, unknown>>));
      }
      const linkHeader = res.headers.get('Link') ?? res.headers.get('link');
      url = linkHeader ? parseNextLink(linkHeader) : null;
      pages += 1;
    }

    // Tombstoned ids: deleted in the system -> never import again, and
    // best-effort remove the leftover on Netlify (its delete can lag).
    const { data: tombRows, error: tombError } = await db
      .from('consultation_deleted')
      .select('netlify_id');
    if (tombError) throw new Error(`db_tombstones: ${tombError.message}`);
    const deletedSet = new Set((tombRows ?? []).map((r) => String(r.netlify_id)));
    let cleanedLeftovers = 0;
    for (const submission of submissions) {
      const id = String(submission.id ?? '');
      if (id && deletedSet.has(id) && (await deleteOnNetlify(id))) cleanedLeftovers += 1;
    }

    const { data: existingRows, error: selectError } = await db
      .from('consultation_requests')
      .select(
        'id, netlify_id, full_name, phone, email, service, country, details, submitted_at, created_at, status, notes',
      );
    if (selectError) throw new Error(`db_select: ${selectError.message}`);
    const existingRowList = existingRows ?? [];
    const existing = new Set(existingRowList.map((r) => String(r.netlify_id)));

    // Auto-heal duplicates already sitting in the table (created before this
    // guard existed): keep the managed row (annotated, else earliest), drop
    // the rest when they sit within the duplicate window.
    const byFp = new Map<string, Array<Record<string, unknown>>>();
    for (const row of existingRowList) {
      const fp = fingerprint(row);
      const bucket = byFp.get(fp);
      if (bucket) bucket.push(row);
      else byFp.set(fp, [row]);
    }
    const healDropIds: string[] = [];
    for (const bucket of byFp.values()) {
      if (bucket.length < 2) continue;
      const sorted = [...bucket].sort((a, b) => {
        const aManaged = a.status !== 'new' || (textOf(a.notes) ?? '') !== '' ? 1 : 0;
        const bManaged = b.status !== 'new' || (textOf(b.notes) ?? '') !== '' ? 1 : 0;
        if (aManaged !== bManaged) return bManaged - aManaged;
        return timeOf(a.created_at) - timeOf(b.created_at);
      });
      const kept = sorted[0];
      for (const drop of sorted.slice(1)) {
        const gap = Math.abs(timeOf(drop.created_at) - timeOf(kept.created_at));
        if (gap <= DUPLICATE_WINDOW_MS) healDropIds.push(String(drop.netlify_id));
      }
    }
    if (healDropIds.length) {
      await tombstone(db, healDropIds);
      const { error: healError } = await db
        .from('consultation_requests')
        .delete()
        .in('netlify_id', healDropIds);
      if (healError) throw new Error(`db_heal_delete: ${healError.message}`);
      for (const id of healDropIds) existing.delete(id);
    }

    // Import guard: skip tombstoned submissions and content-level duplicates
    // (the same request double-fired by the website — in this batch, or
    // against a row already in the table).
    const cronMode = SYNC_SECRET !== '' && req.headers.get('x-sync-secret') === SYNC_SECRET;
    const seenFp = new Map<string, number>();
    const keepRows: Array<Record<string, unknown>> = [];
    const dupeIds: string[] = [];
    let skippedDeleted = 0;
    for (const submission of submissions) {
      const rawId = String(submission.id ?? '');
      if (rawId && deletedSet.has(rawId)) {
        skippedDeleted += 1;
        continue;
      }
      const row = buildRow(submission);
      if (!row || row.netlify_id === '') continue;
      // The cron path has no signed-in user: own NEW rows to the standing
      // admin so RLS still shows them; rows already in the table keep their
      // owner (a refresh must not steal them).
      if (cronMode && SYNC_USER_ID && !existing.has(String(row.netlify_id))) {
        row.user_id = SYNC_USER_ID;
      }
      const fp = fingerprint(row);
      const at = timeOf(row.submitted_at) || timeOf(submission.created_at) || Date.now();
      const batchAt = seenFp.get(fp);
      const dupeBatch = batchAt !== undefined && Math.abs(batchAt - at) <= DUPLICATE_WINDOW_MS;
      const dupeExisting = [...(byFp.get(fp) ?? [])].some(
        (e) => Math.abs(timeOf(e.submitted_at ?? e.created_at) - at) <= DUPLICATE_WINDOW_MS,
      );
      if (dupeBatch || dupeExisting) {
        dupeIds.push(String(row.netlify_id));
        continue;
      }
      seenFp.set(fp, at);
      keepRows.push(row);
    }
    if (dupeIds.length) {
      await tombstone(db, dupeIds);
      for (const id of dupeIds) await deleteOnNetlify(id);
    }

    let syncedNew = 0;
    for (const row of keepRows) {
      if (!existing.has(String(row.netlify_id))) syncedNew += 1;
    }

    // Upsert refreshes mapped columns + raw_data but never sends status/notes,
    // so anything the user managed in the system stays untouched.
    for (let i = 0; i < keepRows.length; i += UPSERT_CHUNK) {
      const chunk = keepRows.slice(i, i + UPSERT_CHUNK);
      const { error } = await db
        .from('consultation_requests')
        .upsert(chunk, { onConflict: 'netlify_id' });
      if (error) throw new Error(`db_upsert: ${error.message}`);
    }

    let lastSubmissionAt: string | null = null;
    for (const submission of submissions) {
      const createdAt = textOf(submission.created_at);
      if (createdAt && (!lastSubmissionAt || createdAt > lastSubmissionAt)) {
        lastSubmissionAt = createdAt;
      }
    }

    // Durable in-app bell rows for everyone who can act on consultations —
    // best effort, never fails the sync itself.
    if (syncedNew > 0) {
      const latestNew = keepRows.find((r) => !existing.has(String(r.netlify_id)));
      const latestName = latestNew ? textOf(latestNew.full_name) ?? '' : '';
      try {
        await db.rpc('notify_new_consultations', {
          p_count: syncedNew,
          p_latest: latestName,
        });
      } catch {
        /* notification failure must never break the sync */
      }
    }

    return json({
      synced_new: syncedNew,
      total_fetched: submissions.length,
      skipped_deleted: skippedDeleted,
      skipped_duplicate: dupeIds.length,
      healed_duplicates: healDropIds.length,
      cleaned_leftovers: cleanedLeftovers,
      last_submission_at: lastSubmissionAt,
      pages_fetched: pages,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'sync_failed', detail }, 502);
  }
});
