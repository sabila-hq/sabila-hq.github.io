import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { store } from './store';
import { serviceManager } from './serviceManager';

import { SslManager } from './sslManager';
import { getBaseDir } from './env';

export interface ProjectInfo {
  id: string;
  name: string;
  url: string;
  path: string;
}

export class VhostManager {
  private baseDir: string;
  private sslManager: SslManager;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.sslManager = new SslManager(baseDir);
  }

  public get nginxConfDir(): string {
    const nginxExe = serviceManager.getExecutablePath('nginx');
    if (nginxExe) {
      return path.join(path.dirname(nginxExe), 'conf', 'sites-enabled');
    }
    return path.join(this.baseDir, 'bin', 'nginx', 'conf', 'sites-enabled');
  }

  public getDocumentRoot(): string {
    const docRootName = store.get('docRootName') || 'www';
    return path.join(this.baseDir, docRootName);
  }

  public scanProjects(): ProjectInfo[] {
    const docRoot = this.getDocumentRoot();
    const projects: ProjectInfo[] = [];

    if (!fs.existsSync(docRoot)) {
      try {
        fs.mkdirSync(docRoot, { recursive: true });
        logger.info(`Created document root at ${docRoot}`);
      } catch (err) {
        logger.error(`Failed to create doc root: ${err}`);
        return projects;
      }
    }

    try {
      const entries = fs.readdirSync(docRoot, { withFileTypes: true });
      let idCounter = 1;
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const name = entry.name;
          const url = `${name}.test`;
          projects.push({
            id: String(idCounter++),
            name,
            url,
            path: path.join(docRoot, name).replace(/\\/g, '/'), // Nginx prefers forward slashes
          });
        }
      }
    } catch (err) {
      logger.error(`Failed to scan projects: ${err}`);
    }

    return projects;
  }

  public async generateNginxConfigs(projects: ProjectInfo[]) {
    const confDir = this.nginxConfDir;
    if (!fs.existsSync(confDir)) {
      try {
        fs.mkdirSync(confDir, { recursive: true });
      } catch (err) {
        logger.warn(`Nginx conf dir not found and cannot be created: ${confDir}. Skipping config generation.`);
        return;
      }
    }

    logger.info(`Generating Nginx configs for ${projects.length} projects...`);
    
    // Clear old configs
    try {
      const oldFiles = fs.readdirSync(confDir);
      for (const file of oldFiles) {
        if (file.endsWith('.conf')) {
          fs.unlinkSync(path.join(confDir, file));
        }
      }
    } catch (err) {
      logger.error(`Failed to clean old nginx configs: ${err}`);
    }

    // Initialize SSL CA if not done
    await this.sslManager.setupCA();

    const projectPhpVersions = store.get('projectPhpVersions') || {};

    // Write new configs
    for (const proj of projects) {
      const customPhpVersion = projectPhpVersions[proj.name] || '';
      const fastcgiPort = serviceManager.getPhpPortForVersion(customPhpVersion);

      let documentRoot = proj.path;
      if (fs.existsSync(path.join(proj.path, 'public'))) {
        documentRoot = path.join(proj.path, 'public').replace(/\\/g, '/');
      }

      // Generate local cert for this project
      const certs = await this.sslManager.generateCertForProject(proj.name, proj.url);

      let sslBlock = '';
      if (certs) {
        const certPath = certs.certPath.replace(/\\/g, '/');
        const keyPath = certs.keyPath.replace(/\\/g, '/');
        sslBlock = `
    listen 443 ssl;
    ssl_certificate "${certPath}";
    ssl_certificate_key "${keyPath}";
`;
      }

      let fastcgiSecretsBlock = '';
      const projectSecrets = store.get('projectSecrets') as Record<string, any> || {};
      const projSecrets = projectSecrets[proj.name] || {};
      for (const key in projSecrets) {
        fastcgiSecretsBlock += `\n        fastcgi_param ${key} "${projSecrets[key]}";`;
      }

      let isNodeProject = false;
      if (fs.existsSync(path.join(proj.path, 'package.json')) && !fs.existsSync(path.join(proj.path, 'composer.json'))) {
        isNodeProject = true;
      }

      let proxyBlock = `
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
`;

      let phpBlock = `
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \\.php$ {
        fastcgi_pass   127.0.0.1:${fastcgiPort};
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME $document_root$fastcgi_script_name;${fastcgiSecretsBlock}
        include        fastcgi_params;
    }
`;

      const confContent = `
server {
    listen 80;
    server_name ${proj.url} *.${proj.url};
    ${sslBlock}
    root "${documentRoot}";
    
    index index.html index.htm index.php;
    
${isNodeProject ? proxyBlock : phpBlock}
}
`;
      try {
        fs.writeFileSync(path.join(confDir, `${proj.name}.conf`), confContent.trim());
      } catch (err) {
        logger.error(`Failed to write config for ${proj.name}: ${err}`);
      }
    }
  }

  public async syncHostsFile(projects: ProjectInfo[]) {
    logger.info(`Requested to sync hosts file for ${projects.length} projects.`);
    
    const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
    const tmpHostsPath = path.join(this.baseDir, 'tmp', 'hosts.new');
    
    // Ensure tmp dir exists
    const tmpDir = path.dirname(tmpHostsPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    try {
      let currentHosts = '';
      if (fs.existsSync(hostsPath)) {
        currentHosts = fs.readFileSync(hostsPath, 'utf8');
      }

      // Remove existing Sabila block
      const startMarker = '# --- SABILA AUTO-GENERATED ---';
      const endMarker = '# --- END SABILA ---';
      
      const startIndex = currentHosts.indexOf(startMarker);
      const endIndex = currentHosts.indexOf(endMarker);
      
      let newHosts = currentHosts;
      if (startIndex !== -1 && endIndex !== -1) {
        newHosts = currentHosts.substring(0, startIndex) + currentHosts.substring(endIndex + endMarker.length);
      }

      // Clean up multiple empty lines
      newHosts = newHosts.replace(/\n\s*\n\s*\n/g, '\n\n').trim() + '\n\n';

      // Build new block
      let sabilaBlock = `${startMarker}\n`;
      for (const proj of projects) {
        sabilaBlock += `127.0.0.1 ${proj.url}\n`;
      }
      sabilaBlock += `${endMarker}\n`;

      newHosts += sabilaBlock;

      // Write to tmp file
      fs.writeFileSync(tmpHostsPath, newHosts);

      // Copy using PowerShell RunAs to get Administrator privileges
      const { exec } = require('child_process');
      const innerCommand = `Copy-Item '${tmpHostsPath}' '${hostsPath}' -Force`;
      const encodedCommand = Buffer.from(innerCommand, 'utf16le').toString('base64');
      const psCommand = `Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', '${encodedCommand}' -Verb RunAs -Wait`;
      
      return new Promise<void>((resolve, reject) => {
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, (error: any) => {
          if (error) {
            logger.error(`Failed to update hosts file: ${error}`);
            reject(error);
          } else {
            logger.info('Successfully updated Windows hosts file.');
            resolve();
          }
        });
      });

    } catch (err: any) {
      logger.error(`Error processing hosts file: ${err.message}`);
      throw err;
    }
  }
}

export const vhostManager = new VhostManager(getBaseDir());
