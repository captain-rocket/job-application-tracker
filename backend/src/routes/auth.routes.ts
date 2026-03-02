import { Router } from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth";

function signToken(user: { id: string; role: "user" | "admin" }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT no confiured");

  return jwt.sign({ sub: user.id, role: user.role }, secret, {
    expiresIn: "1hr",
  });
}

export function authRoutes(db: Pool) {
  const router = Router();

  router.post("/auth/register", async (req, res) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "password must be at least 8 characters" });

    try {
      const existing = await db.query("SELECT id FROM users WHERE email = $1", [
        email,
      ]);

      if (existing.rowCount && existing.rowCount > 0) {
        return res.status(409).json({ error: "email already in use" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const created = await db.query(
        `INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, 'user')
        RETURNING id, email, role, created_at`,
        [email, passwordHash],
      );

      const user = created.rows[0] as {
        id: string;
        email: string;
        role: "user" | "admin";
        created_at: string;
      };

      const token = signToken({ id: user.id, role: user.role });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json("registration failed");
    }
  });

  router.post("/auth/login", async (req, res) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    try {
      const result = await db.query(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        [email],
      );

      if (!result.rowCount)
        return res.status(401).json({ error: "Invalid credentials" });

      const row = result.rows[0] as {
        id: string;
        email: string;
        password_hash: string;
        role: "user" | "admin";
      };
      const authorized = await bcrypt.compare(password, row.password_hash);
      if (!authorized)
        return res.status(401).json({ error: "Invalid credentials" });

      const token = signToken({ id: row.id, role: row.role });

      res.json({
        user: {
          id: row.id,
          email: row.email,
          role: row.role,
        },
        token,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "login failed" });
    }
  });

  router.get("/auth/me", requireAuth, async (req, res) => {
    try {
      const me = await db.query(
        "SELECT id, email, role, created_at FROM users WHERE id = $1",
        [req.user!.id],
      );

      if (!me.rowCount)
        return res.status(404).json({ error: "user not found" });

      res.json({ user: me.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "failed to load user" });
    }
  });
  return router;
}
