// AL BALQAN — transactional email (Supabase Edge Function).
//
// Deliberately inert until the operator supplies a Resend API key:
// without the RESEND_API_KEY secret every call answers 503 email_disabled
// and nothing leaves the server, so the feature can ship now and be turned
// on later with a single `supabase secrets set`.
//
// POST /  { "to": "...", "subject": "...", "text": "...", "html": "..." }
// GET  /  -> configuration probe: { configured: boolean }
//
// Guard rails:
//   * caller must be a signed-in user
//   * `to` must be a single address inside RESEND_ALLOWED_DOMAIN (default
//     albalqan.com) — this is an internal notification channel, never an
//     open relay
//   * subject / text / html are length-capped
//   * at most one message per request
//
// Deploy:
//   supabase functions deploy send-email
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_ALLOWED_DOMAIN=albalqan.com
//   supabase secrets set EMAIL_FROM="AL BALQAN <notifications@albalqan.com>"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ALLOWED_DOMAIN = (Deno.env.get('RESEND_ALLOWED_DOMAIN') ?? 'albalqan.com').toLowerCase();
const FROM = Deno.env.get('EMAIL_FROM') ?? `AL BALQAN <notifications@${ALLOWED_DOMAIN}>`;
const RESEND_API = 'https://api.resend.com/emails';

const MAX_SUBJECT = 200;
const MAX_TEXT = 20000;
const MAX_HTML = 40000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedRecipient(value: string): boolean {
  const domain = value.split('@')[1] ?? '';
  return domain.toLowerCase() === ALLOWED_DOMAIN;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Probe endpoint — no secret, no send. Lets the UI show "not configured".
  if (req.method === 'GET') {
    return json({ configured: RESEND_API_KEY !== '' });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    // Only an authenticated user may ask the server to send anything.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'auth_required' }, 401);

    if (!RESEND_API_KEY) {
      return json(
        {
          error: 'email_disabled',
          hint: 'supabase secrets set RESEND_API_KEY=re_...',
        },
        503,
      );
    }

    let payload: {
      to?: unknown;
      subject?: unknown;
      text?: unknown;
      html?: unknown;
    } = {};
    try {
      payload = (await req.json()) ?? {};
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const to = String(payload.to ?? '').trim().toLowerCase();
    const subject = String(payload.subject ?? '').trim();
    const text = String(payload.text ?? '').trim();
    const html = String(payload.html ?? '').trim();

    if (!to || !isValidEmail(to)) return json({ error: 'invalid_recipient' }, 400);
    if (!isAllowedRecipient(to)) {
      return json({ error: 'recipient_not_allowed', domain: ALLOWED_DOMAIN }, 403);
    }
    if (!subject) return json({ error: 'subject_required' }, 400);
    if (!text && !html) return json({ error: 'body_required' }, 400);
    if (subject.length > MAX_SUBJECT) return json({ error: 'subject_too_long' }, 400);
    if (text.length > MAX_TEXT) return json({ error: 'text_too_long' }, 400);
    if (html.length > MAX_HTML) return json({ error: 'html_too_long' }, 400);

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        /* body unavailable */
      }
      return json({ error: 'resend_failed', detail: `resend_${res.status} ${detail}`.trim() }, 502);
    }

    const result = await res.json().catch(() => ({}));
    return json({ sent: true, id: result?.id ?? null });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'send_failed', detail }, 502);
  }
});
