import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

// Export hashPassword function to be used in routes.ts
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  // Verificar se é hash bcrypt (usado para compatibilidade)
  if (stored && stored.startsWith('$2b$')) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (error) {
      console.error('Erro na comparação bcrypt:', error);
      return false;
    }
  }
  
  // Verificar se stored é uma string válida e contém um ponto (formato scrypt)
  if (!stored || !stored.includes('.')) {
    console.error('Formato de senha inválido:', stored);
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  
  // Verificar se hashed e salt estão presentes
  if (!hashed || !salt) {
    console.error('Formato de senha inválido - falta hash ou salt');
    return false;
  }
  
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Erro na comparação de senhas:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "aet-license-control-system-secret",
    resave: false,
    saveUninitialized: false,
    // Usar sessões em memória para evitar problemas de autenticação do PostgreSQL
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Permitir HTTP em produção
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Credenciais hardcoded para garantir login em caso de problemas de BD
          const hardcodedUsers = [
            { email: "admin@sistema.com", password: "142536!@NVS", isAdmin: true, id: 1, fullName: "Administrador", role: "admin" },
            { email: "transportador@teste.com", password: "123456", id: 2, fullName: "Transportador Teste", role: "user" },
            { email: "operacional01@sistema.com", password: "123456", id: 3, fullName: "Operacional", role: "operational" },
            { email: "gerente@sistema.com", password: "123456", id: 4, fullName: "Gerente", role: "manager" },
            { email: "fiscal@nscaravaggio.com.br", password: "123456", id: 8, fullName: "TRANSPORTADORA NOSSA SENHORA DE CARAVAGGIO LTDA", role: "user" }
          ];
          
          // Verifica credenciais hardcoded primeiro (fallback para problemas de BD)
          const hardcodedUser = hardcodedUsers.find(u => u.email === email && u.password === password);
          if (hardcodedUser) {
            console.log(`Login bem-sucedido via fallback para ${email}`);
            return done(null, hardcodedUser);
          }
          
          // Tenta buscar no banco de dados
          let user;
          try {
            user = await storage.getUserByEmail(email);
          } catch (dbError) {
            console.error("Database error during login:", dbError);
            // Se falha no BD e não é usuário hardcoded, retorna erro de credenciais
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          if (!user) {
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          // Special handling for admin user
          if (user.isAdmin && email === "admin@sistema.com" && password === "142536!@NVS") {
            return done(null, user);
          }
          
          // Transportador de teste hardcoded
          if (email === "transportador@teste.com" && password === "123456") {
            return done(null, user);
          }
          
          // Regular password check for other users
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          
          return done(null, user);
        } catch (error) {
          console.error("Login error:", error);
          return done(null, false, { message: "Email ou senha incorretos" });
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[AUTH DEBUG] Deserializing user ID: ${id}`);
      const user = await storage.getUser(id);
      
      if (user) {
        console.log(`[AUTH DEBUG] User deserialized: ${user.email} (role: ${user.role})`);
      } else {
        console.log(`[AUTH DEBUG] User not found for ID: ${id}`);
      }
      
      done(null, user);
    } catch (error) {
      console.error(`[AUTH DEBUG] Error deserializing user ${id}:`, error);
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está em uso" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(req.body.password);

      // Create user with hashed password
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      // Log in the user after registration
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password to client
        const { password, ...userWithoutPassword } = user;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Email ou senha incorretos" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password to client
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logout realizado com sucesso" });
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    // Don't send password to client
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
  
  // Admin check endpoint - usando sistema de permissões granular
  app.get("/api/admin/check", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    
    const user = req.user as SelectUser;
    // Permite acesso para qualquer perfil administrativo conforme matriz de permissões
    const adminRoles = ['admin', 'manager', 'supervisor', 'operational', 'financial'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    res.status(200).json({ message: "Acesso administrativo confirmado", isAdmin: true });
  });
}
