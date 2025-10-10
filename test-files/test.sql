-- A cool dude
create table public.user (
  -- Id of the user
  id uuid not null default gen_random_uuid (),

  -- Time stamp when the user was created
  created_at timestamp with time zone not null default now(),
  name text not null,

  -- Valid email
  email text not null,
  account_id uuid not null,
  data jsonb not null,
  constraint user_pkey primary key (id),
  constraint user_account_id_fkey foreign KEY (account_id) references account (id) on delete CASCADE
);

-- extra data for stuff
create table public.data (
  id uuid not null default gen_random_uuid (),
  account_id uuid not null,
  created_at timestamp with time zone not null default now(),
  last_modified_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  modified_by_user_id uuid null,
  owner_user_id uuid null,
  public boolean not null default false,
  data jsonb not null,
  "table" text not null,
  constraint data_pkey primary key (id),
  constraint data_account_id_fkey foreign KEY (account_id) references account (id) on delete CASCADE,
  constraint data_created_by_user_id_fkey foreign KEY (created_by_user_id) references data (id) on delete set null,
  constraint data_modified_by_user_id_fkey foreign KEY (modified_by_user_id) references "user" (id) on delete set null,
  constraint data_owner_user_id_fkey foreign KEY (owner_user_id) references "user" (id) on delete set null
);

create index IF not exists data_table_idx on public.data using btree ("table");

create table public.account (
  id uuid not null default gen_random_uuid (),
  name text not null,
  created_at timestamp with time zone not null default now(),
  data jsonb not null,
  constraint account_pkey primary key (id)
);

create table public.extra (
  id uuid not null default gen_random_uuid (),
  name text not null
);

CREATE OR REPLACE FUNCTION get_user_by_id(id bigint)
RETURNS TABLE (
  id bigint,
  name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name
  FROM users
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE account_example_gen (
    id   UUID PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE "user_example_gen" (
    id         UUID PRIMARY KEY,
    name       TEXT NOT NULL,
    account_example_gen_id UUID NOT NULL REFERENCES account_example_gen(id)
);