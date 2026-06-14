import type { Express } from "express";
import type { Server } from "http";

// The Express server only serves as Vite's host for the frontend.
// All AI/CV/job logic is handled by the separate FastAPI server on port 8000.
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health check for the frontend server
  app.get("/api/frontend-health", (_req, res) => {
    res.json({ status: "ok", service: "cv-job-matcher-frontend" });
  });

  return httpServer;
}
