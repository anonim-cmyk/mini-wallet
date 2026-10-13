import express from "express";
import z from "zod";
import { getHistory } from "./wallet/history";
import argon2 from "argon2";
import { pool } from "./db";
import { isUniqueViolation } from "./db-errors";

export const app = express();
app.use(express.json());

const historyQuery = z.object({
  accountId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

app.get("/health", async (_req, res) => {
  res.json({ message: "ok" });
});

app.get("/history", async (req, res) => {
  const parsed = historyQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }

  const { accountId, limit, cursor } = parsed.data;
  const result = await getHistory(accountId, limit, cursor);
  res.json(result);
});

app.post("/register", async (req, res) => {
  const parsed = registerBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parameter tidak valid" });
  }

  const { email, password } = parsed.data;

  try {
    const hash = await argon2.hash(password);
    const u = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash],
    );
    await pool.query("INSERT INTO accounts (user_id) VALUES ($1)", [
      u.rows[0].id,
    ]);
    res.status(201).json(u.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error, "users_email_key")) {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    console.error(error);
    return res.status(500).json({ error: "Terjadi kesalahan" });
  }
});
