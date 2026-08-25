import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: { injectionPoint: "self.__WB_MANIFEST" },
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "MEXUZ CRM",
        short_name: "MEXUZ",
        description: "מערכת ניהול לקוחות ופרויקטים - MEXUZ",
        start_url: "/",
        display: "standalone",
        background_color: "#eef1f8",
        theme_color: "#3548c7",
        dir: "rtl",
        lang: "he",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
});
