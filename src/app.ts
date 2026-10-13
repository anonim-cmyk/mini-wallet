import express from "express";
import z from "zod";
import { getHistory } from "./wallet/history";

export const app = express();
app.use(express.json());

const historyQuery = z.object({
  accountId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
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
