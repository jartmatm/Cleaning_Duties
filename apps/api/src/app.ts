import express from "express";
import { healthRouter } from "./routes/health";
import { inviteRouter } from "./routes/invite";
import { cleanupDemoRouter } from "./routes/cleanup-demo";
import { dutyNotificationsRouter } from "./routes/duty-notifications";
import { errorHandler } from "./middleware/error-handler";

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/invite", inviteRouter);
  app.use("/cleanup-demo", cleanupDemoRouter);
  app.use("/duty-notifications", dutyNotificationsRouter);
  app.use(errorHandler);

  return app;
}
