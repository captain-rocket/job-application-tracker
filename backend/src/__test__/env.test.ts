import { getAuthEnv, getDbEnv, getPublicAccessEnv } from "../config/env";

describe("env validation", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalDbPassword = process.env.DB_PASSWORD;
  const originalPostgresPassword = process.env.POSTGRES_PASSWORD;
  const originalPublicRegistrationEnabled =
    process.env.PUBLIC_REGISTRATION_ENABLED;
  const originalPublicDemoUserEmail = process.env.PUBLIC_DEMO_USER_EMAIL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.DB_PASSWORD = originalDbPassword;
    if (originalPostgresPassword === undefined) {
      delete process.env.POSTGRES_PASSWORD;
    } else {
      process.env.POSTGRES_PASSWORD = originalPostgresPassword;
    }
    if (originalPublicRegistrationEnabled === undefined) {
      delete process.env.PUBLIC_REGISTRATION_ENABLED;
    } else {
      process.env.PUBLIC_REGISTRATION_ENABLED =
        originalPublicRegistrationEnabled;
    }
    if (originalPublicDemoUserEmail === undefined) {
      delete process.env.PUBLIC_DEMO_USER_EMAIL;
    } else {
      process.env.PUBLIC_DEMO_USER_EMAIL = originalPublicDemoUserEmail;
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

  describe("getPublicAccessEnv", () => {
    test("defaults public registration to false in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.PUBLIC_REGISTRATION_ENABLED;

      expect(getPublicAccessEnv()).toMatchObject({
        publicRegistrationEnabled: false,
      });
    });

    test("defaults public registration to true outside production", () => {
      process.env.NODE_ENV = "development";
      delete process.env.PUBLIC_REGISTRATION_ENABLED;

      expect(getPublicAccessEnv()).toMatchObject({
        publicRegistrationEnabled: true,
      });
    });

    test("normalizes public demo user email", () => {
      process.env.PUBLIC_DEMO_USER_EMAIL = " Demo@Example.COM ";

      expect(getPublicAccessEnv()).toMatchObject({
        publicDemoUserEmail: "demo@example.com",
      });
    });

    test("rejects invalid public demo user email", () => {
      process.env.PUBLIC_DEMO_USER_EMAIL = "not-an-email";

      expect(() => getPublicAccessEnv()).toThrow(
        "Environment variable PUBLIC_DEMO_USER_EMAIL must be a valid email address",
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
