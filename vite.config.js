import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const eveUrl = String(env.VITE_DWELLA_EVE_URL ?? env.DWELLA_EVE_URL ?? "http://127.0.0.1:3000").trim();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      proxy: {
        "/dwella/agent": {
          target: eveUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
