-- =====================================================================
-- Cafe POS: employee shifts & time-tracking schema
-- Implements section 6 of "Employee Shift Transition Specification".
--
--   staff_members      who can use the terminal (hashed PIN, badge, NFC)
--   registers          physical terminals + their settings
--   time_cards         clock-in / clock-out per employee
--   register_shifts    one drawer session (opened with a float, closed by
--                      either a mid-day handoff or the end-of-day Z-report)
--   drawer_counts      opening / handoff / closing cash counts
--   shift_reports      X-reports (handoff) and Z-reports (end of day)
--   variance_approvals manager sign-off when a drawer is over / short
--
-- Security model: every table has Row Level Security enabled and NO
-- policies, and API roles (anon, authenticated) are granted nothing.
-- Only the service role / server-side code can touch these tables until
-- you add policies on purpose. PINs are stored as bcrypt hashes and are
-- checked inside verify_staff_pin(), never read by the client.
--
-- Orders: this migration does not create an orders table. When you add
-- one, give it a `shift_id uuid references public.register_shifts(id)` so
-- cash / card sales can be totalled per shift for the reports.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------
create type public.staff_role as enum ('head_barista', 'cashier', 'store_manager');
create type public.auth_method as enum ('pin', 'badge_qr', 'nfc');
create type public.shift_status as enum ('open', 'closed');
create type public.shift_close_type as enum ('handoff', 'end_of_day');
create type public.drawer_count_type as enum ('opening', 'handoff', 'closing');
create type public.report_type as enum ('x_report', 'z_report');

-- ---------------------------------------------------------------------
-- Registers (terminals)
-- ---------------------------------------------------------------------
create table public.registers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  default_float      numeric(12,2) not null default 150.00 check (default_float >= 0),
  -- Over / short amount (either direction) that needs a manager PIN.
  variance_threshold numeric(12,2) not null default 5.00 check (variance_threshold >= 0),
  auto_lock_minutes  integer not null default 3 check (auto_lock_minutes > 0),
  -- True after the Z-report closes the store; a manager must reopen it.
  is_night_mode      boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------
create table public.staff_members (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  pin_hash            text not null,                -- bcrypt, see set_staff_pin()
  badge_code          text unique,                  -- barcode / QR staff badge
  nfc_uid             text unique,                  -- NFC / RFID card
  default_role        public.staff_role not null default 'cashier',
  is_manager          boolean not null default false,
  is_active           boolean not null default true,
  failed_pin_attempts integer not null default 0,
  pin_locked_until    timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Time cards (clock in / out)
-- ---------------------------------------------------------------------
create table public.time_cards (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid not null references public.staff_members(id),
  register_id      uuid references public.registers(id),
  role             public.staff_role not null,        -- role chosen for this shift
  clock_in_at      timestamptz not null default now(),
  clock_out_at     timestamptz,
  clock_in_method  public.auth_method not null default 'pin',
  clock_out_method public.auth_method,
  constraint time_cards_out_after_in check (clock_out_at is null or clock_out_at >= clock_in_at)
);

-- An employee can only be clocked in once at a time.
create unique index time_cards_one_open_per_staff
  on public.time_cards (staff_id) where clock_out_at is null;
create index time_cards_staff_clock_in_idx
  on public.time_cards (staff_id, clock_in_at desc);

-- ---------------------------------------------------------------------
-- Register shifts (drawer sessions)
-- ---------------------------------------------------------------------
create table public.register_shifts (
  id                uuid primary key default gen_random_uuid(),
  register_id       uuid not null references public.registers(id),
  cashier_id        uuid not null references public.staff_members(id),
  time_card_id      uuid references public.time_cards(id),
  -- Set when this shift continues a mid-day handoff from another cashier.
  previous_shift_id uuid references public.register_shifts(id),
  status            public.shift_status not null default 'open',
  opened_at         timestamptz not null default now(),
  opening_float     numeric(12,2) not null check (opening_float >= 0),
  closed_at         timestamptz,
  close_type        public.shift_close_type,
  constraint register_shifts_closed_fields
    check ((status = 'open') = (closed_at is null) and (status = 'open') = (close_type is null))
);

-- A register can only have one open drawer session at a time.
create unique index register_shifts_one_open_per_register
  on public.register_shifts (register_id) where status = 'open';
create index register_shifts_cashier_idx on public.register_shifts (cashier_id, opened_at desc);

-- ---------------------------------------------------------------------
-- Drawer counts (opening float, handoff count, closing count)
-- ---------------------------------------------------------------------
create table public.drawer_counts (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references public.register_shifts(id) on delete cascade,
  count_type    public.drawer_count_type not null,
  counted_by    uuid not null references public.staff_members(id),
  counted_at    timestamptz not null default now(),
  total_cash    numeric(12,2) not null check (total_cash >= 0),
  -- Optional quick-count, e.g. {"1000": 2, "500": 4, "20": 10}
  denominations jsonb not null default '{}'::jsonb,
  -- True when the cashier counted without seeing the expected total.
  is_blind      boolean not null default false,
  constraint drawer_counts_one_per_type unique (shift_id, count_type)
);

-- ---------------------------------------------------------------------
-- Shift reports (X = mid-day handoff, Z = end of day)
-- ---------------------------------------------------------------------
create sequence public.z_report_number_seq start 1;

create table public.shift_reports (
  id                    uuid primary key default gen_random_uuid(),
  shift_id              uuid not null references public.register_shifts(id) on delete cascade,
  report_type           public.report_type not null,
  z_number              bigint unique,               -- assigned automatically for Z-reports
  generated_by          uuid not null references public.staff_members(id),
  generated_at          timestamptz not null default now(),

  order_count           integer not null default 0 check (order_count >= 0),
  opening_float         numeric(12,2) not null check (opening_float >= 0),
  cash_sales            numeric(12,2) not null default 0 check (cash_sales >= 0),
  card_total            numeric(12,2) not null default 0 check (card_total >= 0),
  gift_card_total       numeric(12,2) not null default 0 check (gift_card_total >= 0),
  cash_refunds          numeric(12,2) not null default 0 check (cash_refunds >= 0),
  discounts_total       numeric(12,2) not null default 0 check (discounts_total >= 0),

  -- Expected = Starting Float + Cash Sales - Cash Refunds (as in the spec).
  expected_cash         numeric(12,2) generated always as (opening_float + cash_sales - cash_refunds) stored,
  counted_cash          numeric(12,2) not null check (counted_cash >= 0),
  -- Variance = Actual Cash - Expected Cash (negative = short).
  variance              numeric(12,2) generated always as (counted_cash - (opening_float + cash_sales - cash_refunds)) stored,

  -- Z-report only: card batch settled with the payment processor.
  card_batch_reference  text,
  card_batch_settled_at timestamptz,

  constraint shift_reports_one_per_type unique (shift_id, report_type),
  constraint shift_reports_z_number_only_for_z check (report_type = 'z_report' or z_number is null)
);

create function public.assign_z_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.report_type = 'z_report' and new.z_number is null then
    new.z_number := nextval('public.z_report_number_seq');
  end if;
  return new;
end;
$$;

create trigger shift_reports_assign_z_number
  before insert on public.shift_reports
  for each row execute function public.assign_z_number();

-- ---------------------------------------------------------------------
-- Manager approval for over / short drawers
-- ---------------------------------------------------------------------
create table public.variance_approvals (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null unique references public.shift_reports(id) on delete cascade,
  approved_by uuid not null references public.staff_members(id),
  approved_at timestamptz not null default now(),
  variance    numeric(12,2) not null,
  threshold   numeric(12,2) not null,
  note        text
);

create function public.enforce_manager_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_members
    where id = new.approved_by and is_manager and is_active
  ) then
    raise exception 'Variance approvals must be made by an active manager';
  end if;
  return new;
end;
$$;

create trigger variance_approvals_manager_only
  before insert or update on public.variance_approvals
  for each row execute function public.enforce_manager_approval();

-- ---------------------------------------------------------------------
-- Hours worked per time card
-- ---------------------------------------------------------------------
create view public.time_card_hours
with (security_invoker = true) as
select
  tc.id,
  tc.staff_id,
  sm.full_name,
  tc.role,
  tc.clock_in_at,
  tc.clock_out_at,
  case
    when tc.clock_out_at is not null
      then round(extract(epoch from (tc.clock_out_at - tc.clock_in_at)) / 3600.0, 2)
  end as hours_worked
from public.time_cards tc
join public.staff_members sm on sm.id = tc.staff_id;

-- ---------------------------------------------------------------------
-- PIN helpers (bcrypt). 5 wrong PINs lock the account for 5 minutes.
-- ---------------------------------------------------------------------
create function public.set_staff_pin(p_staff_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.staff_members
     set pin_hash = crypt(p_pin, gen_salt('bf')),
         failed_pin_attempts = 0,
         pin_locked_until = null
   where id = p_staff_id;
end;
$$;

create function public.verify_staff_pin(p_staff_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s  public.staff_members%rowtype;
  ok boolean;
begin
  select * into s
    from public.staff_members
   where id = p_staff_id and is_active
     for update;

  if not found then
    return false;
  end if;

  if s.pin_locked_until is not null and s.pin_locked_until > now() then
    return false;
  end if;

  ok := s.pin_hash = crypt(p_pin, s.pin_hash);

  if ok then
    update public.staff_members
       set failed_pin_attempts = 0, pin_locked_until = null
     where id = s.id;
  else
    update public.staff_members
       set failed_pin_attempts = case when failed_pin_attempts + 1 >= 5 then 0 else failed_pin_attempts + 1 end,
           pin_locked_until    = case when failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
     where id = s.id;
  end if;

  return ok;
end;
$$;

-- ---------------------------------------------------------------------
-- Lock everything down (deny by default)
-- ---------------------------------------------------------------------
alter table public.registers          enable row level security;
alter table public.staff_members      enable row level security;
alter table public.time_cards         enable row level security;
alter table public.register_shifts    enable row level security;
alter table public.drawer_counts      enable row level security;
alter table public.shift_reports      enable row level security;
alter table public.variance_approvals enable row level security;

revoke all on public.registers, public.staff_members, public.time_cards,
              public.register_shifts, public.drawer_counts, public.shift_reports,
              public.variance_approvals, public.time_card_hours
  from public, anon, authenticated;
revoke all on sequence public.z_report_number_seq from public, anon, authenticated;

revoke execute on function public.set_staff_pin(uuid, text)    from public, anon, authenticated;
revoke execute on function public.verify_staff_pin(uuid, text) from public, anon, authenticated;
revoke execute on function public.assign_z_number()            from public, anon, authenticated;
revoke execute on function public.enforce_manager_approval()   from public, anon, authenticated;

-- Server-side code (service role) keeps full access.
grant all on public.registers, public.staff_members, public.time_cards,
             public.register_shifts, public.drawer_counts, public.shift_reports,
             public.variance_approvals, public.time_card_hours
  to service_role;
grant usage, select on sequence public.z_report_number_seq to service_role;
grant execute on function public.set_staff_pin(uuid, text)    to service_role;
grant execute on function public.verify_staff_pin(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Starter data: one register. Add staff with set_staff_pin() so the PIN
-- is hashed, e.g.
--   insert into public.staff_members (full_name, pin_hash, default_role, is_manager)
--   values ('Store Manager', 'x', 'store_manager', true) returning id;
--   select public.set_staff_pin('<that id>', '1234');
-- ---------------------------------------------------------------------
insert into public.registers (name) values ('Front Counter');
