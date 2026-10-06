import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";

import { getFrontendOrigin } from "./config/env.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import topFiveRoutes from "./routes/topFiveRoutes.js";

import { authLimiter, apiLimiter } from "./middleware/rateLimit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiPath = path.join(__dirname, "../docs/openapi.yaml");

const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, "utf8"));

const app = express();

app.use(
  cors({
    origin: getFrontendOrigin(),
  }),
);

app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api/reviews", reviewRoutes);
app.use("/api/media", apiLimiter, mediaRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/top-five", topFiveRoutes);

export default app;
