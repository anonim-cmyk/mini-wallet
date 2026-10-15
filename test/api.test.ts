import { afterAll } from "vitest";
import request from "supertest";
import { pool } from "../src/db";
import { describe } from "vitest";
import { it } from "vitest";
import { app } from "../src/app";
import { expect } from "vitest";
import { resetDb } from "./helpers";
import { beforeEach } from "vitest";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("Auth", () => {
  it("register lalu login -> dapat token", async () => {
    const reg = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });

    expect(reg.status).toBe(201);

    const login = await request(app)
      .post("/login")
      .send({ email: "a@x.com", password: "rahasia123" });

    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe("string");
  });

  it("register email sama dua kali -> 409", async () => {
    const first = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/register")
      .send({ email: "a@x.com", password: "rahasia123" });
    expect(second.status).toBe(409);
  });
});

describe("API dasar", () => {
  it("GET /health -> 200", async () => {
    const result = await request(app).get("/health");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });

  it("GET /history -> 401", async () => {
    const result = await request(app).get("/history");
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Unauthorized" });
  });
});
