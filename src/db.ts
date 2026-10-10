import "dotenv/config";
import { Pool } from "pg";

const connectionString =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export const pool = new Pool({ connectionString });
