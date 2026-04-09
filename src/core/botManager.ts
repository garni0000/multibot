import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { exec } from 'child_process';
import util from 'util';
import AdmZip from 'adm-zip';

const execPromise = util.promisify(exec);

export class BotManager {
  private botsDir: string;

  constructor() {
    this.botsDir = path.join(process.cwd(), 'bots');
    fs.ensureDirSync(this.botsDir);
  }

  async addBotFromGithub(name: string, repoUrl: string, token?: string) {
    const botPath = path.join(this.botsDir, name);
    if (fs.existsSync(botPath)) {
      throw new Error(`Bot ${name} already exists.`);
    }

    let authenticatedUrl = repoUrl;
    if (token) {
      // Handle private repo URL construction if needed
      // e.g., https://token@github.com/user/repo.git
      const url = new URL(repoUrl);
      url.username = token;
      authenticatedUrl = url.toString();
    }

    const git = simpleGit();
    await git.clone(authenticatedUrl, botPath);
    
    // Install dependencies
    await this.installDeps(botPath);
    
    return botPath;
  }

  async addBotFromZip(name: string, zipBuffer: Buffer) {
    const botPath = path.join(this.botsDir, name);
    if (fs.existsSync(botPath)) {
      throw new Error(`Bot ${name} already exists.`);
    }

    await fs.ensureDir(botPath);
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(botPath, true);

    // Install dependencies
    await this.installDeps(botPath);

    return botPath;
  }

  async installDeps(botPath: string) {
    if (fs.existsSync(path.join(botPath, 'package.json'))) {
      await execPromise('npm install', { cwd: botPath });
    }
  }

  async listBots() {
    const dirs = await fs.readdir(this.botsDir);
    const bots = [];
    for (const dir of dirs) {
      const botPath = path.join(this.botsDir, dir);
      const stat = await fs.stat(botPath);
      if (stat.isDirectory()) {
        const hasEnv = fs.existsSync(path.join(botPath, '.env'));
        const hasIndex = fs.existsSync(path.join(botPath, 'index.js')) || 
                         fs.existsSync(path.join(botPath, 'bot.js')) ||
                         fs.existsSync(path.join(botPath, 'main.js'));
        bots.push({
          id: dir,
          path: botPath,
          configured: hasEnv && hasIndex
        });
      }
    }
    return bots;
  }

  async updateEnv(name: string, envContent: string) {
    const botPath = path.join(this.botsDir, name);
    await fs.writeFile(path.join(botPath, '.env'), envContent);
  }

  async getEnv(name: string) {
    const envPath = path.join(this.botsDir, name, '.env');
    if (fs.existsSync(envPath)) {
      return await fs.readFile(envPath, 'utf8');
    }
    return '';
  }

  async deleteBot(name: string) {
    const botPath = path.join(this.botsDir, name);
    await fs.remove(botPath);
  }
}
