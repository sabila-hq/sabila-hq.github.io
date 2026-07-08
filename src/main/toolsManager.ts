import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { logger } from './logger';
import { store } from './store';
import { getBaseDir } from './env';

export interface ToolInfo {
  id: string;
  name: string;
  icon: string;
  version: string;
  activeVersion?: string;
  path: string;
  isInstalled: boolean;
  category: 'runtime' | 'package-manager' | 'vcs' | 'database-tool';
}

export class ToolsManager {
  private baseDir: string;
  private toolsCache: ToolInfo[] = [];
  private lastCacheTime: number = 0;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  public clearCache(): void {
    this.lastCacheTime = 0;
  }

  private findExecutable(basePath: string, fileName: string, maxDepth = 3): string | null {
    if (!fs.existsSync(basePath)) return null;
    const search = (dir: string, depth: number): string | null => {
      if (depth > maxDepth) return null;
      const targetPath = path.join(dir, fileName);
      if (fs.existsSync(targetPath)) return targetPath;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const result = search(path.join(dir, entry.name), depth + 1);
            if (result) return result;
          }
        }
      } catch (err) {}
      return null;
    };
    return search(basePath, 0);
  }

  private getVersion(exePath: string, args: string[] = ['--version']): string {
    try {
      const output = execSync(`"${exePath}" ${args.join(' ')} 2>&1`, {
        timeout: 5000,
        windowsHide: true,
        encoding: 'utf8',
        env: { ...process.env, PATH: process.env.PATH }
      });
      // Extract first line and clean up common prefixes
      const firstLine = output.trim().split(/\r?\n/)[0];
      
      // Special case for mysqld which prefixes output with its absolute path
      if (exePath.toLowerCase().endsWith('mysqld.exe')) {
        const match = firstLine.match(/Ver\s+([\d\.]+)/i);
        if (match) return match[1];
      }

      return firstLine.replace(/^(Composer version|node |npm |git version |nginx version: nginx\/|Server version: Apache\/|mysql\s+Ver\s+|PHP |Python |pg_ctl \(PostgreSQL\) |WP-CLI |cloudflared version |ngrok version |go version |bun |db version v)/i, '').trim().split(' ')[0];
    } catch (e) {
      return 'unknown';
    }
  }

  public getInstalledTools(): ToolInfo[] {
    const now = Date.now();
    // Cache results for 60 seconds to prevent heavy synchronous polling lag
    if (now - this.lastCacheTime < 60000 && this.toolsCache.length > 0) {
      return this.toolsCache;
    }

    const tools: ToolInfo[] = [];

    // --- Node.js ---
    const nodeDir = path.join(this.baseDir, 'bin', 'node');
    let nodeExe: string | null = null;
    let activeVersion: string | undefined = undefined;
    
    if (fs.existsSync(nodeDir)) {
      const savedVersion = store.get('nodeVersion') as string | undefined;
      
      if (savedVersion && fs.existsSync(path.join(nodeDir, savedVersion, 'node.exe'))) {
        activeVersion = savedVersion;
        nodeExe = path.join(nodeDir, savedVersion, 'node.exe');
      } else {
        // Fallback to first available
        try {
          const entries = fs.readdirSync(nodeDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const candidate = path.join(nodeDir, entry.name, 'node.exe');
              if (fs.existsSync(candidate)) {
                nodeExe = candidate;
                activeVersion = entry.name;
                break;
              }
            }
          }
        } catch (e) { /* ignore */ }
      }
    }
    tools.push({
      id: 'node',
      name: 'Node.js',
      icon: '🟢',
      version: nodeExe ? this.getVersion(nodeExe, ['--version']) : '-',
      activeVersion,
      path: nodeExe || '',
      isInstalled: !!nodeExe,
      category: 'runtime'
    });

    // NPM is bundled with Node.js, so we don't display it separately.
    // --- Composer ---
    const composerDir = path.join(this.baseDir, 'bin', 'composer');
    const composerPhar = path.join(composerDir, 'composer.phar');
    const composerBat = path.join(composerDir, 'composer.bat');
    const composerInstalled = fs.existsSync(composerPhar) || fs.existsSync(composerBat);
    let composerVersion = '-';
    if (composerInstalled) {
      // Try to get version using PHP + composer.phar
      const phpExe = this.findPhpExe();
      if (phpExe && fs.existsSync(composerPhar)) {
        try {
          const output = execSync(`"${phpExe}" "${composerPhar}" --version --no-ansi`, {
            timeout: 10000, windowsHide: true, encoding: 'utf8'
          });
          const match = output.match(/Composer version\s+(\d+\.\d+(?:\.\d+)?)/i);
          if (match) composerVersion = match[1];
        } catch (e) {
           logger.error(`Composer version check failed: ${e}`);
        }
      } else if (fs.existsSync(composerBat)) {
         try {
           const output = execSync(`"${composerBat}" --version --no-ansi`, {
             timeout: 10000, windowsHide: true, encoding: 'utf8'
           });
           const match = output.match(/Composer version\s+(\d+\.\d+(?:\.\d+)?)/i);
           if (match) composerVersion = match[1];
         } catch (e) {}
      }
    }
    tools.push({
      id: 'composer',
      name: 'Composer',
      icon: '🎼',
      version: composerVersion,
      path: composerPhar || composerBat || '',
      isInstalled: composerInstalled,
      category: 'package-manager'
    });

    // --- Git ---
    const gitDir = path.join(this.baseDir, 'bin', 'git');
    const gitExe = path.join(gitDir, 'bin', 'git.exe');
    const gitBashExe = path.join(gitDir, 'git-bash.exe');
    const gitInstalled = fs.existsSync(gitExe);
    tools.push({
      id: 'git',
      name: 'Git',
      icon: '🔀',
      version: gitInstalled ? this.getVersion(gitExe) : '-',
      path: gitExe,
      isInstalled: gitInstalled,
      category: 'vcs'
    });

    // Git Bash is bundled with Git, so we don't display it separately.
    // --- PHP ---
    const phpExe = this.findPhpExe();
    let phpActive = store.get('phpVersion') as string | undefined;
    if (!phpActive && phpExe) phpActive = path.basename(path.dirname(phpExe));
    tools.push({
      id: 'php',
      name: 'PHP',
      icon: '🐘',
      version: phpExe ? this.getVersion(phpExe, ['-v']).split('-')[0] : '-',
      activeVersion: phpActive,
      path: phpExe || '',
      isInstalled: !!phpExe,
      category: 'runtime'
    });

    // --- MySQL ---
    const mysqlDir = path.join(this.baseDir, 'bin', 'mysql');
    let mysqlExe: string | null = null;
    let mysqlActive = store.get('mysqlVersion') as string | undefined;
    try {
      if (mysqlActive) {
        const found = this.findExecutable(path.join(mysqlDir, mysqlActive), 'mysqld.exe');
        if (found) mysqlExe = found;
      }
      if (!mysqlExe && fs.existsSync(mysqlDir)) {
        const entries = fs.readdirSync(mysqlDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(mysqlDir, entry.name), 'mysqld.exe');
            if (found) {
              mysqlExe = found;
              mysqlActive = entry.name;
              break;
            }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'mysql',
      name: 'MySQL',
      icon: '🗄️',
      version: mysqlExe ? this.getVersion(mysqlExe, ['-V']).replace(/mysqld\s+Ver\s+/i, '').split(' ')[0] : '-',
      activeVersion: mysqlActive,
      path: mysqlExe || '',
      isInstalled: !!mysqlExe,
      category: 'database-tool'
    });

    // --- Nginx ---
    const nginxDir = path.join(this.baseDir, 'bin', 'nginx');
    let nginxExe: string | null = null;
    let nginxActive = store.get('nginxVersion') as string | undefined;
    try {
      if (nginxActive && fs.existsSync(path.join(nginxDir, nginxActive, 'nginx.exe'))) {
        nginxExe = path.join(nginxDir, nginxActive, 'nginx.exe');
      } else if (fs.existsSync(nginxDir)) {
        const entries = fs.readdirSync(nginxDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const candidate = path.join(nginxDir, entry.name, 'nginx.exe');
            if (fs.existsSync(candidate)) {
              nginxExe = candidate;
              nginxActive = entry.name;
              break;
            }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'nginx',
      name: 'Nginx',
      icon: '🌐',
      version: nginxExe ? this.getVersion(nginxExe, ['-v']) : '-',
      activeVersion: nginxActive,
      path: nginxExe || '',
      isInstalled: !!nginxExe,
      category: 'runtime'
    });

    // --- Apache ---
    const apacheDir = path.join(this.baseDir, 'bin', 'apache');
    let apacheExe: string | null = null;
    let apacheActive = store.get('apacheVersion') as string | undefined;
    try {
      if (apacheActive) {
        const found = this.findExecutable(path.join(apacheDir, apacheActive), 'httpd.exe');
        if (found) apacheExe = found;
      }
      if (!apacheExe && fs.existsSync(apacheDir)) {
        const entries = fs.readdirSync(apacheDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(apacheDir, entry.name), 'httpd.exe');
            if (found) {
              apacheExe = found;
              apacheActive = entry.name;
              break;
            }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'apache',
      name: 'Apache',
      icon: '🪶',
      version: apacheExe ? this.getVersion(apacheExe, ['-v']) : '-',
      activeVersion: apacheActive,
      path: apacheExe || '',
      isInstalled: !!apacheExe,
      category: 'runtime'
    });

    // --- PostgreSQL ---
    const pgDir = path.join(this.baseDir, 'bin', 'postgresql');
    let pgExe: string | null = null;
    let pgActive = store.get('postgresqlVersion') as string | undefined;
    try {
      if (pgActive) {
        const found = this.findExecutable(path.join(pgDir, pgActive), 'pg_ctl.exe');
        if (found) pgExe = found;
      }
      if (!pgExe && fs.existsSync(pgDir)) {
        const entries = fs.readdirSync(pgDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(pgDir, entry.name), 'pg_ctl.exe');
            if (found) {
              pgExe = found;
              pgActive = entry.name;
              break;
            }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'postgresql',
      name: 'PostgreSQL',
      icon: '🐘',
      version: pgExe ? this.getVersion(pgExe, ['--version']) : '-',
      activeVersion: pgActive,
      path: pgExe || '',
      isInstalled: !!pgExe,
      category: 'database-tool'
    });

    // --- Python ---
    const pythonDir = path.join(this.baseDir, 'bin', 'python');
    let pythonExe: string | null = null;
    let pythonActive = store.get('pythonVersion') as string | undefined;
    try {
      if (pythonActive) {
        const found = this.findExecutable(path.join(pythonDir, pythonActive), 'python.exe');
        if (found) pythonExe = found;
      }
      if (!pythonExe && fs.existsSync(pythonDir)) {
        const entries = fs.readdirSync(pythonDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(pythonDir, entry.name), 'python.exe');
            if (found) {
              pythonExe = found;
              pythonActive = entry.name;
              break;
            }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'python',
      name: 'Python',
      icon: '🐍',
      version: pythonExe ? this.getVersion(pythonExe, ['--version']) : '-',
      activeVersion: pythonActive,
      path: pythonExe || '',
      isInstalled: !!pythonExe,
      category: 'runtime'
    });

    // --- phpMyAdmin ---
    const pmaDir = path.join(this.baseDir, 'bin', 'phpmyadmin');
    let pmaPath = '';
    let pmaInstalled = false;
    if (fs.existsSync(pmaDir)) {
      try {
        const entries = fs.readdirSync(pmaDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.toLowerCase().includes('phpmyadmin')) {
            pmaPath = path.join(pmaDir, entry.name);
            pmaInstalled = true;
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }
    tools.push({
      id: 'phpmyadmin',
      name: 'phpMyAdmin',
      icon: '🐬',
      version: pmaInstalled ? path.basename(pmaPath).replace(/phpMyAdmin-|-all-languages/gi, '') : '-',
      path: pmaPath,
      isInstalled: pmaInstalled,
      category: 'database-tool'
    });

    // --- MongoDB ---
    const mongoDir = path.join(this.baseDir, 'bin', 'mongodb');
    let mongoExe: string | null = null;
    let mongoActive = store.get('mongodbVersion') as string | undefined;
    try {
      if (mongoActive) {
        const found = this.findExecutable(path.join(mongoDir, mongoActive), 'mongod.exe');
        if (found) mongoExe = found;
      }
      if (!mongoExe && fs.existsSync(mongoDir)) {
        const entries = fs.readdirSync(mongoDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(mongoDir, entry.name), 'mongod.exe');
            if (found) { mongoExe = found; mongoActive = entry.name; break; }
          }
        }
      }
    } catch (e) {}
    tools.push({
      id: 'mongodb', name: 'MongoDB', icon: '🍃',
      version: mongoExe ? this.getVersion(mongoExe, ['--version']) : '-',
      activeVersion: mongoActive, path: mongoExe || '',
      isInstalled: !!mongoExe, category: 'database-tool'
    });

    // --- DBeaver ---
    const dbeaverDir = path.join(this.baseDir, 'bin', 'dbeaver');
    let dbeaverExe: string | null = null;
    try {
      if (fs.existsSync(dbeaverDir)) {
        const entries = fs.readdirSync(dbeaverDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(dbeaverDir, entry.name), 'dbeaver.exe');
            if (found) { dbeaverExe = found; break; }
          }
        }
      }
    } catch(e) {}
    tools.push({
      id: 'dbeaver', name: 'DBeaver', icon: '🐿️',
      version: dbeaverExe ? '-' : '-',
      path: dbeaverExe || '', isInstalled: !!dbeaverExe, category: 'database-tool'
    });

    // --- Go ---
    const goDir = path.join(this.baseDir, 'bin', 'go');
    let goExe: string | null = null;
    let goActive = store.get('goVersion') as string | undefined;
    try {
      if (goActive) {
        const found = this.findExecutable(path.join(goDir, goActive), 'go.exe');
        if (found) goExe = found;
      }
      if (!goExe && fs.existsSync(goDir)) {
        const entries = fs.readdirSync(goDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(goDir, entry.name), 'go.exe');
            if (found) { goExe = found; goActive = entry.name; break; }
          }
        }
      }
    } catch(e) {}
    tools.push({
      id: 'go', name: 'Go', icon: '🐹',
      version: goExe ? this.getVersion(goExe, ['version']) : '-',
      activeVersion: goActive, path: goExe || '',
      isInstalled: !!goExe, category: 'runtime'
    });

    // --- Bun ---
    const bunDir = path.join(this.baseDir, 'bin', 'bun');
    let bunExe: string | null = null;
    let bunActive = store.get('bunVersion') as string | undefined;
    try {
      if (bunActive) {
        const found = this.findExecutable(path.join(bunDir, bunActive), 'bun.exe');
        if (found) bunExe = found;
      }
      if (!bunExe && fs.existsSync(bunDir)) {
        const entries = fs.readdirSync(bunDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(bunDir, entry.name), 'bun.exe');
            if (found) { bunExe = found; bunActive = entry.name; break; }
          }
        }
      }
    } catch(e) {}
    tools.push({
      id: 'bun', name: 'Bun', icon: '🥟',
      version: bunExe ? this.getVersion(bunExe, ['--version']) : '-',
      activeVersion: bunActive, path: bunExe || '',
      isInstalled: !!bunExe, category: 'runtime'
    });

    // --- Cloudflared ---
    const cloudflaredDir = path.join(this.baseDir, 'bin', 'cloudflared');
    const cloudflaredExe = path.join(cloudflaredDir, 'cloudflared.exe');
    const cloudflaredInstalled = fs.existsSync(cloudflaredExe);
    tools.push({
      id: 'cloudflared', name: 'Cloudflared', icon: '☁️',
      version: cloudflaredInstalled ? this.getVersion(cloudflaredExe, ['--version']) : '-',
      path: cloudflaredExe, isInstalled: cloudflaredInstalled, category: 'package-manager'
    });

    // --- Ngrok ---
    const ngrokDir = path.join(this.baseDir, 'bin', 'ngrok');
    let ngrokExe: string | null = null;
    try {
      if (fs.existsSync(ngrokDir)) {
        const entries = fs.readdirSync(ngrokDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = this.findExecutable(path.join(ngrokDir, entry.name), 'ngrok.exe');
            if (found) { ngrokExe = found; break; }
          }
        }
      }
    } catch(e) {}
    tools.push({
      id: 'ngrok', name: 'Ngrok', icon: '🚇',
      version: ngrokExe ? this.getVersion(ngrokExe, ['--version']) : '-',
      path: ngrokExe || '', isInstalled: !!ngrokExe, category: 'package-manager'
    });

    // --- WP-CLI ---
    const wpcliDir = path.join(this.baseDir, 'bin', 'wp-cli');
    const wpcliBat = path.join(wpcliDir, 'wp.bat');
    const wpcliInstalled = fs.existsSync(wpcliBat);
    tools.push({
      id: 'wp-cli', name: 'WP-CLI', icon: 'W',
      version: wpcliInstalled ? this.getVersion(wpcliBat, ['--info']).split('\\n').find((l: string) => l.includes('WP-CLI version:'))?.replace('WP-CLI version:', '')?.trim() || '-' : '-',
      path: wpcliBat, isInstalled: wpcliInstalled, category: 'package-manager'
    });

    this.toolsCache = tools;
    this.lastCacheTime = now;
    return tools;
  }

  private findPhpExe(): string | null {
    const phpDir = path.join(this.baseDir, 'bin', 'php');
    if (!fs.existsSync(phpDir)) return null;
    
    try {
      const savedPhp = store.get('phpVersion') as string | undefined;
      if (savedPhp && fs.existsSync(path.join(phpDir, savedPhp, 'php.exe'))) {
        return path.join(phpDir, savedPhp, 'php.exe');
      }
    } catch (e) {
      // ignore
    }

    try {
      const entries = fs.readdirSync(phpDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const candidate = path.join(phpDir, entry.name, 'php.exe');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  public getAvailableVersions(toolId: string): string[] {
    const baseDir = path.join(this.baseDir, 'bin', toolId);
    if (!fs.existsSync(baseDir)) return [];
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch (e) {
      return [];
    }
  }

  public setActiveVersion(toolId: string, version: string) {
    if (['node', 'php', 'mysql', 'nginx', 'apache', 'postgresql', 'python', 'mongodb', 'go', 'bun'].includes(toolId)) {
      store.set(`${toolId}Version`, version);
    }
  }

  public openTerminal(toolId: string): boolean {
    const tools = this.getInstalledTools();
    const tool = tools.find(t => t.id === toolId);
    if (!tool || !tool.isInstalled) return false;

    try {
      if (toolId === 'git-bash') {
        spawn(tool.path, [], { detached: true, stdio: 'ignore' });
      } else {
        // Open a cmd window with the tool's directory in PATH
        const toolDir = path.dirname(tool.path);
        
        let initCmd = '';
        let extraPath = '';
        if (toolId === 'node') {
          initCmd = `echo [Node.js Environment] & echo. & echo ^> node -v & node -v & echo. & echo ^> npm -v & npm -v & echo.`;
        } else if (toolId === 'composer') {
          initCmd = `echo [Composer Environment] & echo. & echo ^> composer -V & composer -V & echo.`;
        } else if (toolId === 'git') {
          initCmd = `echo [Git Environment] & echo. & echo ^> git --version & git --version & echo.`;
        } else if (toolId === 'php') {
          initCmd = `echo [PHP Environment] & echo. & echo ^> php -v & php -v & echo.`;
        } else if (toolId === 'mysql') {
          initCmd = `echo [MySQL Environment] & echo. & echo ^> mysql -V & mysql -V & echo.`;
        } else if (toolId === 'apache') {
          initCmd = `echo [Apache Environment] & echo. & echo ^> httpd -v & httpd -v & echo.`;
        } else if (toolId === 'nginx') {
          initCmd = `echo [Nginx Environment] & echo. & echo ^> nginx -v & nginx -v & echo.`;
        } else if (toolId === 'phpmyadmin') {
          initCmd = `echo [phpMyAdmin / MySQL Environment] & echo. & echo ^> mysql -u root & mysql -u root`;
          try {
            const mysqlDir = path.join(this.baseDir, 'bin', 'mysql');
            const mDirs = fs.readdirSync(mysqlDir, { withFileTypes: true });
            const mActive = mDirs.find(d => d.isDirectory());
            if (mActive) {
              extraPath = `;${path.join(mysqlDir, mActive.name, 'bin')}`;
            }
          } catch (e) {}
        } else if (toolId === 'postgresql') {
          initCmd = `echo [PostgreSQL Environment] & echo. & echo ^> psql -V & psql -V & echo.`;
        } else if (toolId === 'python') {
          initCmd = `echo [Python Environment] & echo. & echo ^> python --version & python --version & echo.`;
          const scriptsDir = path.join(toolDir, 'Scripts');
          if (fs.existsSync(scriptsDir)) {
            extraPath = `;${scriptsDir}`;
          }
        } else if (toolId === 'mongodb') {
          initCmd = `echo [MongoDB Environment] & echo. & echo ^> mongod --version & mongod --version & echo.`;
        } else if (toolId === 'go') {
          initCmd = `echo [Go Environment] & echo. & echo ^> go version & go version & echo.`;
        } else if (toolId === 'bun') {
          initCmd = `echo [Bun Environment] & echo. & echo ^> bun --version & bun --version & echo.`;
        } else if (toolId === 'wp-cli') {
          initCmd = `echo [WP-CLI Environment] & echo. & echo ^> wp --version & wp --version & echo.`;
          const phpExe = this.findPhpExe();
          if (phpExe) {
            extraPath = `;${path.dirname(phpExe)}`;
          }
        } else if (toolId === 'cloudflared') {
          initCmd = `echo [Cloudflared Environment] & echo. & echo ^> cloudflared --version & cloudflared --version & echo.`;
        } else if (toolId === 'ngrok') {
          initCmd = `echo [Ngrok Environment] & echo. & echo ^> ngrok --version & ngrok --version & echo.`;
        } else {
          initCmd = `echo [${tool.name} Environment] & echo.`;
        }

        const command = initCmd 
          ? `start cmd.exe /k "set PATH=${toolDir}${extraPath};%PATH% & ${initCmd}"`
          : `start cmd.exe /k "set PATH=${toolDir}${extraPath};%PATH%"`;

        const { exec } = require('child_process');
        exec(command, { cwd: path.join(this.baseDir, 'www') });
      }
      logger.info(`Launched terminal for ${tool.name}`);
      return true;
    } catch (e) {
      logger.error(`Failed to launch ${tool.name}: ${e}`);
      return false;
    }
  }
}

export const toolsManager = new ToolsManager(getBaseDir());
