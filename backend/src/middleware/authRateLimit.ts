import { NextFunction, Request, Response } from "express";

const AUTH_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const AUTH_RATE_LIMIT_EMAIL_MAX_ATTEMPTS = 10;
const AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS = 30;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitBucket = {
  key: string;
  maxAttempts: number;
};

const attempts = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getRequestEmail(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;

  if (typeof email !== "string" || email.trim() === "") {
    return "missing-email";
  }

  return email.trim().toLowerCase();
}

function getRateLimitBuckets(req: Request): RateLimitBucket[] {
  const clientIp = getClientIp(req);
  const email = getRequestEmail(req);

  return [
    {
      key: `auth-ip:${clientIp}`,
      maxAttempts: AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS,
    },
    {
      key: `auth-ip-email:${clientIp}:${email}`,
      maxAttempts: AUTH_RATE_LIMIT_EMAIL_MAX_ATTEMPTS,
    },
  ];
}

function cleanUpExpiredAttempts(now: number) {
  if (now - lastCleanupAt < AUTH_RATE_LIMIT_WINDOW_MS) return;
  for (const [key, entry] of attempts.entries()) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }

  lastCleanupAt = now;
}

function consumeAttempt(bucket: RateLimitBucket, now: number): boolean {
  const entry = attempts.get(bucket.key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(bucket.key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= bucket.maxAttempts) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();

  cleanUpExpiredAttempts(now);

  const allowed = getRateLimitBuckets(req).every((bucket) =>
    consumeAttempt(bucket, now),
  );

  if (!allowed) {
    res.status(429).json({
      error: "Too many auth attempts. Please try again later.",
    });
    return;
  }

  next();
}

export function resetAuthRateLimitForTests() {
  attempts.clear();
  lastCleanupAt = 0;
}
