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

// ── Auth middleware ───────────────────────────────────────────────────────────
// Every protected route calls this first.
// The frontend sends:  Authorization: Bearer <google_id_token>
// We verify it with Google, then look up (or create) the user row.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = header.slice(7);
  try {
    const ticket = await client.verifyIdToken({
      idToken:  token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // Upsert user — creates on first sign-in, updates last_seen every time
    const { rows: [user] } = await q(
      `INSERT INTO users (google_id, email, name, avatar_url, last_seen)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (google_id) DO UPDATE
         SET last_seen  = NOW(),
             email      = EXCLUDED.email,
             name       = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url
       RETURNING id, email, name, avatar_url`,
      [payload.sub, payload.email, payload.name, payload.picture]
    );
    req.user = user;  // available in all route handlers as req.user
    next();
  } catch (e) {
    console.error("Auth error:", e.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── AUTH — /me ────────────────────────────────────────────────────────────────
// Frontend calls this on load to confirm the token is valid and get user info
app.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
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
  const { rating, symptoms = [] } = req.body;

  // Confirm this meal belongs to the requesting user
  const { rows: [owned] } = await q(
    "SELECT id FROM meals WHERE id = $1 AND user_id = $2",
    [id, req.user.id]
  );
  if (!owned) return res.status(404).json({ error: "Meal not found" });

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    if (rating !== undefined) {
      await dbClient.query("UPDATE meals SET rating = $1 WHERE id = $2", [rating, id]);
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

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
// Any route not matched above (not an API route) serves the React app.
// This allows React Router to handle client-side navigation if needed.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`WellFed running on :${PORT}`));
