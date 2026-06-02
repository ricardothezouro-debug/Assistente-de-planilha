create table if not exists public.users (
  id serial primary key,
  username text not null unique,
  supabase_user_id text unique,
  email text unique,
  password_hash text not null default 'supabase-auth',
  display_name text,
  is_admin boolean not null default false,
  disabled_at timestamp,
  feature_flags text not null default '{}',
  created_at timestamp default now()
);

create table if not exists public.settings (
  user_id integer not null references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (user_id, key)
);

create table if not exists public.categories (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  name text not null
);

create unique index if not exists idx_categories_user_name
  on public.categories(user_id, name);

create table if not exists public.entries (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  type text not null,
  name text not null,
  total_amount_cents integer not null,
  category_id integer not null references public.categories(id),
  start_date text not null,
  installments integer not null default 1,
  notes text,
  created_at timestamp default now()
);

create table if not exists public.occurrences (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  entry_id integer not null references public.entries(id) on delete cascade,
  category_id integer not null references public.categories(id),
  type text not null,
  name text not null,
  due_date text not null,
  year integer not null,
  month integer not null,
  amount_cents integer not null,
  installment_number integer,
  installment_total integer,
  status text not null,
  paid_at text,
  created_at timestamp default now()
);

create index if not exists idx_occurrences_year_month
  on public.occurrences(year, month);

create index if not exists idx_occurrences_status
  on public.occurrences(status);

create index if not exists idx_occurrences_user_year_month
  on public.occurrences(user_id, year, month);

alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.occurrences enable row level security;
