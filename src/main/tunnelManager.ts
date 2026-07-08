import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { getBaseDir } from './env';

export interface TunnelInfo {
  projectName: string;
  localPort: number;
  publicUrl: string;
  status: 'connecting' | 'active' | 'error' | 'stopped';
  startedAt?: string;
  error?: string;
}

export class TunnelManager {
  private tunnels: Map<string, { info: TunnelInfo; process?: ChildProcess }> = new Map();
  private isDownloading = false;

  public getActiveTunnels(): TunnelInfo[] {
    return Array.from(this.tunnels.values()).map(t => ({ ...t.info }));
  }

  private async downloadCloudflared(): Promise<string> {
    const isWin = process.platform === 'win32';
    if (!isWin) throw new Error('Cloudflare auto-download is currently only supported on Windows.');
    
    // Assume app is in C:\sabila or fallback to process.cwd()
    const baseDir = fs.existsSync(getBaseDir()) ? getBaseDir() : process.cwd();
    const binDir = path.join(baseDir, 'bin', 'cloudflared');
    const exePath = path.join(binDir, 'cloudflared.exe');
    
    if (fs.existsSync(exePath)) return exePath;
    
    if (this.isDownloading) {
      throw new Error('Sedang mengunduh modul Cloudflared. Silakan tunggu sebentar dan coba lagi.');
    }
    
    this.isDownloading = true;
    logger.info('Downloading cloudflared.exe for the first time...');
    
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
      
      const download = (urlStr: string) => {
        https.get(urlStr, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            download(response.headers.location!);
          } else if (response.statusCode === 200) {
            const file = fs.createWriteStream(exePath);
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              this.isDownloading = false;
              logger.info('Cloudflared downloaded successfully.');
              resolve(exePath);
            });
          } else {
            this.isDownloading = false;
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          }
        }).on('error', (err) => {
          fs.unlink(exePath, () => {});
          this.isDownloading = false;
          reject(err);
        });
      };
      
      download(url);
    });
  }

  public async startTunnel(projectName: string, localPort: number, subdomain?: string): Promise<TunnelInfo> {
    // Stop existing tunnel for this project
    if (this.tunnels.has(projectName)) {
      await this.stopTunnel(projectName);
    }

    const info: TunnelInfo = {
      projectName,
      localPort,
      publicUrl: '',
      status: 'connecting',
      startedAt: new Date().toISOString()
    };

    this.tunnels.set(projectName, { info });
    logger.info(`Starting tunnel for ${projectName} on port ${localPort}...`);

    try {
      // Prioritize Cloudflared first
      let exePath = '';
      try {
        exePath = await this.downloadCloudflared();
      } catch (err: any) {
        logger.error(`Failed to get cloudflared, falling back to localtunnel. Error: ${err.message}`);
      }

      const tunnel = this.tunnels.get(projectName);

      return new Promise((resolve) => {
        let resolved = false;
        let child: ChildProcess;

        if (exePath && fs.existsSync(exePath)) {
           logger.info('Using Cloudflare Tunnels (cloudflared)');
           const args = ['tunnel', '--url', `http://${projectName}.test:${localPort}`, '--http-host-header', `${projectName}.test`];
           child = spawn(exePath, args, { windowsHide: true });
        } else {
           logger.info('Using LocalTunnel');
           const args = ['-y', 'localtunnel', '--port', localPort.toString(), '--local-host', `${projectName}.test`];
           if (subdomain) {
             if (!/^[a-zA-Z0-9-]+$/.test(subdomain)) {
               throw new Error('Invalid subdomain. Only alphanumeric characters and hyphens are allowed.');
             }
             args.push('--subdomain', subdomain);
           }
           const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
           child = spawn(cmd, args, { windowsHide: true, env: { ...process.env as Record<string, string> } });
        }

        if (tunnel) {
          tunnel.process = child;
        }

        const handleOutput = (data: Buffer) => {
          const output = data.toString().trim();
          
          // Cloudflare tunnel output goes to stderr usually:
          // INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  https://xxxx.trycloudflare.com
          const cfUrlMatch = output.match(/(https?:\/\/[^\s]+\.trycloudflare\.com)/i);
          // Localtunnel output:
          const ltUrlMatch = output.match(/url is:\s*(https?:\/\/[^\s]+)/i);

          const matchedUrl = (cfUrlMatch && cfUrlMatch[1]) || (ltUrlMatch && ltUrlMatch[1]);

          if (matchedUrl && !resolved) {
            resolved = true;
            info.publicUrl = matchedUrl;
            info.status = 'active';
            logger.info(`Tunnel active for ${projectName}: ${info.publicUrl}`);
            resolve({ ...info });
          }
        };

        child.stdout?.on('data', handleOutput);
        child.stderr?.on('data', handleOutput);

        child.on('error', (err) => {
          logger.error(`Tunnel error for ${projectName}: ${err.message}`);
          info.status = 'error';
          info.error = err.message;
          if (!resolved) {
            resolved = true;
            resolve({ ...info });
          }
        });

        child.on('exit', (code) => {
          logger.info(`Tunnel for ${projectName} exited with code ${code}`);
          info.status = 'stopped';
          if (!resolved) {
            resolved = true;
            resolve({ ...info });
          }
        });

        // Timeout after 30 seconds for the tunnel to connect
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            info.status = 'error';
            info.error = 'Connection timed out (30s). Please try again.';
            resolve({ ...info });
          }
        }, 30000);
      });
    } catch (err: any) {
      info.status = 'error';
      info.error = err.message;
      logger.error(`Failed to start tunnel: ${err.message}`);
      return info;
    }
  }

  public async stopTunnel(projectName: string): Promise<boolean> {
    const tunnel = this.tunnels.get(projectName);
    if (!tunnel) return false;

    try {
      if (tunnel.process && !tunnel.process.killed && tunnel.process.pid !== undefined) {
        if (process.platform === 'win32') {
          const { execFile } = require('child_process');
          execFile('taskkill', ['/PID', tunnel.process.pid.toString(), '/T', '/F'], () => {});
        } else {
          tunnel.process.kill('SIGTERM');
        }
      }
    } catch (err) {
      logger.error(`Error stopping tunnel for ${projectName}: ${err}`);
    }

    tunnel.info.status = 'stopped';
    this.tunnels.delete(projectName);
    logger.info(`Tunnel for ${projectName} stopped.`);
    return true;
  }

  public async stopAll(): Promise<void> {
    const names = Array.from(this.tunnels.keys());
    for (const name of names) {
      await this.stopTunnel(name);
    }
  }
}

export const tunnelManager = new TunnelManager();
