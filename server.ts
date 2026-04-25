import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import morgan from "morgan";
import fs from "fs-extra";
import multer from "multer";
import { BotManager } from "./src/core/botManager.ts";
import { ProcessManager } from "./src/core/processManager.ts";
import { Telegraf } from "telegraf";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const botManager = new BotManager();
  const processManager = new ProcessManager();

  const upload = multer({ storage: multer.memoryStorage() });

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Keep-alive route (Public)
  app.get("/keep-alive", (req, res) => {
    console.log(`[Keep-Alive] Ping received at ${new Date().toISOString()}`);
    res.send("I'm alive! 🚀");
  });

  // Auth Middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = process.env.ADMIN_API_KEY || 'admin_secret_key_123';
    
    if (apiKey !== expectedKey) {
      console.log(`Auth FAILED: received=${apiKey ? '***' : 'NONE'}, expected=***`);
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // API Routes
  app.get("/api/bots", authMiddleware, async (req, res) => {
    try {
      console.log("GET /api/bots - Start");
      const bots = await botManager.listBots();
      console.log(`GET /api/bots - Found ${bots.length} bots`);
      const botsWithStatus = bots.map(bot => ({
        ...bot,
        status: processManager.getBotStatus(bot.id)
      }));
      console.log("GET /api/bots - Success");
      res.json(botsWithStatus);
    } catch (error: any) {
      console.error("GET /api/bots - Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bots/github", authMiddleware, async (req, res) => {
    const { name, repoUrl, token } = req.body;
    try {
      await botManager.addBotFromGithub(name, repoUrl, token);
      res.json({ message: "Bot added successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bots/upload", authMiddleware, upload.single('file'), async (req: any, res) => {
    const { name } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    try {
      await botManager.addBotFromZip(name, file.buffer);
      res.json({ message: "Bot uploaded and extracted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bots/start", authMiddleware, async (req, res) => {
    const { id } = req.body;
    try {
      const botPath = path.join(process.cwd(), 'bots', id);
      await processManager.startBot(id, botPath);
      res.json({ message: `Bot ${id} started` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bots/stop", authMiddleware, async (req, res) => {
    const { id } = req.body;
    try {
      await processManager.stopBot(id);
      res.json({ message: `Bot ${id} stopped` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bots/restart", authMiddleware, async (req, res) => {
    const { id } = req.body;
    try {
      await processManager.stopBot(id);
      const botPath = path.join(process.cwd(), 'bots', id);
      await processManager.startBot(id, botPath);
      res.json({ message: `Bot ${id} restarted` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bots/logs/:id", authMiddleware, (req, res) => {
    const logs = processManager.getLogs(req.params.id);
    res.json({ logs });
  });

  app.post("/api/bots/env", authMiddleware, async (req, res) => {
    const { id, content } = req.body;
    try {
      await botManager.updateEnv(id, content);
      res.json({ message: "Env updated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bots/env/:id", authMiddleware, async (req, res) => {
    try {
      const content = await botManager.getEnv(req.params.id);
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bots/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      await processManager.stopBot(id);
      await botManager.deleteBot(id);
      res.json({ message: `Bot ${id} deleted` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/broadcast", authMiddleware, async (req, res) => {
    const { message } = req.body;
    const bots = await botManager.listBots();
    let successCount = 0;
    
    for (const bot of bots) {
      try {
        const envContent = await botManager.getEnv(bot.id);
        const tokenMatch = envContent.match(/BOT_TOKEN=(.*)/);
        const adminMatch = envContent.match(/ADMIN_ID=(.*)/);
        
        if (tokenMatch && adminMatch) {
          const token = tokenMatch[1].trim();
          const adminId = adminMatch[1].trim();
          const telegraf = new Telegraf(token);
          await telegraf.telegram.sendMessage(adminId, `📢 BROADCAST: ${message}`);
          successCount++;
        }
      } catch (e) {
        console.error(`Failed broadcast for ${bot.id}`, e);
      }
    }
    res.json({ message: `Broadcast sent to ${successCount} bots` });
  });

  // Auto-start active bots
  try {
    const bots = await botManager.listBots();
    for (const bot of bots) {
      if (bot.configured) {
        console.log(`Auto-starting bot: ${bot.id}`);
        try {
          await processManager.startBot(bot.id, bot.path);
        } catch (e) {
          console.error(`Failed to auto-start ${bot.id}`, e);
        }
      }
    }
  } catch (error) {
    console.error("Failed to list bots for auto-start", error);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
