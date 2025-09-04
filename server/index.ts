import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

// Função para verificar e atualizar boletos vencidos
async function checkExpiredBoletos() {
  try {
    const { storage } = await import("./storage");
    const now = new Date();
    
    // Buscar licenças com status 'paying' ou 'fee_generated' e due_date vencida
    // Nota: Esta é uma implementação simplificada
    // Em produção, seria necessário consultar o banco diretamente
    console.log(`[BOLETO CHECK] Verificando boletos vencidos em: ${now.toISOString()}`);
    
    // TODO: Implementar query específica para buscar registros com dueDate vencida
    // e atualizar status para 'unpaid' automaticamente
    
  } catch (error) {
    console.error('[BOLETO CHECK] Erro ao verificar boletos vencidos:', error);
  }
}

// Iniciar verificação automática de boletos vencidos a cada hora (3600000 ms)
setInterval(checkExpiredBoletos, 3600000);

// Executar verificação inicial após 1 minuto do startup
setTimeout(checkExpiredBoletos, 60000);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Handle port conflicts gracefully
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Attempting to find and terminate conflicting processes...`);
      process.exit(1);
    } else {
      throw err;
    }
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
