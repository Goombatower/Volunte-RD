
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { Pool } = require("pg");
 
const app = express();
app.use(express.json());
app.use(cors({
  origin: "https://volunte-rd.netlify.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
 
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(64) UNIQUE NOT NULL,
      password   TEXT        NOT NULL,
      organizer  BOOLEAN     NOT NULL DEFAULT FALSE,
      admin      BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS postings (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(100) NOT NULL,
      tags        TEXT[]       NOT NULL DEFAULT '{}',
      start_date  DATE         NOT NULL,
      description VARCHAR(200) NOT NULL,
      comments    INTEGER,
      author      VARCHAR(64)  NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  console.log("Database ready.");
}
 
// ── REGISTER ─────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required." });
 
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Username already taken." });
 
    const hashed = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashed]);
    return res.status(201).json({ message: "Account created successfully." });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});
 
// ── LOGIN ─────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required." });
 
    const result = await pool.query(
      "SELECT id, password, organizer, admin FROM users WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid username or password." });
 
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid username or password." });
 
    return res.json({
      message:   "Login successful.",
      userId:    user.id,
      organizer: user.organizer,
      admin:     user.admin,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});
 
// ── GET POSTINGS ──────────────────────────────────────────
app.get("/api/postings", async (req, res) => {
  try {
    const { search } = req.query;
    let rows;
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      const result = await pool.query(
        `SELECT * FROM postings
         WHERE LOWER(title) LIKE $1
            OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE LOWER(t) LIKE $1)
         ORDER BY created_at DESC`,
        [term]
      );
      rows = result.rows;
    } else {
      const result = await pool.query("SELECT * FROM postings ORDER BY created_at DESC");
      rows = result.rows;
    }
    return res.json(rows);
  } catch (err) {
    console.error("GET POSTINGS ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});
 
// ── CREATE POSTING ────────────────────────────────────────
app.post("/api/postings", async (req, res) => {
  try {
    const { title, tags, start_date, description, author } = req.body;
 
    if (!title || !start_date || !description || !author)
      return res.status(400).json({ error: "All fields are required." });
 
    const userResult = await pool.query(
      "SELECT organizer FROM users WHERE username = $1",
      [author]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found." });
    if (!userResult.rows[0].organizer)
      return res.status(403).json({ error: "Only organizers can create postings." });
 
    const result = await pool.query(
      `INSERT INTO postings (title, tags, start_date, description, author)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, tags || [], start_date, description, author]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE POSTING ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});
 
// ── TEST ROUTE ────────────────────────────────────────────
// Visit /api/test in browser to confirm the server is live and DB is reachable
app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as time, current_database() as db");
    return res.json({ status: "ok", ...result.rows[0] });
  } catch (err) {
    return res.status(500).json({ status: "db_error", error: err.message });
  }
});
 
// ── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch((err) => { console.error("Failed to initialise database:", err); process.exit(1); });
 
