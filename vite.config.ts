import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Build estático puro para GitHub Pages — reemplaza la config original de
// TanStack Start / Cloudflare Workers, que necesita un runtime de servidor
// que GitHub Pages no ofrece. Esta demo no necesita SSR: es una sola página.
export default defineConfig({
  base: "/reserva-de-salas/",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
});
