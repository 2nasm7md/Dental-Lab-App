-- ============================================================================
-- The BEFORE INSERT trigger fill_case_number() generates the per-clinic
-- case number by scanning existing rows in `cases`. With the function
-- running as SECURITY INVOKER, that SELECT was subject to the caller's
-- RLS on `cases` — and in some paths that made the whole INSERT abort.
--
-- Fix:
--   1. Make next_case_number() and fill_case_number() SECURITY DEFINER
--      with a pinned search_path, so the case-number lookup never depends
--      on the caller's RLS context.
--   2. Give cases.case_number a sentinel default so the NOT NULL check
--      can't fire before the BEFORE trigger has had a chance to overwrite
--      it. The trigger still wins — it only runs the generator when
--      case_number is null or empty or matches the sentinel.
-- ============================================================================

-- Sentinel default. Any text would do; we use '__pending__' so a row left
-- with this value is obviously a bug, not a real case.
alter table cases
  alter column case_number set default '__pending__';

-- Lift NOT NULL temporarily, allow the default + trigger to fill, then put
-- it back — guarantees no in-flight row is rejected before the BEFORE
-- trigger runs.
alter table cases alter column case_number drop not null;

-- ---------------------------------------------------------------------------
-- next_case_number — SECURITY DEFINER, pinned search_path.
-- ---------------------------------------------------------------------------
create or replace function next_case_number(p_clinic_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YY');
  v_seq int;
begin
  select coalesce(
    max(
      case
        when case_number ~ ('^' || v_year || '-[0-9]+$')
        then (split_part(case_number, '-', 2))::int
        else 0
      end
    ),
    0
  ) + 1
  into v_seq
  from cases
  where clinic_org_id = p_clinic_org_id;

  return v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- fill_case_number — SECURITY DEFINER so the SELECT inside next_case_number
-- runs without the caller's RLS. Also treats '__pending__' (the new column
-- default) as "needs filling" alongside null/empty.
-- ---------------------------------------------------------------------------
create or replace function fill_case_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_number is null
     or new.case_number = ''
     or new.case_number = '__pending__' then
    new.case_number := next_case_number(new.clinic_org_id);
  end if;
  return new;
end;
$$;

-- Reinstate NOT NULL now that both the default and the trigger guarantee
-- a non-null value at insert time.
update cases set case_number = next_case_number(clinic_org_id)
  where case_number is null or case_number = '' or case_number = '__pending__';

alter table cases alter column case_number set not null;

-- Triggers don't need to be re-created — CREATE OR REPLACE on the function
-- is enough — but ensure the trigger is present (idempotent).
drop trigger if exists cases_fill_case_number on cases;
create trigger cases_fill_case_number
  before insert on cases
  for each row execute function fill_case_number();
