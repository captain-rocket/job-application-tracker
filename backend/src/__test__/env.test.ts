import { getAuthEnv, getDbEnv } from "../config/env";

describe("env validation", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalDbPassword = process.env.DB_PASSWORD;
  const originalPostgresPassword = process.env.POSTGRES_PASSWORD;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.DB_PASSWORD = originalDbPassword;
    if (originalPostgresPassword === undefined) {
      delete process.env.POSTGRES_PASSWORD;
    } else {
      process.env.POSTGRES_PASSWORD = originalPostgresPassword;
    }
  });

  describe("getAuthEnv", () => {
    test("rejects documented placeholder secret in production", () => {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "<replace-with-32-character-secret>";

      expect(() => getAuthEnv()).toThrow(
        "JWT_SECRET is not strong enough for production",
      );
    });

    test("rejects previously published long placeholder secret in production", () => {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "replace-with-a-32-character-or-longer-secret";

      expect(() => getAuthEnv()).toThrow(
        "JWT_SECRET is not strong enough for production",
      );
    });
  });

  describe("getDbEnv", () => {
    test.each([
      "<replace-with-rds-password>",
      "replace-with-rds-password",
      "change-this-db-password",
      "changeme",
      "password",
    ])("rejects placeholder DB password '%s' in production", (dbPassword) => {
      process.env.NODE_ENV = "production";
      process.env.DB_PASSWORD = dbPassword;

      expect(() => getDbEnv()).toThrow(
        "DB_PASSWORD is not strong enough for production",
      );
    });

    test("does not require POSTGRES_PASSWORD when it is unset", () => {
      process.env.NODE_ENV = "production";
      process.env.DB_PASSWORD = "actual-strong-db-password";
      delete process.env.POSTGRES_PASSWORD;

      expect(getDbEnv()).toMatchObject({
        password: "actual-strong-db-password",
      });
    });

    test("ignores POSTGRES_PASSWORD for API DB validation", () => {
      process.env.NODE_ENV = "production";
      process.env.DB_PASSWORD = "actual-strong-db-password";
      process.env.POSTGRES_PASSWORD = "change-this-db-password";

      expect(getDbEnv()).toMatchObject({
        password: "actual-strong-db-password",
      });
    });
  });
});
