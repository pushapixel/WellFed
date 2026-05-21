// WellFed API — server.js
// Deploy to Railway. Required env vars:
//   DATABASE_URL      — auto-injected when you link a Postgres service
//   GOOGLE_CLIENT_ID  — from Google Cloud Console (see GOOGLE_SETUP.md)
//
// This server does two things:
//   1. Serves the built React frontend from ./dist (all non-API routes)
//   2. Handles all /api/* routes for data

import express  from "express";
import cors     from "cors";
import pg       from "pg";
import path     from "path";
import crypto   from "crypto";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool }  = pg;
const app    = express();
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const PORT   = process.env.PORT || 3001;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Frontend is served from the same origin, so CORS is only needed for
// local development. Allow localhost origins for dev convenience.
app.use(cors({
  origin: (origin, cb) => {
    const allowed = ["http://localhost:5173", "http://localhost:3000"];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    // Same-origin requests from Railway have no origin — always allow
    cb(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// ── Serve built frontend ──────────────────────────────────────────────────────
// Vite builds to ./dist — serve it as static files.
// Any route that isn't an API route falls through to index.html (SPA routing).
app.use(express.static(path.join(__dirname, "dist")));

// ── helpers ───────────────────────────────────────────────────────────────────
const q = (text, params) => pool.query(text, params);

// ── Session helpers ───────────────────────────────────────────────────────────
const SESSION_DAYS = 30;

function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createSession(userId) {
  const token = makeSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await q(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expires]
  );
  return token;
}

// ── Auth middleware ───────────────────────────────────────────────────────────
// Accepts: Authorization: Bearer <session_token>  (stored in localStorage, 30d)
// Falls back to Google ID token verification on first sign-in.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = header.slice(7);

  // ── Try session token first (64 hex chars) ────────────────────────────────
  if (/^[0-9a-f]{64}$/.test(token)) {
    const { rows: [session] } = await q(
      `SELECT s.id, s.expires_at, u.id AS uid, u.email, u.name, u.avatar_url, u.admin_yn
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [token]
    );
    if (!session) return res.status(401).json({ error: "Invalid session" });
    if (new Date(session.expires_at) < new Date()) {
      await q("DELETE FROM sessions WHERE id = $1", [token]);
      return res.status(401).json({ error: "Session expired" });
    }
    req.user = { id: session.uid, email: session.email, name: session.name,
                 avatar_url: session.avatar_url, admin_yn: session.admin_yn };
    return next();
  }

  // ── Fall back to Google ID token (first sign-in) ──────────────────────────
  try {
    const ticket = await client.verifyIdToken({
      idToken:  token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { rows: [user] } = await q(
      `INSERT INTO users (google_id, email, name, avatar_url, last_seen)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (google_id) DO UPDATE
         SET last_seen  = NOW(),
             email      = EXCLUDED.email,
             name       = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url
       RETURNING id, email, name, avatar_url, admin_yn`,
      [payload.sub, payload.email, payload.name, payload.picture]
    );
    req.user = user;
    // Create a 30-day session and attach it so /me can return it
    req.newSessionToken = await createSession(user.id);
    next();
  } catch (e) {
    console.error("Auth error:", e.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── AUTH — /me ────────────────────────────────────────────────────────────────
// First call after Google sign-in: verifies Google token, creates session,
// returns user + sessionToken so the frontend can store it.
// Subsequent calls use the session token directly.
app.get("/me", requireAuth, (req, res) => {
  res.json({
    ...req.user,
    // Only included on first sign-in (Google token path)
    ...(req.newSessionToken ? { sessionToken: req.newSessionToken } : {}),
  });
});

// ── DELETE /session — sign out, invalidate session token ─────────────────────
app.delete("/session", requireAuth, async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await q("DELETE FROM sessions WHERE id = $1", [token]);
  }
  res.json({ ok: true });
});

// ── FOODS ─────────────────────────────────────────────────────────────────────
app.get("/foods", requireAuth, async (req, res) => {
  const { rows } = await q(
    "SELECT id, name FROM foods WHERE user_id = $1 ORDER BY name",
    [req.user.id]
  );
  res.json(rows);
});

app.post("/foods", requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const { rows } = await q(
    `INSERT INTO foods (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [req.user.id, name.trim()]
  );
  res.json(rows[0]);
});

// ── SYMPTOMS ──────────────────────────────────────────────────────────────────
app.get("/symptoms", requireAuth, async (_req, res) => {
  // Global list — no user filter
  const { rows } = await q("SELECT id, name FROM symptoms ORDER BY name");
  res.json(rows);
});

app.post("/symptoms", requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const { rows } = await q(
    `INSERT INTO symptoms (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [name.trim()]
  );
  res.json(rows[0]);
});

// ── MEALS ─────────────────────────────────────────────────────────────────────
app.get("/meals", requireAuth, async (req, res) => {
  const since = req.query.since || "1970-01-01";
  const { rows } = await q(
    `SELECT m.id, m.eaten_at AS ts, m.rating,
            COALESCE(json_agg(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]') AS foods,
            COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '[]') AS symptoms
     FROM meals m
     LEFT JOIN meal_foods   mf ON mf.meal_id   = m.id
     LEFT JOIN foods         f  ON f.id         = mf.food_id
     LEFT JOIN meal_symptoms ms ON ms.meal_id   = m.id
     LEFT JOIN symptoms      s  ON s.id         = ms.symptom_id
     WHERE m.user_id = $1 AND m.eaten_at >= $2
     GROUP BY m.id
     ORDER BY m.eaten_at DESC`,
    [req.user.id, since]
  );
  res.json(rows);
});

app.post("/meals", requireAuth, async (req, res) => {
  const { foods = [], eaten_at } = req.body;
  if (!foods.length) return res.status(400).json({ error: "foods required" });

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    const { rows: [meal] } = await dbClient.query(
      `INSERT INTO meals (user_id, eaten_at) VALUES ($1, $2)
       RETURNING id, eaten_at AS ts, rating`,
      [req.user.id, eaten_at || new Date().toISOString()]
    );

    for (const name of foods) {
      const { rows: [food] } = await dbClient.query(
        `INSERT INTO foods (user_id, name) VALUES ($1, $2)
         ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [req.user.id, name.trim()]
      );
      await dbClient.query(
        `INSERT INTO meal_foods (meal_id, food_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [meal.id, food.id]
      );
    }

    await dbClient.query("COMMIT");
    res.json({ ...meal, foods, symptoms: [] });
  } catch (e) {
    await dbClient.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "database error" });
  } finally {
    dbClient.release();
  }
});

app.patch("/meals/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating, symptoms = [], foods } = req.body;

  const { rows: [owned] } = await q(
    "SELECT id FROM meals WHERE id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (!owned) return res.status(404).json({ error: "Meal not found" });

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    // Update rating and/or timestamp in one statement
    const setClauses = [];
    const setParams = [];
    if (rating !== undefined) {
      setParams.push(rating);
      setClauses.push(`rating = $${setParams.length}`);
    }
    if (req.body.ts) {
      setParams.push(req.body.ts);
      setClauses.push(`eaten_at = $${setParams.length}`);
    }
    if (setClauses.length > 0) {
      setParams.push(id);
      await dbClient.query(
        `UPDATE meals SET ${setClauses.join(", ")} WHERE id = $${setParams.length}`,
        setParams
      );
    }

    // Optionally update foods (used by "add to last meal")
    if (foods && foods.length > 0) {
      await dbClient.query("DELETE FROM meal_foods WHERE meal_id = $1", [id]);
      for (const name of foods) {
        const { rows: [food] } = await dbClient.query(
          `INSERT INTO foods (user_id, name) VALUES ($1, $2)
           ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [req.user.id, name.trim()]
        );
        await dbClient.query(
          `INSERT INTO meal_foods (meal_id, food_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, food.id]
        );
      }
    }

    await dbClient.query("DELETE FROM meal_symptoms WHERE meal_id = $1", [id]);
    for (const name of symptoms) {
      const { rows: [sym] } = await dbClient.query(
        `INSERT INTO symptoms (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name.trim()]
      );
      await dbClient.query(
        `INSERT INTO meal_symptoms (meal_id, symptom_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, sym.id]
      );
    }

    await dbClient.query("COMMIT");

    const { rows: [meal] } = await q(
      `SELECT m.id, m.eaten_at AS ts, m.rating,
              COALESCE(json_agg(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL), '[]') AS foods,
              COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '[]') AS symptoms
       FROM meals m
       LEFT JOIN meal_foods   mf ON mf.meal_id = m.id
       LEFT JOIN foods         f ON f.id = mf.food_id
       LEFT JOIN meal_symptoms ms ON ms.meal_id = m.id
       LEFT JOIN symptoms      s ON s.id = ms.symptom_id
       WHERE m.id = $1 GROUP BY m.id`,
      [id]
    );
    res.json(meal);
  } catch (e) {
    await dbClient.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "database error" });
  } finally {
    dbClient.release();
  }
});

app.delete("/meals/:id", requireAuth, async (req, res) => {
  await q(
    "DELETE FROM meals WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// ── SUGGESTIONS ───────────────────────────────────────────────────────────────
// GET /suggestions — returns all suggestions, newest first, with submitter name
app.get("/suggestions", requireAuth, async (_req, res) => {
  const { rows } = await q(
    `SELECT s.id, s.text, s.created_at, u.name
     FROM suggestions s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  );
  res.json(rows);
});

// POST /suggestions  body: { text }
app.post("/suggestions", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "text required" });
  const { rows: [s] } = await q(
    `INSERT INTO suggestions (user_id, text) VALUES ($1, $2)
     RETURNING id, text, created_at`,
    [req.user.id, text.trim()]
  );
  res.json({ ...s, name: req.user.name });
});

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
// Any route not matched above (not an API route) serves the React app.
// This allows React Router to handle client-side navigation if needed.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`WellFed running on :${PORT}`));
