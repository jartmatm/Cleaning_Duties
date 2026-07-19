import express from "express";
import { healthRouter } from "./routes/health";
import { inviteRouter } from "./routes/invite";
import { cleanupDemoRouter } from "./routes/cleanup-demo";
import { dutyNotificationsRouter } from "./routes/duty-notifications";
import { errorHandler } from "./middleware/error-handler";

export function createServer() {
  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN;

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (!allowedOrigin || origin === allowedOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/invite", inviteRouter);
  app.use("/cleanup-demo", cleanupDemoRouter);
  app.use("/duty-notifications", dutyNotificationsRouter);
  app.use(errorHandler);

  return app;
}
