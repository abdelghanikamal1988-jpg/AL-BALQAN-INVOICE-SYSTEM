// AL BALQAN — Netlify Forms proxy (Supabase Edge Function).
// The Netlify token lives ONLY here (secret NETLIFY_TOKEN).
//
// POST /  { "action": "submissions" }  -> sync all submissions into public.consultation_requests
// POST /  { "action": "forms" }        -> return the consultation form definition (fields)
// GET  /?action=submissions|forms      -> same actions via query string
//
// Deploy:
//   supabase functions deploy netlify-forms
//   supabase secrets set NETLIFY_TOKEN=<personal access token>
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const NETLIFY_TOKEN = Deno.env.get('NETLIFY_TOKEN') ?? '';
const NETLIFY_SITE_ID =
  Deno.env.get('NETLIFY_SITE_ID') ?? 'c62355e1-108a-4b41-bc0d-6e5a6acda6ed';

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
    return new Response('ok', { status: 204, headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'auth_required' }, 401);

    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'auth_invalid' }, 401);

    let action = 'submissions';
    if (req.method === 'GET') {
      action = new URL(req.url).searchParams.get('action') ?? 'submissions';
    } else {
      try {
        const body = (await req.json()) as { action?: unknown } | null;
        if (body && typeof body.action === 'string') action = body.action;
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

    const { data: existingRows, error: selectError } = await db
      .from('consultation_requests')
      .select('netlify_id');
    if (selectError) throw new Error(`db_select: ${selectError.message}`);
    const existing = new Set((existingRows ?? []).map((r) => String(r.netlify_id)));

    const rows = submissions
      .map(buildRow)
      .filter((row): row is Record<string, unknown> => row !== null && row.netlify_id !== '');

    let syncedNew = 0;
    for (const row of rows) {
      if (!existing.has(String(row.netlify_id))) syncedNew += 1;
    }

    // Upsert refreshes mapped columns + raw_data but never sends status/notes,
    // so anything the user managed in the system stays untouched.
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
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

    return json({
      synced_new: syncedNew,
      total_fetched: submissions.length,
      last_submission_at: lastSubmissionAt,
      pages_fetched: pages,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'sync_failed', detail }, 502);
  }
});
