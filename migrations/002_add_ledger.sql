create table transactions (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    status text not null,
    amount bigint not null,
    created_by uuid not null,
    created_at timestamptz not null default now(),

    constraint transactions_type_check
        check (type in ('topup', 'transfer')),
    constraint transactions_status_check
        check (status in ('pending', 'success', 'failed')),
    constraint transactions_amount_positive
        check (amount > 0),
    constraint transactions_created_by_fkey
        foreign key (created_by) references users(id) on delete restrict
);

create table ledger_entries (
    id bigint generated always as identity primary key,
    transaction_id uuid not null,
    account_id bigint not null,
    direction text not null,
    amount bigint not null,
    created_at timestamptz not null default now(),

    constraint ledger_entries_transaction_id_fkey
        foreign key (transaction_id) references transactions(id) on delete restrict,
    constraint ledger_entries_account_id_fkey
        foreign key (account_id) references accounts(id) on delete restrict,
    constraint ledger_entries_direction_check
        check (direction in ('debit', 'credit')),
    constraint ledger_entries_amount_positive
        check (amount > 0)
);

create index idx_ledger_entries_account_id_desc
    on ledger_entries (account_id, id desc);