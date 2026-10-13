import express from "express";

export const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  res.json({ message: "ok" });
});
