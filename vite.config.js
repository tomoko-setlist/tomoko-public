import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    "import.meta.env.VITE_APP_RELEASE_TOKEN": JSON.stringify("public-source"),
  },
  server: {
    proxy: {
      "/api/report": {
        target: "https://hp-setlist.com",
        changeOrigin: true,
        xfwd: true,
      },
      "/api/intake/krn-submissions": {
        target: "https://hp-setlist.com",
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
});
