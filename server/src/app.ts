// Check if all the environment variables are set
import "./lib/env.js";

// Type imports

// Library imports
import express, { type Express } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";

// Module imports
import { routesHandler } from "./lib/routeHandler.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { NotFoundError } from "./errors/httpErrors.js";
import { ENV } from "./lib/env.js";
const app: Express = express();
const __dirname = import.meta.dirname;

const devOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;

  if (ENV.NODE_ENV === "production") {
    return origin === ENV.PROD_URL;
  }

  return devOrigins.has(origin);
}

// External Middlewares
app.use(logger("dev"));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Register App routes
const apiRouter = await routesHandler();
app.use("/v1", apiRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  throw new NotFoundError();
});

// error handler
app.use(errorHandler);

export default app;
