begin;

alter table accounts
    add column type text not null default 'user',
    add constraint accounts_type_check check (type in ('user', 'system'));

alter table accounts
    alter column user_id drop not null;

alter table accounts
    drop constraint account_balances_non_negative,
    add constraint accounts_balance_non_negative
        check (type = 'system' or balance >= 0);

alter table accounts
    add constraint accounts_owner_check
        check ((type = 'user') = (user_id is not null));

insert into accounts (type) values ('system');

commit;