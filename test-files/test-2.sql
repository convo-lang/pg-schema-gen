-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Role type for account membership and access control
create type role_type as enum ('exiting', 'onboarding', 'manager', 'admin');

-- Echo lifecycle status
create type echo_status as enum ('draft', 'submitted', 'in_review', 'approved', 'published', 'archived');

-- Invite lifecycle status
create type invite_status as enum ('pending', 'sent', 'accepted', 'expired', 'revoked', 'cancelled');

-- Chat message role for assistant conversations
create type chat_message_role as enum ('system', 'user', 'assistant', 'tool');

-- Thread status for chat threads
create type thread_status as enum ('open', 'closed', 'archived');

-- Accounts represent organizations/tenants
create table if not exists public.accounts (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the account was created
    created_at timestamptz not null default now(),
    -- Organization name
    name text not null,
    -- Arbitrary account-level settings and metadata
    data jsonb not null default '{}'::jsonb,
    constraint accounts_pkey primary key (id),
    constraint accounts_name_unique unique (name)
);

create index if not exists idx_accounts_created_at on public.accounts (created_at);

-- Application users (profile) linked to Supabase auth.users
create table if not exists public.users (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the user profile was created
    created_at timestamptz not null default now(),
    -- Display name
    name text not null,
    -- Email for contact and display (auth handled by auth.users)
    email text not null,
    -- Default/primary account for the user
    account_id uuid,
    -- Arbitrary user preferences and metadata
    data jsonb not null default '{}'::jsonb,
    -- Foreign key to Supabase auth.users
    auth_user_id uuid,
    constraint users_pkey primary key (id),
    constraint users_account_id_fkey foreign key (account_id) references public.accounts (id) on delete set null,
    constraint users_auth_user_id_unique unique (auth_user_id)
);

create index if not exists idx_users_account_id on public.users (account_id);
create index if not exists idx_users_created_at on public.users (created_at);
create index if not exists idx_users_email on public.users (email);

-- Memberships tie users to accounts with a role
create table if not exists public.account_members (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the membership was created
    created_at timestamptz not null default now(),
    -- The account this membership belongs to
    account_id uuid not null,
    -- The user in this membership
    user_id uuid not null,
    -- Role within the account context
    role role_type not null default 'onboarding',
    -- Whether this membership is active
    is_active boolean not null default true,
    constraint account_members_pkey primary key (id),
    constraint account_members_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade,
    constraint account_members_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade,
    constraint account_members_unique_member unique (account_id, user_id)
);

create index if not exists idx_account_members_account_role on public.account_members (account_id, role);
create index if not exists idx_account_members_user on public.account_members (user_id);

-- Echos are digital twins of exiting employees' knowledge
create table if not exists public.echos (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the echo was created
    created_at timestamptz not null default now(),
    -- Last updated timestamp
    updated_at timestamptz not null default now(),
    -- The originating/exiting user (may be null if user removed)
    user_id uuid,
    -- Organization that owns this echo
    account_id uuid not null,
    -- Manager who reviews this echo
    manager_id uuid,
    -- Lifecycle status of the echo
    status echo_status not null default 'draft',
    -- General/basic info about the role and person (name, email, job_title, etc.)
    basic_info jsonb not null default '{}'::jsonb,
    -- High-level knowledge summary
    knowledge_summary text,
    -- 3 Critical Questions: unwritten rules
    unwritten_rules text,
    -- 3 Critical Questions: hidden landmines
    hidden_landmines text,
    -- 3 Critical Questions: key contacts (array of {name, role, why, contact})
    key_contacts jsonb not null default '[]'::jsonb,
    -- 4-E Abridged: Extract notes
    process_extract text,
    -- 4-E Abridged: Evaluate notes
    process_evaluate text,
    -- 4-E Abridged: Encode notes
    process_encode text,
    -- 4-E Abridged: Enable notes
    process_enable text,
    -- When the echo was approved for publishing
    approved_at timestamptz,
    -- Approver user id (typically manager)
    approved_by uuid,
    -- When the echo was published
    published_at timestamptz,
    constraint echos_pkey primary key (id),
    constraint echos_user_id_fkey foreign key (user_id) references public.users (id) on delete set null,
    constraint echos_manager_id_fkey foreign key (manager_id) references public.users (id) on delete set null,
    constraint echos_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade,
    constraint echos_approved_by_fkey foreign key (approved_by) references public.users (id) on delete set null
);

create index if not exists idx_echos_account_status on public.echos (account_id, status);
create index if not exists idx_echos_user on public.echos (user_id);
create index if not exists idx_echos_manager on public.echos (manager_id);
create index if not exists idx_echos_created_at on public.echos (created_at);

-- Onboarding Playbooks generated from Echos (markdown content)
create table if not exists public.onboarding_playbooks (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the playbook was created
    created_at timestamptz not null default now(),
    -- Last updated timestamp
    updated_at timestamptz not null default now(),
    -- Parent echo
    echo_id uuid not null,
    -- Version number of the playbook for the echo
    version integer not null default 1,
    -- Markdown content of the playbook
    markdown_content text not null,
    -- Whether a manager has approved this playbook version
    approved_by_manager boolean not null default false,
    -- Approver user id
    approved_by uuid,
    -- When this version was approved
    approved_at timestamptz,
    constraint onboarding_playbooks_pkey primary key (id),
    constraint onboarding_playbooks_echo_id_fkey foreign key (echo_id) references public.echos (id) on delete cascade,
    constraint onboarding_playbooks_approved_by_fkey foreign key (approved_by) references public.users (id) on delete set null,
    constraint onboarding_playbooks_unique_version unique (echo_id, version)
);

create index if not exists idx_playbooks_echo on public.onboarding_playbooks (echo_id);
create index if not exists idx_playbooks_created_at on public.onboarding_playbooks (created_at);

-- Echo Invites allow managers/admins to invite exiting employees
create table if not exists public.echo_invites (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the invite was created
    created_at timestamptz not null default now(),
    -- Owning account for the invite
    account_id uuid not null,
    -- Prefilled exiting employee name
    name text not null,
    -- Prefilled exiting employee email
    email text not null,
    -- Prefilled exiting employee job title
    job_title text,
    -- Full invite link (optional; can be constructed on the fly)
    invite_url text,
    -- Unique token used to validate invite usage
    token text not null,
    -- Current status of the invite
    status invite_status not null default 'pending',
    -- When the invite expires (optional)
    expires_at timestamptz,
    -- Inviter (manager/admin)
    invited_by uuid,
    -- The user who accepted the invite (once accepted)
    accepted_by uuid,
    -- When the invite was accepted
    accepted_at timestamptz,
    -- Echo created as a result of this invite (optional)
    echo_id uuid,
    constraint echo_invites_pkey primary key (id),
    constraint echo_invites_account_id_fkey foreign key (account_id) references public.accounts (id) on delete cascade,
    constraint echo_invites_invited_by_fkey foreign key (invited_by) references public.users (id) on delete set null,
    constraint echo_invites_accepted_by_fkey foreign key (accepted_by) references public.users (id) on delete set null,
    constraint echo_invites_echo_id_fkey foreign key (echo_id) references public.echos (id) on delete set null,
    constraint echo_invites_token_unique unique (token)
);

create index if not exists idx_echo_invites_account_status on public.echo_invites (account_id, status);
create index if not exists idx_echo_invites_email on public.echo_invites (lower(email));

-- Access control mapping for specific Echo visibility beyond default roles
create table if not exists public.echo_access (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the access grant was created
    created_at timestamptz not null default now(),
    -- Echo being shared
    echo_id uuid not null,
    -- User receiving access
    user_id uuid not null,
    -- Role of the user with respect to this echo (inherits semantics from role_type)
    role role_type not null,
    -- Whether access is currently active
    is_active boolean not null default true,
    constraint echo_access_pkey primary key (id),
    constraint echo_access_echo_id_fkey foreign key (echo_id) references public.echos (id) on delete cascade,
    constraint echo_access_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade,
    constraint echo_access_unique unique (echo_id, user_id)
);

create index if not exists idx_echo_access_echo_role on public.echo_access (echo_id, role);
create index if not exists idx_echo_access_user on public.echo_access (user_id);

-- Chat threads for conversations with an Echo
create table if not exists public.echo_chat_threads (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the thread was created
    created_at timestamptz not null default now(),
    -- The related echo
    echo_id uuid not null,
    -- User who started the thread (optional)
    started_by uuid,
    -- Thread title or brief
    title text,
    -- Thread status
    status thread_status not null default 'open',
    -- Arbitrary metadata for the thread (e.g., tags)
    metadata jsonb not null default '{}'::jsonb,
    -- Last message timestamp for sorting
    last_message_at timestamptz,
    constraint echo_chat_threads_pkey primary key (id),
    constraint echo_chat_threads_echo_id_fkey foreign key (echo_id) references public.echos (id) on delete cascade,
    constraint echo_chat_threads_started_by_fkey foreign key (started_by) references public.users (id) on delete set null
);

create index if not exists idx_threads_echo on public.echo_chat_threads (echo_id);
create index if not exists idx_threads_started_by on public.echo_chat_threads (started_by);
create index if not exists idx_threads_last_message_at on public.echo_chat_threads (last_message_at desc);

-- Chat messages within threads, for Echo assistant guidance
create table if not exists public.echo_chat_messages (
    -- Primary key
    id uuid not null default gen_random_uuid(),
    -- When the message was created
    created_at timestamptz not null default now(),
    -- The parent thread
    thread_id uuid not null,
    -- The related echo (duplicate for convenience/indexing)
    echo_id uuid not null,
    -- Ordinal position (auto-increment) within the table
    ordinal bigint generated always as identity,
    -- Message role (system, user, assistant, tool)
    role chat_message_role not null,
    -- Sender user id (null for assistant/system messages)
    sender_user_id uuid,
    -- Message content in plain text or markdown
    content text not null,
    -- Arbitrary message metadata (tokens, citations, etc.)
    metadata jsonb not null default '{}'::jsonb,
    constraint echo_chat_messages_pkey primary key (id),
    constraint echo_chat_messages_thread_id_fkey foreign key (thread_id) references public.echo_chat_threads (id) on delete cascade,
    constraint echo_chat_messages_echo_id_fkey foreign key (echo_id) references public.echos (id) on delete cascade,
    constraint echo_chat_messages_sender_user_id_fkey foreign key (sender_user_id) references public.users (id) on delete set null
);

create index if not exists idx_messages_thread_created on public.echo_chat_messages (thread_id, created_at);
create index if not exists idx_messages_echo_created on public.echo_chat_messages (echo_id, created_at);
create index if not exists idx_messages_sender on public.echo_chat_messages (sender_user_id);