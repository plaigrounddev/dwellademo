import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const convexSiteUrl = String(
    env.VITE_CONVEX_SITE_URL ?? env.CONVEX_SITE_URL ?? deriveConvexSiteUrl(env.VITE_CONVEX_URL) ?? ""
  ).trim();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      proxy: convexSiteUrl
        ? {
            "/dwella/agent": {
              target: convexSiteUrl,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  };
});

function deriveConvexSiteUrl(convexUrl) {
  const cleanUrl = String(convexUrl ?? "").trim();
  if (!cleanUrl.includes(".convex.cloud")) return "";
  return cleanUrl.replace(".convex.cloud", ".convex.site");
}
