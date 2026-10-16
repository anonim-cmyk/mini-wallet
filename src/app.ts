import express from "express";
import z from "zod";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { getHistory } from "./wallet/history";
import { pool } from "./db";
import { isUniqueViolation } from "./db-errors";
import { requireAuth, type AuthedRequest } from "./auth";
import { transfer } from "./wallet/transfer";
import { DomainError } from "./wallet/errors";

export const app = express();
app.use(express.json());

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

const transferBody = z.object({
  toAccountId: z.number().int().positive(),
  amount: z.number().int().positive(),
});

app.get("/health", async (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/register", async (req, res) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }

  const { email, password } = parsed.data;
  const hash = await argon2.hash(password);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const u = await client.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash],
    );

    const userId = u.rows[0].id;

    await client.query(
      "INSERT INTO accounts (user_id, type) VALUES ($1, 'user')",
      [userId],
    );

    await client.query("COMMIT");

    return res.status(201).json(u.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error, "users_email_key")) {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    console.error(error);
    return res.status(500).json({ error: "Terjadi kesalahan" });
  } finally {
    client.release();
  }
});

app.post("/login", async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];

    const valid = user
      ? await argon2.verify(user.password_hash, password)
      : false;
    if (!valid) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    return res.json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Terjadi kesalahan" });
  }
});

// accountId diambil dari token (userId), bukan dari URL: menutup IDOR
app.get("/history", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = historyQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }
  const { limit, cursor } = parsed.data;

  try {
    const acc = await pool.query(
      "SELECT id FROM accounts WHERE user_id = $1 AND type = 'user' LIMIT 1",
      [req.userId],
    );
    if (acc.rows.length === 0) {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }
    const result = await getHistory(Number(acc.rows[0].id), limit, cursor);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Terjadi kesalahan" });
  }
});

app.post("/transfer", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = transferBody.safeParse(req.body);
  const key = req.header("Idempotency-Key");
  if (!parsed.success || !key) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }

  try {
    const acc = await pool.query(
      "SELECT id FROM accounts WHERE user_id = $1 AND type = 'user' LIMIT 1",
      [req.userId],
    );
    if (acc.rows.length === 0) {
      return res.status(404).json({ message: "Akun tidak ditemukan" });
    }
    const { toAccountId, amount } = parsed.data;

    const result = await transfer(
      Number(acc.rows[0].id),
      toAccountId,
      amount,
      key,
      req.userId!,
    );

    return res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return res.status(422).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan" });
  }
});
