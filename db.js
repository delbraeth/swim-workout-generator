// db.js — MariaDB connection pool for vero_swimgen.
//
// Env vars (all required for the pool to initialize; if any is missing the
// module exports a no-op state and the app keeps reading from workouts.json):
//   DB_HOST      — host of the MariaDB VM (e.g., 209.74.83.148)
//   DB_PORT      — port (default 3306)
//   DB_USER      — MariaDB user (e.g., swimapp)
//   DB_PASSWORD  — that user's password
//   DB_NAME      — database name (default vero_swimgen)
//
// TLS is required at the server side (REQUIRE SSL on the user). We pass
// `ssl: { rejectUnauthorized: false }` for now — encrypts the wire but does
// not validate the server's self-signed cert chain. Hardening pass: bundle
// the CA cert and set rejectUnauthorized:true. Tracked in EXPANSION_ROADMAP.md.

import { createPool } from "mariadb";

const {
  DB_HOST,
  DB_PORT     = "3306",
  DB_USER,
  DB_PASSWORD,
  DB_NAME     = "vero_swimgen",
} = process.env;

export const dbConfigured = Boolean(DB_HOST && DB_USER && DB_PASSWORD);

export const pool = dbConfigured
  ? createPool({
      host:            DB_HOST,
      port:            parseInt(DB_PORT, 10),
      user:            DB_USER,
      password:        DB_PASSWORD,
      database:        DB_NAME,
      connectionLimit: 10,                    // conservative; MariaDB max_connections=151 shared
      ssl:             { rejectUnauthorized: false },   // encrypted, no cert chain check (self-signed)
    })
  : null;

// Lightweight boot-time check. Returns { configured, ok, ssl } or throws.
export async function pingDb() {
  if (!pool) return { configured: false };
  const conn = await pool.getConnection();
  try {
    const [row] = await conn.query("SELECT 1 AS ok, @@have_ssl AS ssl, current_user() AS who");
    return { configured: true, ok: row.ok, ssl: row.ssl, who: row.who };
  } finally {
    conn.release();
  }
}
