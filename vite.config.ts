import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { normalize } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-rocrate-files",
      configureServer(server) {
        server.middlewares.use("/api/rocrate", (req, res, next) => {
          // Get the file path from query parameter
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const filePath = url.searchParams.get("path");

          if (!filePath) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing path parameter" }));
            return;
          }

          try {
            // Normalize the path to handle Windows paths
            const normalizedPath = normalize(filePath);
            const content = readFileSync(normalizedPath, "utf-8");
            const json = JSON.parse(content);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(json));
          } catch (error) {
            console.error("Error loading RO-Crate file:", error);
            res.statusCode = 404;
            res.end(
              JSON.stringify({
                error: "File not found or invalid JSON",
                details: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });

        server.middlewares.use("/api/open-file", async (req, res) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const filePath = url.searchParams.get("path");

          if (!filePath) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing path parameter" }));
            return;
          }

          try {
            const normalizedPath = normalize(filePath);

            // Platform-specific command to open file in default app
            let command: string;
            if (process.platform === "win32") {
              command = `start "" "${normalizedPath}"`;
            } else if (process.platform === "darwin") {
              command = `open "${normalizedPath}"`;
            } else {
              command = `xdg-open "${normalizedPath}"`;
            }

            await execAsync(command);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            console.error("Error opening file:", error);
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: "Failed to open file",
                details: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
      },
    },
  ],
  server: {
    open: true,
  },
});
