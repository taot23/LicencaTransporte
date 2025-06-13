import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware para forçar tipo de conteúdo JSON específico para certos endpoints
app.use((req, res, next) => {
  if (req.path.includes('/api/data/') || req.path.includes('/ajax/')) {
    res.type('application/json');
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Register API routes first
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`, "error");
      res.status(status).json({ message });
    });

    // Serve static files in production
    const distPath = path.resolve(__dirname, "..", "dist", "public");
    
    // Check if build exists, if not serve API only
    try {
      await import('fs/promises').then(fs => fs.access(distPath));
      app.use(express.static(distPath));
      log(`Serving static files from: ${distPath}`);
      
      // SPA fallback
      app.get("*", (req, res) => {
        if (!req.path.startsWith("/api")) {
          res.sendFile(path.join(distPath, "index.html"));
        } else {
          res.status(404).json({ message: "Endpoint não encontrado" });
        }
      });
    } catch (error) {
      log("Build directory not found - serving API only", "warning");
      
      // API-only fallback
      app.get("*", (req, res) => {
        if (req.path.startsWith("/api")) {
          res.status(404).json({ message: "Endpoint não encontrado" });
        } else {
          res.status(503).json({ 
            message: "Frontend não disponível - build necessário",
            buildPath: distPath
          });
        }
      });
    }

    const port = parseInt(process.env.PORT || "5000");
    
    server.listen(port, "0.0.0.0", () => {
      log(`Production server running on port ${port}`);
      log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    });

  } catch (error) {
    log(`Failed to start server: ${error.message}`, "error");
    process.exit(1);
  }
})();