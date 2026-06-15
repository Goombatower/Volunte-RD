const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { Pool } = require("pg");
const { Resend } = require("resend");


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

const resend = new Resend(process.env.re_HFgR1eNQ_NmeFGcBQcKGeAPbQPaC8S2gB);

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(64) UNIQUE NOT NULL,
      email      VARCHAR(64) UNIQUE NOT NULL,
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
      email_sent  BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS helpers     INTEGER[] NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS max_helpers INTEGER   NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE postings ADD COLUMN IF NOT EXISTS author_id   INTEGER   REFERENCES users(id)`);
  console.log("Database ready.");
}


function startEventEmailCron() {
  setInterval(async () => {
    try {
      const result = await pool.query(`
        SELECT * FROM postings
        WHERE start_date <= NOW() + INTERVAL '1 hour'
          AND start_date >= NOW() + INTERVAL '1 hour' - INTERVAL '1 minute'
          AND email_sent = FALSE
          AND array_length(helpers, 1) > 0
      `);
 
      for (const posting of result.rows) {
        const helperResult = await pool.query(
          `SELECT email, username FROM users WHERE id = ANY($1) AND email IS NOT NULL`,
          [posting.helpers]
        );
 
        if (helperResult.rows.length === 0) continue;
 
        const emailList = helperResult.rows.map(u => u.email);
 
        await resend.emails.send({
          from: "Volunte-RD <noreply@yourdomain.com>",
          to:   emailList,
          subject: `Your volunteering event is starting soon: ${posting.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <h2 style="color: #2d6a4f;">Your event is starting soon!</h2>
              <p>Hi there,</p>
              <p>The volunteering opportunity you signed up for is starting in 1 hour:</p>
              <div style="background: #d8f3dc; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 8px; color: #1a2e1e;">${posting.title}</h3>
                <p style="margin: 0; color: #4a6355;">${posting.description}</p>
              </div>
              <p>Good luck and thank you for volunteering!</p>
              <p style="color: #8aab96; font-size: 0.85rem;">The Volunte-RD team</p>
            </div>
          `,
        });
 
        // Mark as sent so we don't send again
        await pool.query(
          "UPDATE postings SET email_sent = TRUE WHERE id = $1",
          [posting.id]
        );
 
        console.log(`Email sent for posting ${posting.id} (${posting.title}) to ${emailList.length} helpers`);
      }
    } catch (err) {
      console.error("CRON EMAIL ERROR:", err.message);
    }
  }, 60 * 1000); // runs every 60 seconds
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