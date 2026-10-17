-- ============================================================
-- AL BALQAN — Public consultation submissions
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
--
-- The public website lives on GitHub Pages, so visitors have no
-- Supabase session. This RPC is the single door they may use: it
-- validates, enforces the Latin-caps rule and rate-limits, then
-- stores the row with user_id = null. Only admins can read those.
-- ============================================================

-- 1. Public rows have no owner, so owner must be optional.
alter table public.consultation_requests
  alter column user_id drop not null;

-- 2. Admins must see the anonymous rows too.
drop policy if exists "own select" on public.consultation_requests;
create policy "own select" on public.consultation_requests
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own update" on public.consultation_requests;
create policy "own update" on public.consultation_requests
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists "own delete" on public.consultation_requests;
create policy "own delete" on public.consultation_requests
  for delete using (auth.uid() = user_id or public.is_admin());

-- Anonymous rows are readable only through the RPC below, never
-- through a direct insert policy.

-- 3. One shared normaliser: collapse whitespace, force capitals,
--    reject any Arabic script so the record can travel onto a PDF.
create or replace function public.latin_upper(p text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(coalesce(p, ''), '[[:space:]]+', ' ', 'g'),
      '^[[:space:]]+|[[:space:]]+$', '', 'g'
    ),
    ''
  );
$$;

-- Arabic + Arabic Supplement + Arabic Extended-A + both Presentation
-- Forms + the letter mark. Built from code points so the SQL file
-- survives any transport encoding.
create or replace function public.has_arabic(p text)
returns boolean
language sql
immutable
as $$
  select coalesce(p, '') ~ (
    '[' ||
      chr(x'0600'::int) || '-' || chr(x'06FF'::int) ||
      chr(x'0750'::int) || '-' || chr(x'077F'::int) ||
      chr(x'08A0'::int) || '-' || chr(x'08FF'::int) ||
      chr(x'FB50'::int) || '-' || chr(x'FDFF'::int) ||
      chr(x'FE70'::int) || '-' || chr(x'FEFF'::int) ||
      chr(x'061C'::int) ||
    ']'
  )
$$;

-- 4. The public door.
create or replace function public.submit_consultation(
  p_full_name   text,
  p_email       text,
  p_phone       text,
  p_nationality text,
  p_country     text,
  p_residence   text,
  p_service     text,
  p_details     text,
  p_consent     boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := public.latin_upper(p_full_name);
  v_email  text := public.latin_upper(p_email);
  v_phone  text := public.latin_upper(p_phone);
  v_nat    text := public.latin_upper(p_nationality);
  v_res    text := public.latin_upper(p_residence);
  v_det    text := public.latin_upper(p_details);
  v_id     uuid;
begin
  if p_consent is distinct from true then
    raise exception 'consent_required';
  end if;

  if v_name is null or v_phone is null or v_nat is null
     or public.latin_upper(p_country) is null
     or public.latin_upper(p_service) is null or v_det is null then
    raise exception 'required_fields_missing';
  end if;

  if public.has_arabic(v_name) or public.has_arabic(v_email)
     or public.has_arabic(v_nat) or public.has_arabic(v_res)
     or public.has_arabic(v_det) then
    raise exception 'arabic_not_allowed';
  end if;

  if length(v_name) > 120 or length(v_email) > 254 or length(v_phone) > 32
     or length(v_nat) > 80 or length(v_res) > 120 or length(v_det) > 2000 then
    raise exception 'field_too_long';
  end if;

  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'invalid_email';
  end if;

  if v_phone !~ '^[0-9+()\- .]{7,32}$' then
    raise exception 'invalid_phone';
  end if;

  /* Basic flood guard: same phone, last 24 hours. */
  if exists (
    select 1 from public.consultation_requests
    where phone = v_phone
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'duplicate_phone_24h';
  end if;

  insert into public.consultation_requests (
    user_id, netlify_id, form_name, full_name, email, phone,
    nationality, country, residence, service, details, consent,
    submitted_at, raw_data, status
  ) values (
    null, 'direct-' || gen_random_uuid()::text, 'consultation',
    v_name, v_email, v_phone, v_nat,
    public.latin_upper(p_country), v_res,
    public.latin_upper(p_service), v_det, true,
    now(), '{}'::jsonb, 'new'
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_consultation(text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_consultation(text, text, text, text, text, text, text, text, boolean)
  to anon, authenticated;
