-- Data benchmark: sesuaikan id akun (di sini 4) dengan hasil insert accounts
insert into users (email, password_hash) values ('bench@t.com', 'x');
insert into accounts (user_id) select id from users where email = 'bench@t.com';

insert into transactions (type, status, amount, created_by)
select 'topup', 'success', 10, (select id from users where email = 'bench@t.com')
from generate_series(1, 500000);

insert into ledger_entries (transaction_id, account_id, direction, amount)
select id, 4, 'credit', 10 from transactions;

analyze ledger_entries;