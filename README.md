# mini-wallet

![test](https://github.com/ilhamsyahdan/mini-wallet/actions/workflows/test.yml/badge.svg)

Mini e-wallet untuk mempelajari **konsistensi data** pada operasi uang:
transaksi database, locking, ledger double-entry, dan idempotency.
Ini proyek belajar, **bukan sistem pembayaran sungguhan**.

## Cakupan

- Top-up (simulasi) dan transfer antar akun
- Ledger double-entry sebagai sumber kebenaran saldo
- Aman terhadap request bersamaan (concurrency) dan request ulang (idempotency)
- HTTP API (Express) dengan register, login (JWT), riwayat, dan transfer
- Belum ada frontend

## Teknologi

Node.js, TypeScript, PostgreSQL 16 (Docker), `pg`, Vitest.

## Desain data

| Tabel              | Fungsi                                                           |
| ------------------ | ---------------------------------------------------------------- |
| `users`            | Identitas pengguna                                               |
| `accounts`         | Tempat saldo. Tipe `user` atau `system` (lawan transaksi top-up) |
| `transactions`     | Satu baris per kejadian (topup / transfer)                       |
| `ledger_entries`   | Dua baris per transaksi: debit satu akun, kredit akun lain       |
| `idempotency_keys` | Mencegah request ulang diproses dua kali, per `(user_id, key)`   |

Keputusan utama:

- **Uang disimpan sebagai `bigint`**, bukan float.
- **Ledger adalah sumber kebenaran**; `accounts.balance` adalah cache untuk baca cepat. Jumlah kredit dikurangi debit per akun harus sama dengan `balance` (diperiksa di test).
- **Akun sistem** boleh bersaldo minus, sehingga top-up tetap double-entry dan total semua saldo selalu 0.
- **`ON DELETE RESTRICT`** pada semua foreign key: catatan uang tidak boleh hilang karena baris induk dihapus.
- **`CHECK (balance >= 0)`** untuk akun user sebagai pengaman terakhir di level database.

## Cara kerja transfer

Seluruhnya dalam satu transaksi database:

1. Catat idempotency key (jika sudah ada, kembalikan hasil lama)
2. Kunci kedua akun dengan `SELECT ... ORDER BY id FOR UPDATE` (urut id agar tidak deadlock)
3. Cek saldo dari baris yang sudah terkunci
4. Insert transaksi dan dua entri ledger
5. Update saldo, simpan `transaction_id` pada key, `COMMIT`

Kegagalan apa pun menghasilkan `ROLLBACK`, termasuk pencatatan key, sehingga retry dengan key yang sama diproses ulang.

## Bukti: test yang terbukti bisa gagal

Setiap test diuji dua kali: dengan kode benar (hijau) dan dengan pengaman sengaja
dimatikan (merah), supaya terbukti test itu benar-benar menjaga sesuatu.

| Pengaman                     | Dimatikan dengan                               | Hasil test                                                         | Artinya                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOR UPDATE` pada `transfer` | hapus `FOR UPDATE` dari SELECT                 | gagal: `violates check constraint "accounts_balance_non_negative"` | Tanpa lock, transfer membaca saldo basi dan lolos cek di aplikasi. Baru ditolak oleh constraint database. Uang tetap aman, tapi hanya karena pengaman terakhir. |
| Replay idempotency key       | `if (false)` menggantikan `ins.rowCount === 0` | gagal: `expected 10 to be 20`                                      | Request ulang diperlakukan sebagai transfer baru; 20 request menguras saldo (10 sukses).                                                                        |
| Cek `request_hash`           | `if (false)` menggantikan pengecekan hash      | gagal: `promise resolved ... instead of rejecting`                 | Key sama dengan jumlah berbeda dianggap replay sah; klien mengira 500 terkirim padahal hanya 100.                                                               |
| `ROLLBACK` saat gagal        | diganti `COMMIT`                               | gagal: `expected true to be undefined`                             | Kegagalan ikut di-commit bersama key-nya; retry dianggap replay dan key "hangus".                                                                               |

Dengan kode asli: 100 transfer paralel @100 dari saldo 1000 menghasilkan tepat 10 sukses
dan 90 "Saldo tidak cukup"; 20 request berkey sama menghasilkan satu pemotongan saldo.

## Performa riwayat: keyset vs OFFSET

Diuji pada 500.006 entri ledger untuk satu akun, mengambil 20 baris dari posisi
sekitar baris ke-310.000 (`EXPLAIN (ANALYZE, BUFFERS)`, PostgreSQL 16, lokal).

| Metode                       | Execution Time | Halaman dibaca |
| ---------------------------- | -------------- | -------------- |
| `LIMIT 20 OFFSET 310013`     | 288 ms         | 4.894          |
| `WHERE id < cursor LIMIT 20` | 2,1 ms         | 4              |

`OFFSET` harus membaca dan membuang 310.033 baris dulu. Keyset langsung lompat
ke posisi cursor lewat indeks, sehingga waktunya tidak bertambah di halaman dalam.

Batasan benchmark: hampir semua baris milik satu akun, jadi planner memakai
`ledger_entries_pkey` (bukan indeks `(account_id, id DESC)`). Data yang tersebar
ke banyak akun belum diuji. Angka bergantung pada mesin dan cache (semua `shared hit`).

## API

| Endpoint                      | Auth   | Fungsi                                                         |
| ----------------------------- | ------ | -------------------------------------------------------------- |
| `GET /health`                 | tidak  | Cek server                                                     |
| `POST /register`              | tidak  | Daftar (password di-hash argon2), otomatis membuat akun        |
| `POST /login`                 | tidak  | Mengembalikan JWT (berlaku 1 jam)                              |
| `GET /history?limit=&cursor=` | Bearer | Riwayat akun milik user, keyset pagination                     |
| `POST /transfer`              | Bearer | Body `{ toAccountId, amount }`, header `Idempotency-Key` wajib |

Prinsip keamanan: identitas (`userId`, akun pengirim) selalu diambil dari token,
bukan dari input client, sehingga user tidak bisa membaca atau memakai akun orang lain (IDOR ditutup).
Bukti: test supertest di `test/api.test.ts`.

Menjalankan server: `npx tsx src/server.ts` (butuh `JWT_SECRET` di `.env`).

## Menjalankan

```bash
cp .env.example .env            # isi password lokal
docker compose up -d
for f in migrations/*.sql; do
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U wallet_admin -d wallet < "$f"
done
# database uji
docker compose exec db psql -U wallet_admin -d postgres -c "create database wallet_test;"
for f in migrations/*.sql; do
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U wallet_admin -d wallet_test < "$f"
done
npm install
npm test
```

Isi `TEST_DATABASE_URL` di `.env` agar mengarah ke `wallet_test`.

## Batasan yang diketahui

- Belum ada endpoint top-up; `topUp` baru berupa fungsi (teruji lewat skrip)
- Error domain di `/transfer` dipetakan lewat pencocokan teks pesan (rapuh), belum kelas error
- Celah timing kecil di login saat email tidak terdaftar
- Token berlaku 1 jam, belum ada refresh token, rate limiting, atau audit log
- Migration masih manual (belum ada migration runner)
- Belum ada test deadlock dua arah
- Satu user DB dengan hak penuh (belum least privilege)
