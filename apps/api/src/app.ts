import express from "express";
import { healthRouter } from "./routes/health";
import { errorHandler } from "./middleware/error-handler";

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use("/health", healthRouter);
  app.use(errorHandler);

  return app;
}
