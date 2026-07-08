import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { logger } from './logger';
import { store } from './store';
import { getBaseDir } from './env';

type ServiceStatus = 'running' | 'stopped' | 'error';

interface ServiceInfo {
  id: string;
  name: string;
  process?: ChildProcess;
  status: ServiceStatus;
  port: number;
  activeVersion?: string;
}

export class ServiceManager {
  private services: Map<string, ServiceInfo> = new Map();
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // Register potential services
    this.services.set('nginx', { id: 'nginx', name: 'Nginx', status: 'stopped', port: 80 });
    this.services.set('php', { id: 'php', name: 'PHP-FPM', status: 'stopped', port: 9000 });
    this.services.set('mysql', { id: 'mysql', name: 'MySQL', status: 'stopped', port: 3306 });
    this.services.set('apache', { id: 'apache', name: 'Apache', status: 'stopped', port: 8080 });

    try {
      for (const [id, svc] of this.services.entries()) {
        const savedVer = store.get(`${id}Version`) as string | undefined;
        if (savedVer) {
          svc.activeVersion = savedVer;
        }
      }
    } catch (e) {
      // ignore
    }

    // Automatically create necessary directories
    const pathsToCreate = [
      path.join(this.baseDir, 'bin', 'nginx'),
      path.join(this.baseDir, 'bin', 'php'),
      path.join(this.baseDir, 'bin', 'mysql'),
      path.join(this.baseDir, 'bin', 'apache'),
      path.join(this.baseDir, 'bin', 'composer'),
      path.join(this.baseDir, 'bin', 'node'),
      path.join(this.baseDir, 'bin', 'git'),
      path.join(this.baseDir, 'logs'),
    ];
    pathsToCreate.forEach(p => {
      if (!fs.existsSync(p)) {
        try {
          fs.mkdirSync(p, { recursive: true });
          logger.info(`Created directory: ${p}`);
        } catch (err) {
          logger.error(`Failed to create directory ${p}: ${err}`);
        }
      }
    });
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
      } catch (err) {
        // Ignore read errors
      }
      return null;
    };

    return search(basePath, 0);
  }

  public getAvailableVersions(serviceId: string): string[] {
    const baseDir = path.join(this.baseDir, 'bin', serviceId);
    if (!fs.existsSync(baseDir)) return [];
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch (e) {
      return [];
    }
  }

  public setActiveVersion(serviceId: string, version: string) {
    const svc = this.services.get(serviceId);
    if (svc) {
      svc.activeVersion = version;
      this.exePathCache.delete(serviceId);
      try {
        store.set(`${serviceId}Version`, version);
      } catch (e) {
        // ignore
      }
    }
  }

  public getPhpExtensions(): { name: string, enabled: boolean }[] {
    const phpPath = this.getExecutablePath('php');
    if (!phpPath) return [];
    
    const phpIniPath = path.join(path.dirname(phpPath), 'php.ini');
    const phpIniDevPath = path.join(path.dirname(phpPath), 'php.ini-development');
    
    if (!fs.existsSync(phpIniPath) || fs.statSync(phpIniPath).size === 0) {
      if (fs.existsSync(phpIniDevPath)) {
        let confData = fs.readFileSync(phpIniDevPath, 'utf8');
        // Uncomment extension_dir for Windows
        confData = confData.replace(/^;?extension_dir\s*=\s*"ext"/gm, 'extension_dir = "ext"');
        fs.writeFileSync(phpIniPath, confData);
        logger.info('Auto-initialized php.ini from php.ini-development');
      } else {
        return [];
      }
    }

    try {
      const content = fs.readFileSync(phpIniPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const extensions: { name: string, enabled: boolean }[] = [];
      const extRegex = /^(;?)extension\s*=\s*(.+)$/i;

      for (const line of lines) {
        const match = line.match(extRegex);
        if (match) {
          const isCommented = match[1] === ';';
          let extName = match[2].trim();
          // Strip inline comments if any
          extName = extName.split(';')[0].trim();
          
          // Avoid pushing empty names
          if (extName) {
            extensions.push({ name: extName, enabled: !isCommented });
          }
        }
      }
      return extensions.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      logger.error('Failed to read php.ini');
      return [];
    }
  }

  public togglePhpExtension(extName: string, enable: boolean): boolean {
    const phpPath = this.getExecutablePath('php');
    if (!phpPath) return false;
    
    const phpIniPath = path.join(path.dirname(phpPath), 'php.ini');
    const phpIniDevPath = path.join(path.dirname(phpPath), 'php.ini-development');
    
    if (!fs.existsSync(phpIniPath) || fs.statSync(phpIniPath).size === 0) {
      if (fs.existsSync(phpIniDevPath)) {
        let confData = fs.readFileSync(phpIniDevPath, 'utf8');
        confData = confData.replace(/^;?extension_dir\s*=\s*"ext"/gm, 'extension_dir = "ext"');
        fs.writeFileSync(phpIniPath, confData);
      } else {
        return false;
      }
    }

    try {
      let content = fs.readFileSync(phpIniPath, 'utf8');
      const lines = content.split(/\r?\n/);
      let modified = false;

      const newLines = lines.map(line => {
        const match = line.match(/^(;?)extension\s*=\s*(.+)$/i);
        if (match) {
          const currentExtName = match[2].split(';')[0].trim();
          if (currentExtName === extName) {
            modified = true;
            return enable ? `extension=${match[2].trim()}` : `;extension=${match[2].trim()}`;
          }
        }
        return line;
      });

      if (modified) {
        fs.writeFileSync(phpIniPath, newLines.join('\n'));
        logger.info(`Toggled PHP extension ${extName} to ${enable}`);
        return true;
      }
      return false;
    } catch (e) {
      logger.error(`Failed to toggle php extension: ${e}`);
      return false;
    }
  }

  private exePathCache = new Map<string, { path: string | null, time: number }>();

  public getExecutablePath(serviceId: string): string | null {
    const now = Date.now();
    const cached = this.exePathCache.get(serviceId);
    if (cached && now - cached.time < 5000) {
      return cached.path;
    }

    const svc = this.services.get(serviceId);
    let baseSvcId = serviceId;
    if (serviceId.startsWith('php_')) baseSvcId = 'php';
    
    let baseDir = path.join(this.baseDir, 'bin', baseSvcId);
    
    // If a specific version is selected, use that directory directly
    if (svc && svc.activeVersion) {
      const versionDir = path.join(baseDir, svc.activeVersion);
      if (fs.existsSync(versionDir)) {
        baseDir = versionDir;
      }
    }
    
    let exePath: string | null = null;
    switch (baseSvcId) {
      case 'nginx':
        exePath = this.findExecutable(baseDir, 'nginx.exe'); break;
      case 'php':
        exePath = this.findExecutable(baseDir, 'php-cgi.exe'); break;
      case 'mysql':
        exePath = this.findExecutable(baseDir, 'mysqld.exe'); break;
      case 'apache':
        exePath = this.findExecutable(baseDir, 'httpd.exe'); break;
    }
    
    this.exePathCache.set(serviceId, { path: exePath, time: now });
    return exePath;
  }

  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port);
    });
  }

  public async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    while (await this.isPortInUse(port)) {
      port++;
    }
    return port;
  }

  public getPhpPortForVersion(version: string): number {
    const globalPhpVer = store.get('phpVersion') || this.services.get('php')?.activeVersion;
    if (version === globalPhpVer || !version) {
      return 9000;
    }
    
    const svcId = `php_${version}`;
    if (!this.services.has(svcId)) {
      let nextPort = 9001;
      const usedPorts = Array.from(this.services.values()).map(s => s.port);
      while (usedPorts.includes(nextPort)) nextPort++;

      this.services.set(svcId, {
        id: svcId,
        name: `PHP (${version})`,
        status: 'stopped',
        port: nextPort,
        activeVersion: version
      });
    }
    
    return this.services.get(svcId)!.port;
  }

  public async killProcessOnPort(port: number): Promise<{ success: boolean, error?: string }> {
    // Validate port is a safe integer to prevent injection
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { success: false, error: 'Invalid port number.' };
    }
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        const { execFile } = require('child_process');
        execFile('netstat', ['-ano'], (err: any, stdout: string) => {
          if (err || !stdout) {
            return resolve({ success: false, error: 'Could not find any process using this port.' });
          }
          // Filter for the specific port safely using regex
          const lines = stdout.trim().split('\n');
          let targetPid: string | null = null;
          
          for (const line of lines) {
            // Match: TCP  LocalIp:Port  ForeignIp:Port  State  PID
            const match = line.match(/^\s*(?:TCP|UDP)\s+[^\s]+:(\d+)\s+.*?\s+(\d+)\s*$/i);
            if (match && match[1] === String(port)) {
              targetPid = match[2];
              break;
            }
          }

          if (!targetPid || targetPid === '0') {
            return resolve({ success: false, error: 'Could not find any process using this port.' });
          }

          execFile('taskkill', ['/PID', targetPid, '/F'], (killErr: any) => {
            if (killErr) {
              return resolve({ success: false, error: `Failed to kill process ${targetPid}: ${killErr.message}` });
            }
            resolve({ success: true });
          });
        });
      } else {
        resolve({ success: false, error: 'Not implemented on this platform.' });
      }
    });
  }

  public async setServicePort(serviceId: string, port: number): Promise<{ success: boolean, error?: string }> {
    const svc = this.services.get(serviceId);
    if (!svc) return { success: false, error: 'Service not found' };

    if (svc.status === 'running') {
      return { success: false, error: 'Stop the service first before changing port' };
    }

    const inUse = await this.isPortInUse(port);
    if (inUse) {
      return { success: false, error: `Port ${port} is already in use by another application.` };
    }

    svc.port = port;
    
    try {
      const exePath = this.getExecutablePath(serviceId);
      if (exePath) {
        if (serviceId === 'nginx') {
          const confPath = path.join(path.dirname(exePath), 'conf/nginx.conf');
          if (fs.existsSync(confPath)) {
            let conf = fs.readFileSync(confPath, 'utf8');
            conf = conf.replace(/listen\s+\d+;/i, `listen       ${port};`);
            fs.writeFileSync(confPath, conf);
          }
        } else if (serviceId === 'apache') {
          const confPath = path.join(path.dirname(exePath), '../conf/httpd.conf');
          if (fs.existsSync(confPath)) {
            let conf = fs.readFileSync(confPath, 'utf8');
            conf = conf.replace(/Listen\s+\d+/i, `Listen ${port}`);
            conf = conf.replace(/ServerName\s+localhost:\d+/i, `ServerName localhost:${port}`);
            fs.writeFileSync(confPath, conf);
          }
        } else if (serviceId === 'mysql') {
          const confPath = path.join(path.dirname(exePath), '../my.ini');
          if (fs.existsSync(confPath)) {
            let conf = fs.readFileSync(confPath, 'utf8');
            conf = conf.replace(/port\s*=\s*\d+/gi, `port = ${port}`);
            fs.writeFileSync(confPath, conf);
          }
        }
      }
    } catch (e) {
      logger.error(`Failed to update config file for port change: ${e}`);
    }

    return { success: true };
  }

  public async startService(serviceId: string): Promise<{ success: boolean, error?: string }> {
    const svc = this.services.get(serviceId);
    if (!svc) {
      logger.error(`Service ${serviceId} not found`);
      return { success: false, error: 'Service not found' };
    }

    if (svc.status === 'running') {
      logger.info(`${svc.name} is already running.`);
      return { success: true };
    }

    const inUse = await this.isPortInUse(svc.port);
    if (inUse) {
      logger.info(`Port ${svc.port} is already in use. Auto-killing existing process for ${svc.name}...`);
      const killRes = await this.killProcessOnPort(svc.port);
      if (!killRes.success) {
        logger.error(`Failed to auto-kill process on port ${svc.port}: ${killRes.error}`);
        svc.status = 'error';
        return { success: false, error: `Port ${svc.port} is already in use and could not be killed.` };
      }
      await new Promise(res => setTimeout(res, 1000)); // wait a bit to ensure port is freed
    }

    const exePath = this.getExecutablePath(serviceId);
    if (!exePath) {
      logger.error(`${svc.name} binary not found at expected location.`);
      svc.status = 'error';
      return { success: false, error: 'Binary not found' };
    }

    logger.info(`Starting ${svc.name} on port ${svc.port}...`);

    try {
      let args: string[] = [];
      if (serviceId === 'php' || serviceId.startsWith('php_')) {
        const phpIniPath = path.join(path.dirname(exePath), 'php.ini');
        const phpIniDevPath = path.join(path.dirname(exePath), 'php.ini-development');
        
        if (!fs.existsSync(phpIniPath) && fs.existsSync(phpIniDevPath)) {
          logger.info('Initializing php.ini from development template...');
          fs.copyFileSync(phpIniDevPath, phpIniPath);
        }

        if (fs.existsSync(phpIniPath)) {
          let confData = fs.readFileSync(phpIniPath, 'utf8');
          let modified = false;
          
          if (confData.match(/^;?extension_dir\s*=\s*"ext"/m)) {
            confData = confData.replace(/^;?extension_dir\s*=\s*"ext"/gm, 'extension_dir = "ext"');
            modified = true;
          }

          const extensionsToEnable = ['mysqli', 'pdo_mysql', 'mbstring', 'curl', 'openssl', 'fileinfo', 'gd', 'zip'];
          for (const ext of extensionsToEnable) {
            const regex = new RegExp(`^;extension\\s*=\s*${ext}$`, 'im');
            if (regex.test(confData)) {
              confData = confData.replace(regex, `extension=${ext}`);
              modified = true;
            }
          }
          if (modified) {
            fs.writeFileSync(phpIniPath, confData);
            logger.info('Ensured essential PHP extensions are enabled in php.ini');
          }
        }

        args = ['-b', `127.0.0.1:${svc.port}`];
      } else if (serviceId === 'mysql') {
        const baseDir = path.join(path.dirname(exePath), '..');
        const dataDir = path.join(baseDir, 'data');
        if (!fs.existsSync(dataDir)) {
          logger.info(`Initializing MySQL data directory...`);
          try {
            const { execSync } = require('child_process');
            execSync(`"${exePath}" --initialize-insecure --basedir="${baseDir}" --datadir="${dataDir}" --console`, { windowsHide: true });
            logger.info(`MySQL data directory initialized.`);
          } catch (e: any) {
            logger.error(`Failed to initialize MySQL: ${e.message}`);
          }
        }
        args = ['--basedir=' + baseDir, '--datadir=' + dataDir, '--port=' + svc.port, '--console'];
      } else if (serviceId === 'nginx') {
        // Auto-configure nginx to support phpmyadmin alias, sites-enabled, and localhost docRoot
        const confPath = path.join(path.dirname(exePath), 'conf/nginx.conf');
        if (fs.existsSync(confPath)) {
          try {
            let confData = fs.readFileSync(confPath, 'utf8');
            let modified = false;

            // 1. Ensure sites-enabled is included
            const sitesEnabledDir = path.join(path.dirname(confPath), 'sites-enabled');
            if (!fs.existsSync(sitesEnabledDir)) {
              fs.mkdirSync(sitesEnabledDir, { recursive: true });
            }
            if (!confData.includes('include sites-enabled/*.conf;')) {
              confData = confData.replace(/(http\s*\{)/, `$1\n    include sites-enabled/*.conf;`);
              modified = true;
            }

            // 2. Ensure default root points to document root
            const docRootName = (store.get('docRootName') as string) || 'www';
            const docRoot = path.join(this.baseDir, docRootName).replace(/\\/g, '/');
            if (!confData.includes(`root "${docRoot}";`)) {
              if (confData.includes('location /phpmyadmin {')) {
                confData = confData.replace(/location \/phpmyadmin\s*\{/, `root "${docRoot}";\n        location /phpmyadmin {`);
                modified = true;
              }
            }
            if (confData.includes('index  index.html index.htm;')) {
              confData = confData.replace(/index\s+index\.html\s+index\.htm;/, 'index  index.html index.htm index.php;');
              modified = true;
            }

            // 3. Ensure PHP is enabled for localhost
            if (confData.includes('#location ~ \\.php$ {')) {
              const defaultPhpPort = this.services.get('php')?.port || 9000;
              const phpBlock = `
        location ~ \\.php$ {
            fastcgi_pass   127.0.0.1:${defaultPhpPort};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }`;
              // Find the commented block and replace it
              confData = confData.replace(/#location ~ \\\.php\$ \{[\s\S]*?#\}/, phpBlock);
              modified = true;
            }

            // 4. Try to find phpmyadmin folder dynamically
            const pmaBase = path.join(this.baseDir, 'bin', 'phpmyadmin');
            if (fs.existsSync(pmaBase)) {
              const pmaDirs = fs.readdirSync(pmaBase).filter(d => fs.statSync(path.join(pmaBase, d)).isDirectory());
              if (pmaDirs.length > 0) {
                const pmaPath = path.join(pmaBase, pmaDirs[0]).replace(/\\/g, '/');
                
                // ALWAYS ensure config.inc.php exists with AllowNoPassword
                const pmaConfigPath = path.join(pmaBase, pmaDirs[0], 'config.inc.php');
                if (!fs.existsSync(pmaConfigPath)) {
                  const pmaConfigContent = `<?php
$i = 0;
$i++;
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['host'] = 'localhost';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = true;
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';
?>`;
                  fs.writeFileSync(pmaConfigPath, pmaConfigContent);
                  logger.info('Auto-configured phpMyAdmin config.inc.php with AllowNoPassword.');
                }

                const aliasBlock = `
        location /phpmyadmin {
            alias "${pmaPath}/";
            index index.php index.html index.htm;
            location ~ ^/phpmyadmin/(.+\\.php)$ {
                fastcgi_pass   127.0.0.1:${this.services.get('php')?.port || 9000};
                fastcgi_index  index.php;
                include        fastcgi_params;
                fastcgi_param  SCRIPT_FILENAME "${pmaPath}/$1";
            }
        }\n`;

                if (confData.includes('location /phpmyadmin')) {
                  // Replace old block if it exists
                  confData = confData.replace(/\s*location \/phpmyadmin \{[\s\S]*?\}\s*\}/, '\n' + aliasBlock);
                  modified = true;
                } else {
                  // Inject alias into the default server block (just before the first closing brace of server block)
                  confData = confData.replace(/(\s*)(location \/ \{)/, `$1${aliasBlock}$1$2`);
                  modified = true;
                }
              }
            }

            if (modified) {
              fs.writeFileSync(confPath, confData);
              logger.info('Auto-configured Nginx configurations.');
            }
          } catch (e) {
            logger.error(`Failed to auto-configure Nginx phpmyadmin: ${e}`);
          }
        }
      } else if (serviceId === 'apache') {
        // Automatically update httpd.conf to use port 8080 and correct paths
        const confPath = path.join(path.dirname(exePath), '../conf/httpd.conf');
        if (fs.existsSync(confPath)) {
          try {
            let confData = fs.readFileSync(confPath, 'utf8');
            let modified = false;
            
            if (confData.includes('Listen 80\n') || confData.includes('Listen 80\r\n')) {
              confData = confData.replace(/^Listen 80\b/gm, 'Listen 8080');
              modified = true;
            }
            if (!confData.match(/^ServerName\s+/m)) {
              // Add ServerName if it is commented out to suppress AH00558
              confData = confData.replace(/^#?\s*ServerName\s+.*$/m, `ServerName localhost:${svc.port}`);
              modified = true;
            } else {
              confData = confData.replace(/^ServerName localhost:\d+\b/gm, `ServerName localhost:${svc.port}`);
              modified = true;
            }
            
            if (/c:\/Apache24/i.test(confData)) {
              const actualServerRoot = path.dirname(path.dirname(exePath)).replace(/\\/g, '/');
              confData = confData.replace(/c:\/Apache24/gi, actualServerRoot);
              
              const wwwRoot = path.join(this.baseDir, 'www').replace(/\\/g, '/');
              if (!fs.existsSync(wwwRoot)) fs.mkdirSync(wwwRoot, { recursive: true });
              confData = confData.replace(/^DocumentRoot\s+".*"/gm, `DocumentRoot "${wwwRoot}"`);
              confData = confData.replace(/^<Directory\s+".*htdocs">/gm, `<Directory "${wwwRoot}">`);
              modified = true;
            }
            
            if (modified) {
              fs.writeFileSync(confPath, confData);
              logger.info(`Auto-configured Apache paths and port in httpd.conf`);
            }
          } catch (e) {
            logger.error(`Failed to auto-configure Apache config: ${e}`);
          }
        }
      }

      const cwd = path.dirname(exePath);
      const child = spawn(exePath, args, { cwd, windowsHide: true });

      child.on('error', (err) => {
        logger.error(`Failed to start ${svc.name}: ${err.message}`);
        svc.status = 'error';
        svc.process = undefined;
      });

      child.on('exit', (code) => {
        if (svc.status !== 'stopped') {
          logger.warn(`${svc.name} exited unexpectedly with code ${code}`);
          svc.status = 'stopped';
        }
        svc.process = undefined;
      });

      const handleLogData = (data: Buffer | string, isError: boolean) => {
        const lines = data.toString().split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          if (serviceId === 'mysql') {
            // Suppress known harmless MySQL 8 warnings from cluttering the UI
            if (line.includes('component_reference_cache') || 
                line.includes('Insecure configuration') ||
                line.includes('CA certificate') ||
                line.includes('default_authentication_plugin') ||
                line.includes('Missing data directory for ICU')) {
              continue;
            }

            if (line.includes('[ERROR]')) {
              logger.error(`[${svc.name}] ${line}`);
            } else {
              logger.info(`[${svc.name}] ${line}`);
            }
          } else {
            if (isError) {
              logger.warn(`[${svc.name}] ${line}`);
            } else {
              logger.info(`[${svc.name}] ${line}`);
            }
          }
        }
      };

      child.stdout?.on('data', (data) => handleLogData(data, false));
      child.stderr?.on('data', (data) => handleLogData(data, true));

      svc.process = child;
      svc.status = 'running';
      logger.info(`${svc.name} started successfully.`);
      return { success: true };
    } catch (err) {
      logger.error(`Error spawning ${svc.name}: ${err}`);
      svc.status = 'error';
      return { success: false, error: String(err) };
    }
  }

  public async stopService(serviceId: string): Promise<boolean> {
    const svc = this.services.get(serviceId);
    if (!svc) return false;

    if (svc.status !== 'running' || !svc.process) {
      logger.info(`${svc.name} is not running.`);
      return true;
    }

    logger.info(`Stopping ${svc.name}...`);
    
    // Windows taskkill strategy is often more reliable for deeply detached processes like nginx
    if (process.platform === 'win32') {
      const exeName = path.basename(this.getExecutablePath(serviceId) || `${serviceId}.exe`);
      try {
        require('child_process').execSync(`taskkill /F /IM ${exeName}`, { windowsHide: true, stdio: 'ignore' });
      } catch (e) {}
    } else {
      svc.process.kill('SIGTERM');
    }
    
    svc.status = 'stopped';
    svc.process = undefined;
    logger.info(`${svc.name} stopped.`);
    return true;
  }

  public async setServiceSsl(serviceId: string, enabled: boolean, port: number): Promise<{ success: boolean, error?: string }> {
    const svc = this.services.get(serviceId);
    if (!svc) return { success: false, error: 'Service not found' };

    if (svc.status === 'running') {
      return { success: false, error: 'Stop the service first before changing SSL settings' };
    }

    if (enabled) {
      const inUse = await this.isPortInUse(port);
      if (inUse) {
        return { success: false, error: `Port ${port} is already in use by another application.` };
      }
    }

    // Save to store so it persists
    store.set(`${serviceId}SslEnabled`, enabled);
    store.set(`${serviceId}SslPort`, port);

    try {
      const exePath = this.getExecutablePath(serviceId);
      if (exePath) {
        if (serviceId === 'nginx') {
          const confPath = path.join(path.dirname(exePath), 'conf/nginx.conf');
          if (fs.existsSync(confPath)) {
            let conf = fs.readFileSync(confPath, 'utf8');
            if (conf.match(/listen\s+\d+\s+ssl;/i)) {
              conf = conf.replace(/listen\s+\d+\s+ssl;/ig, `listen       ${port} ssl;`);
            }
            fs.writeFileSync(confPath, conf);
          }
        } else if (serviceId === 'apache') {
          const confPath = path.join(path.dirname(exePath), '../conf/extra/httpd-ssl.conf');
          if (fs.existsSync(confPath)) {
            let conf = fs.readFileSync(confPath, 'utf8');
            conf = conf.replace(/Listen\s+\d+/ig, `Listen ${port}`);
            fs.writeFileSync(confPath, conf);
          }
        }
      }
    } catch (e) {
      logger.error(`Failed to update config file for SSL change: ${e}`);
    }

    return { success: true };
  }

  public getStatus(serviceId: string): ServiceStatus {
    return this.services.get(serviceId)?.status || 'stopped';
  }

  public getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    for (const [id, svc] of this.services.entries()) {
      const exePath = this.getExecutablePath(id);
      const isInstalled = exePath !== null;
      statuses[id] = { 
        status: svc.status, 
        port: svc.port, 
        name: svc.name, 
        isInstalled,
        activeVersion: svc.activeVersion || (exePath ? path.basename(path.dirname(exePath)) : undefined),
        sslPort: store.get(`${id}SslPort`) || 443,
        sslEnabled: store.get(`${id}SslEnabled`) === true
      };
    }
    return statuses;
  }

  public getSabilaPaths(): string[] {
    const paths: string[] = [];
    const services = ['php', 'node', 'mysql', 'composer', 'git'];
    for (const s of services) {
      if (s === 'composer') {
        const cPath = path.join(this.baseDir, 'bin', 'composer');
        if (fs.existsSync(cPath)) paths.push(cPath);
      } else if (s === 'git') {
        const gPath = path.join(this.baseDir, 'bin', 'git', 'cmd');
        if (fs.existsSync(gPath)) paths.push(gPath);
        const gBin = path.join(this.baseDir, 'bin', 'git', 'bin');
        if (fs.existsSync(gBin)) paths.push(gBin);
      } else {
        const exe = this.getExecutablePath(s);
        if (exe) paths.push(path.dirname(exe));
      }
    }
    return paths;
  }
}

// Instantiate with a reasonable base dir, e.g., next to the electron app or C:\sabila
export const serviceManager = new ServiceManager(getBaseDir());
