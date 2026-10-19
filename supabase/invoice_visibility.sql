-- ============================================================
-- AL BALQAN — invoice visibility for client owners
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> Run
-- (Safe to re-run.)
--
-- WHY
--   A limited user (e.g. an employee who can only add clients and view
--   the client list) sees only the clients THEY added, because the RLS
--   policy on `clients` is owner-OR-admin. That is correct and stays.
--
--   But when an admin opens that user's invoices list, creates an
--   invoice for one of the user's clients, and the user reloads their
--   invoice list, the invoice must appear for them too.
--
-- HOW
--   An invoice has no stored client id — the app links an invoice to a
--   client by matching the invoice's customer passport against the
--   client's passport (see src/utils/clients.js, normalizePassport /
--   getClientInvoices). So the select policy is widened to also allow a
--   row whose customer passport matches the passport of a client the
--   caller owns. Update and delete are intentionally left owner-OR-admin
--   so a client-owner can VIEW but never modify someone else's invoice.
--
--   Passports are compared after the same normalisation the app uses
--   (uppercase, strip every non-alphanumeric), so "ab-12 cd" == "AB12CD".
--   The partial expression index on clients keeps the join cheap.
-- ============================================================

-- 1) Speed up the "my clients' passports" lookup used by the policy.
create index if not exists clients_user_passport_norm_idx
  on public.clients (
    user_id,
    (upper(regexp_replace(coalesce(data->>'passport', ''), '[^A-Za-z0-9]', '', 'g')))
  )
  where deleted_at is null;

-- 2) Widen ONLY the select policy.
drop policy if exists "own select" on public.invoices;
create policy "own select" on public.invoices for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (
      -- the invoice must actually carry a non-empty passport
      nullif(
        upper(regexp_replace(coalesce(invoices.data->'customer'->>'passport', ''), '[^A-Za-z0-9]', '', 'g')),
        ''
      ) is not null
      and exists (
        select 1
        from public.clients c
        where c.user_id = auth.uid()
          and c.deleted_at is null
          and upper(regexp_replace(coalesce(c.data->>'passport', ''), '[^A-Za-z0-9]', '', 'g'))
            = upper(regexp_replace(coalesce(invoices.data->'customer'->>'passport', ''), '[^A-Za-z0-9]', '', 'g'))
      )
    )
  );
