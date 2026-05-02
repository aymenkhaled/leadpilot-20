import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

// Routes
import authRouter from "./routes/auth.js";
import jobsRouter from "./routes/jobs.js";
import companiesRouter from "./routes/companies.js";
import contactsRouter from "./routes/contacts.js";
import signalsRouter from "./routes/signals.js";
import outreachRouter from "./routes/outreach.js";
import agentRouter from "./routes/agent.js";
import settingsRouter from "./routes/settings.js";
import enrichRouter from "./routes/enrich.js";
import scrapeRouter from "./routes/scrape.js";
import analyticsRouter from "./routes/analytics.js";
import adminRouter from "./routes/admin.js";
import billingRouter from "./routes/billing.js";
import webhooksRouter from "./routes/webhooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "5000", 10);

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Rate limiting — skip for local/dev traffic
  app.use(
    "/api/",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isDev ? 100_000 : 500,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
    })
  );

  // Body parsing + cookies
  app.use(morgan(isDev ? "dev" : "combined"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API routes — always mounted first
  app.use("/api/auth", authRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/contacts", contactsRouter);
  app.use("/api/signals", signalsRouter);
  app.use("/api/outreach", outreachRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/enrich", enrichRouter);
  app.use("/api/scrape", scrapeRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/webhooks", webhooksRouter);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
  });

  // Frontend serving
  if (isDev) {
    // Embed Vite dev server as Express middleware (single port: 5000)
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "../vite.config.ts"),
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("  ✓ Vite dev middleware attached");
  } else {
    // Production: serve pre-built static files
    const publicDir = path.resolve(__dirname, "../dist/public");
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 LeadPilot 2.0 running on http://0.0.0.0:${PORT}`);
    console.log(`   Mode: ${isDev ? "development" : "production"}`);
    console.log(`   API:  http://localhost:${PORT}/api/health\n`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
