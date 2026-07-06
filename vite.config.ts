import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  // Strip all console.* calls and debugger statements from the production bundle
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
    legalComments: "none",
  },
  build: {
    // No source maps — ever
    sourcemap: false,
    // Aggressive minification
    minify: "esbuild",
    // Rename all chunks to hashed names so file structure is not revealed
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash].[ext]",
        manualChunks: {
          // Core React runtime
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Firebase (large — split into sub-packages)
          "vendor-firebase-app": ["firebase/app", "firebase/auth"],
          "vendor-firebase-firestore": ["firebase/firestore"],
          "vendor-firebase-storage": ["firebase/storage"],
          // PDF renderer (very large)
          "vendor-pdf": ["@react-pdf/renderer"],
          // Charts
          "vendor-recharts": ["recharts"],
          // Lucide icons
          "vendor-lucide": ["lucide-react"],
          // Radix UI primitives
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-progress",
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      includeAssets: ["pwa-512x512.png"],
      manifest: {
        name: "Ibell - GST Billing Software",
        short_name: "Ibell",
        description: "Complete GST billing solution with inventory management",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
