import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

interface ProcessInfo {
  id: string;
  process: ChildProcess;
  startTime: Date;
  botPath: string;
  restartCount: number;
  manualStop: boolean;
}

export class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();
  private logsDir: string;
  private readonly MAX_RESTARTS = 5;
  private readonly RESTART_DELAY = 3000; // 3 seconds

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    fs.ensureDirSync(this.logsDir);
  }

  async startBot(botId: string, botPath: string) {
    if (this.processes.has(botId)) {
      const info = this.processes.get(botId);
      if (info && !info.manualStop) {
        throw new Error(`Bot ${botId} is already running.`);
      }
      // If it was manually stopped or crashed, we can restart it
      this.processes.delete(botId);
    }

    return this.spawnBot(botId, botPath, 0);
  }

  private async spawnBot(botId: string, botPath: string, restartCount: number) {
    let botIndex = path.join(botPath, 'index.js');
    if (!fs.existsSync(botIndex)) {
      botIndex = path.join(botPath, 'bot.js');
    }
    if (!fs.existsSync(botIndex)) {
      botIndex = path.join(botPath, 'main.js');
    }

    if (!fs.existsSync(botIndex)) {
      throw new Error(`No entry file (index.js, bot.js, or main.js) found at ${botPath}`);
    }

    const logFile = path.join(this.logsDir, `${botId}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    const child = spawn('node', [botIndex], {
      cwd: botPath,
      env: { ...process.env, ...this.loadBotEnv(botPath) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const processInfo: ProcessInfo = {
      id: botId,
      process: child,
      startTime: new Date(),
      botPath,
      restartCount,
      manualStop: false
    };

    this.processes.set(botId, processInfo);

    child.stdout?.on('data', (data) => {
      const output = `[${new Date().toISOString()}] STDOUT: ${data}`;
      logStream.write(output);
    });

    child.stderr?.on('data', (data) => {
      const output = `[${new Date().toISOString()}] STDERR: ${data}`;
      logStream.write(output);
    });

    child.on('exit', (code, signal) => {
      const info = this.processes.get(botId);
      logStream.write(`[${new Date().toISOString()}] Bot ${botId} exited with code ${code} and signal ${signal}\n`);
      logStream.end();

      if (info && !info.manualStop && code !== 0 && code !== null) {
        if (info.restartCount < this.MAX_RESTARTS) {
          const nextRestart = info.restartCount + 1;
          console.log(`Bot ${botId} crashed (code ${code}). Restarting (${nextRestart}/${this.MAX_RESTARTS}) in ${this.RESTART_DELAY}ms...`);
          
          setTimeout(() => {
            this.spawnBot(botId, botPath, nextRestart).catch(err => {
              console.error(`Failed to auto-restart bot ${botId}:`, err);
            });
          }, this.RESTART_DELAY);
        } else {
          console.error(`Bot ${botId} exceeded max restarts. Manual intervention required.`);
          this.processes.delete(botId);
        }
      } else {
        this.processes.delete(botId);
      }
    });

    return true;
  }

  async stopBot(botId: string) {
    const info = this.processes.get(botId);
    if (!info) return false;

    info.manualStop = true;
    info.process.kill();
    this.processes.delete(botId);
    return true;
  }

  private loadBotEnv(botPath: string) {
    const envPath = path.join(botPath, '.env');
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    content.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.join('=').trim();
      }
    });
    return env;
  }

  getRunningBots() {
    return Array.from(this.processes.keys());
  }

  getBotStatus(botId: string) {
    const info = this.processes.get(botId);
    if (!info) return 'offline';
    return 'online';
  }

  getLogs(botId: string) {
    const logFile = path.join(this.logsDir, `${botId}.log`);
    if (!fs.existsSync(logFile)) return 'No logs found.';
    // Return last 100 lines for efficiency
    const content = fs.readFileSync(logFile, 'utf8');
    return content.split('\n').slice(-100).join('\n');
  }
}
