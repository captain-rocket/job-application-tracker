import {
  DB_CONNECTION_TIMEOUT_MS,
  getPoolConfig,
  verifyDbConnection,
} from "../config/db";

describe("db config", () => {
  describe("getPoolConfig", () => {
    test("sets a bounded connection timeout", () => {
      expect(getPoolConfig()).toMatchObject({
        connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
      });
    });
  });

  describe("verifyDbConnection", () => {
    test("checks connectivity with a simple query", async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });

      await verifyDbConnection({ query } as any);

      expect(query).toHaveBeenCalledWith("SELECT 1");
    });

    test("surfaces connection failures", async () => {
      const error = new Error("password authentication failed");
      const query = jest.fn().mockRejectedValue(error);

      await expect(verifyDbConnection({ query } as any)).rejects.toThrow(
        "password authentication failed",
      );
    });
  });
});
