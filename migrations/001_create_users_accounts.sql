create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
);

create table accounts (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    balance bigint not null default 0,
    created_at timestamptz not null default now(),

    constraint fK_user_id foreign key (user_id) references users(id) on delete restrict,
    constraint account_balances_non_negative check (balance >= 0)  
);