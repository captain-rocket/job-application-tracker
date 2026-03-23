import { getAuthEnv } from "../config/env";
import { Router } from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth, validateBody } from "../middleware";
import { loginBodySchema, registerBodySchema } from "../schemas/auth.schemas";

function signToken(user: { id: string; role: "user" | "admin" }) {
  let jwtSecret: string;
  try {
    jwtSecret = getAuthEnv().jwtSecret;
  } catch (error) {
    throw new Error("JWT not configured");
  }

  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    expiresIn: "1h",
  });
}

export function authRoutes(db: Pool) {
  const router = Router();

  router.post(
    "/auth/register",
    validateBody(registerBodySchema),
    async (req, res, next) => {
      const { email, password } = req.body as {
        email: string;
        password: string;
      };

      try {
        const existing = await db.query(
          "SELECT id FROM users WHERE email = $1",
          [email],
        );

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
        next(error);
      }
    },
  );

  router.post(
    "/auth/login",
    validateBody(loginBodySchema),
    async (req, res, next) => {
      const { email, password } = req.body as {
        email: string;
        password: string;
      };

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
        next(error);
      }
    },
  );

  router.get("/auth/me", requireAuth, async (req, res, next) => {
    try {
      const me = await db.query(
        "SELECT id, email, role, created_at FROM users WHERE id = $1",
        [req.user!.id],
      );

      if (!me.rowCount)
        return res.status(404).json({ error: "user not found" });

      res.json({ user: me.rows[0] });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
