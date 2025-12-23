import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,

    // Allow new ngrok domain
    allowedHosts: [
      "2917e9fcac2f.ngrok-free.app"
    ],

    // Fix HMR through ngrok
    hmr: {
      host: "2917e9fcac2f.ngrok-free.app",
      protocol: "wss"
    }
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
