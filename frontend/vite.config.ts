import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/applications": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass(req) {
          const accept = req.headers.accept ?? "";

          if (accept.includes("text/html")) {
            return "/index.html";
          }
        },
      },
    },
  },
});
