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
      author_id   INTEGER      REFERENCES users(id),
      helpers     INTEGER[]    NOT NULL DEFAULT '{}',
      max_helpers INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS helpers     INTEGER[] NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS max_helpers INTEGER   NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS author_id   INTEGER   REFERENCES users(id)`);
  console.log("Database ready.");
}

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

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required." });

    const result = await pool.query(
      "SELECT id, password, organizer, admin FROM users WHERE username = $1", [username]
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

app.get("/api/postings", async (req, res) => {
  try {
    const { search } = req.query;
    const baseQuery = `
      SELECT p.*, u.username AS author_username
      FROM postings p
      LEFT JOIN users u ON u.id = p.author_id
    `;
    let rows;
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      const result = await pool.query(
        baseQuery + `
        WHERE LOWER(p.title) LIKE $1
           OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE LOWER(t) LIKE $1)
        ORDER BY p.created_at DESC`, [term]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(baseQuery + " ORDER BY p.created_at DESC");
      rows = result.rows;
    }
    return res.json(rows);
  } catch (err) {
    console.error("GET POSTINGS ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.post("/api/postings", async (req, res) => {
  try {
    const { title, tags, start_date, description, author, max_helpers } = req.body;

    if (!title || !start_date || !description || !author)
      return res.status(400).json({ error: "All fields are required." });

    const userResult = await pool.query(
      "SELECT id, organizer FROM users WHERE username = $1", [author]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found." });
    if (!userResult.rows[0].organizer)
      return res.status(403).json({ error: "Only organizers can create postings." });

    const authorId = userResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO postings (title, tags, start_date, description, author, author_id, max_helpers)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, tags || [], start_date, description, author, authorId, max_helpers || 0]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("CREATE POSTING ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.post("/api/postings/:id/join", async (req, res) => {
  try {
    const postingId = parseInt(req.params.id);
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ error: "userId is required." });

    const postResult = await pool.query(
      "SELECT helpers, max_helpers FROM postings WHERE id = $1", [postingId]
    );
    if (postResult.rows.length === 0)
      return res.status(404).json({ error: "Posting not found." });

    const { helpers, max_helpers } = postResult.rows[0];

    if (helpers.includes(userId))
      return res.status(409).json({ error: "You have already joined this posting." });
    if (max_helpers > 0 && helpers.length >= max_helpers)
      return res.status(409).json({ error: "This posting is already full." });

    const updated = await pool.query(
      "UPDATE postings SET helpers = array_append(helpers, $1) WHERE id = $2 RETURNING *",
      [userId, postingId]
    );
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error("JOIN ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.delete("/api/postings/:id", async (req, res) => {
  try {
    const postingId = parseInt(req.params.id);
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ error: "userId is required." });

    const postResult = await pool.query(
      "SELECT author_id FROM postings WHERE id = $1", [postingId]
    );
    if (postResult.rows.length === 0)
      return res.status(404).json({ error: "Posting not found." });

    const authorId = postResult.rows[0].author_id;

    const userResult = await pool.query(
      "SELECT admin FROM users WHERE id = $1", [userId]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found." });

    const isAdmin = userResult.rows[0].admin;

    if (authorId !== userId && !isAdmin)
      return res.status(403).json({ error: "You do not have permission to delete this posting." });

    await pool.query("DELETE FROM postings WHERE id = $1", [postingId]);
    return res.json({ message: "Posting deleted." });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as time, current_database() as db");
    return res.json({ status: "ok", ...result.rows[0] });
  } catch (err) {
    return res.status(500).json({ status: "db_error", error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch((err) => { console.error("Failed to initialise database:", err); process.exit(1); });