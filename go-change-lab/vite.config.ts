import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const projectPath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "/go-change-lab/dist/",
  root: projectPath("./src"),
  publicDir: projectPath("./public"),
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: projectPath("./dist"),
  },
});
