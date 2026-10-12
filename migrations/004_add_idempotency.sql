begin;

create table idempotency_keys (
    user_id uuid null,
    key text not null,
    request_hash text not null,
    transaction_id uuid,
    created_at timestamptz not null default now(),

    constraint idempotency_keys_pkey 
        primary key(user_id, key),
    constraint idempotency_keys_user_id_fk
        foreign key (user_id) references users(id) on delete restrict,
    constraint idempotency_keys_transaction_id_fkey
        foreign key (transaction_id) references transactions(id) on delete restrict
);

commit;