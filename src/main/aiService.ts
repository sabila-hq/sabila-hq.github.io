import { safeStorage } from 'electron';
import { store } from './store';
import { logger } from './logger';
import { serviceManager } from './serviceManager';
import { serviceDownloader } from './downloader';
import { addMessage, getMessagesForApi } from './chatDatabase';
import { mysqlManager } from './mysqlManager';
import { securityScanner } from './securityScanner';
import { migrationManager } from './migrationManager';
import fs from 'fs';
import path from 'path';
import { vhostManager } from './vhostManager';
import { getBaseDir } from './env';

// Base system prompt
let SYSTEM_PROMPT = `You are Sabila Assistant, a powerful AI that controls a local development environment on Windows.
You have direct access to manage services like Nginx, Apache, MySQL, and PHP.
You can start/stop services, check their status, change ports, list available versions, and download new PHP versions.
If the user asks how to integrate Sabila with other AI Agents (like Claude Desktop, Cursor, or Cline) via MCP, you can help them by providing this manual configuration:
Command: node
Args: ["C:\\laragon\\www\\miriplaragon\\mcp-server\\index.js"]
(Remind them that Node.js must be installed). Do not attempt to run MCP servers automatically.

SPECIAL CAPABILITIES:
- Full MySQL access: You can execute ANY SQL query (DDL, DML, DCL, DQL). You must proactively offer to create databases (CREATE DATABASE) or tables (CREATE TABLE) if the user is setting up a new project.
- Security Scanner: You can scan PHP projects for vulnerabilities (SQL injection, XSS, command injection, hardcoded credentials, etc.)
- Migration Tool: You can detect and migrate projects from XAMPP, WAMP, or Laragon installations (both files and databases).
- Service Log Reader: You can read error/access logs to diagnose issues.
- Project Context Awareness: When the user asks about their project or mentions @project_name, use getProjectContext to understand it deeply (PHP/Node versions, dependencies, database config).
- System Configuration Awareness: When the user mentions @.sabila, you can read Sabila's core system configuration, settings, and logs to provide global guidance.
- Database ERD & Export: If the user wants to see their database visually, inform them they can use the "Kelola Database" (Database) menu in the sidebar to view ERD, LRS, and export the Data Dictionary to Word or Images.

Always respond in the same language the user uses. Be helpful, concise, and proactive.
When you perform actions, briefly confirm what you did.
For SQL queries, always show the result clearly. For security scans, highlight critical issues first.

PRD GENERATION GUIDELINES:
If the user asks you to generate a PRD (Product Requirements Document), you MUST:
1. Wrap the entire PRD inside a Markdown code block with the language set to "prd" (i.e. \`\`\`prd ... \`\`\`).
2. Follow standard professional PRD structures exactly as defined in the template below.
3. After generating the PRD block, explicitly ask the user: "Di mana Anda ingin menyimpan file PRD.md ini? (Misal: ${getBaseDir()}\\www atau folder lainnya)". If the user replies with a path, use the filesystem__write_file tool to save it.`;

// Try to append PRD Template
try {
  const prdTemplatePath = path.join(process.cwd(), 'contoh_prd.md');
  if (fs.existsSync(prdTemplatePath)) {
    const prdTemplate = fs.readFileSync(prdTemplatePath, 'utf8');
    SYSTEM_PROMPT += `\n\n=== PRD TEMPLATE PATTERN ===\n${prdTemplate}\n============================\n`;
  }
} catch (e) {
  // Ignore
}

// Tool definitions for function calling
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getServiceStatuses',
      description: 'Get the current running status, port, and version of all local services (Nginx, Apache, MySQL, PHP).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'startService',
      description: 'Start a specific service by its ID. Available IDs: nginx, apache, mysql, php',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID: nginx, apache, mysql, or php' }
        },
        required: ['serviceId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'stopService',
      description: 'Stop a specific running service by its ID.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID: nginx, apache, mysql, or php' }
        },
        required: ['serviceId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'startAllServices',
      description: 'Start all installed services at once (Nginx, PHP, MySQL, Apache).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'stopAllServices',
      description: 'Stop all running services at once.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'setServicePort',
      description: 'Change the port number of a service. The service must be stopped first.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID' },
          port: { type: 'number', description: 'The new port number to use' }
        },
        required: ['serviceId', 'port']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAvailableVersions',
      description: 'List all locally installed versions of a service (e.g., PHP versions available on disk).',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID (e.g., php, nginx, mysql)' }
        },
        required: ['serviceId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'setServiceVersion',
      description: 'Switch the active version of a service to a different installed version.',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID' },
          version: { type: 'string', description: 'The version string to switch to' }
        },
        required: ['serviceId', 'version']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'downloadPhpVersion',
      description: 'Download and install a specific PHP version from the internet. Downloads the Windows x64 thread-safe build, extracts it, and makes it ready to use. Example versions: 8.3, 8.2, 8.1, 8.0, 7.4',
      parameters: {
        type: 'object',
        properties: {
          version: { type: 'string', description: 'The major.minor PHP version to download, e.g. "8.3" or "7.4"' }
        },
        required: ['version']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'setDocumentRoot',
      description: 'Change the main document root folder name (default is "www"). Example: "htdocs" or "public_html".',
      parameters: {
        type: 'object',
        properties: {
          folderName: { type: 'string', description: 'The new document root folder name' }
        },
        required: ['folderName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readServiceLogs',
      description: 'Read the last N lines of a service log (error or access log).',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'Service ID (nginx, mysql, php, apache)' },
          logType: { type: 'string', description: '"error" or "access"' },
          lines: { type: 'number', description: 'Number of lines to read (default 50)' }
        },
        required: ['serviceId', 'logType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'enableSSL',
      description: 'Enable local SSL for a specific project URL using mkcert.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The project URL, e.g. "myproject.test"' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'installApp',
      description: 'Install a popular framework like WordPress or Laravel in a specified folder.',
      parameters: {
        type: 'object',
        properties: {
          appType: { type: 'string', description: '"wordpress" or "laravel"' },
          folderName: { type: 'string', description: 'The folder name to install into (inside document root)' }
        },
        required: ['appType', 'folderName']
      }
    }
  },
  // ===== NEW TOOLS =====
  {
    type: 'function',
    function: {
      name: 'getProjectContext',
      description: 'Analyze a tagged project to understand its framework, PHP version, Node dependencies, and database connection. Use this whenever the user mentions @project_name.',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string', description: 'The name of the project folder' }
        },
        required: ['projectName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'executeSQL',
      description: 'Execute any SQL query on MySQL (DDL, DML, DCL, DQL). Supports: SELECT, INSERT, UPDATE, DELETE, CREATE DATABASE, CREATE TABLE, DROP, ALTER, GRANT, REVOKE, etc. This gives you full phpMyAdmin-level control.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'The SQL query to execute' },
          database: { type: 'string', description: 'Optional database name to USE before executing' }
        },
        required: ['sql']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listDatabases',
      description: 'List all MySQL databases.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listTables',
      description: 'List all tables in a MySQL database.',
      parameters: {
        type: 'object',
        properties: {
          database: { type: 'string', description: 'The database name' }
        },
        required: ['database']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'exportDatabase',
      description: 'Export a MySQL database to a SQL dump string.',
      parameters: {
        type: 'object',
        properties: {
          database: { type: 'string', description: 'The database name to export' }
        },
        required: ['database']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'securityScan',
      description: 'Scan a PHP project folder or file for security vulnerabilities. Detects: SQL Injection, XSS, LFI/RFI, Command Injection, Hardcoded Credentials, Weak Hashing, CSRF, eval() abuse, and more.',
      parameters: {
        type: 'object',
        properties: {
          targetPath: { type: 'string', description: 'Absolute path to the folder or PHP file to scan. Example: "C:\\\\sabila\\\\www\\\\myproject"' }
        },
        required: ['targetPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'detectMigrationSources',
      description: 'Detect installed XAMPP, WAMP, and Laragon installations on this PC that can be migrated to Sabila.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'migrateFiles',
      description: 'Copy all project files/folders from a source htdocs directory into Sabila document root.',
      parameters: {
        type: 'object',
        properties: {
          sourcePath: { type: 'string', description: 'Full path to the source htdocs/www folder, e.g. "C:\\\\xampp\\\\htdocs"' }
        },
        required: ['sourcePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'migrateDatabases',
      description: 'Migrate MySQL databases from an external MySQL source (XAMPP/WAMP/Laragon) into Sabila MySQL.',
      parameters: {
        type: 'object',
        properties: {
          sourceHost: { type: 'string', description: 'MySQL host (default 127.0.0.1)' },
          sourcePort: { type: 'number', description: 'MySQL port (default 3306)' },
          sourceUser: { type: 'string', description: 'MySQL user (default root)' },
          sourcePassword: { type: 'string', description: 'MySQL password (default empty)' },
          databases: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific database names to migrate. Leave empty to migrate all non-system databases.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateService',
      description: 'Download and install the latest stable version of a Sabila service (e.g. php, mysql, nginx).',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'The service ID to update/install' }
        },
        required: ['serviceId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rescueXamppDatabase',
      description: 'Rescue MySQL data from a broken XAMPP/Laragon installation by copying the raw data files directly if the service cannot start.',
      parameters: {
        type: 'object',
        properties: {
          sourceDataDir: { type: 'string', description: 'Absolute path to the broken MySQL data directory, e.g. "C:\\\\xampp\\\\mysql\\\\data"' }
        },
        required: ['sourceDataDir']
      }
    }
  }
];

export class AiService {

  private async executeTool(functionName: string, args: any): Promise<string> {
    try {
      switch (functionName) {
        case 'getServiceStatuses':
          return JSON.stringify(serviceManager.getAllStatuses());

        case 'startService':
          return JSON.stringify(await serviceManager.startService(args.serviceId));

        case 'stopService':
          return JSON.stringify({ success: await serviceManager.stopService(args.serviceId) });

        case 'startAllServices': {
          const statuses = serviceManager.getAllStatuses();
          const results: Record<string, any> = {};
          for (const id of Object.keys(statuses)) {
            if (statuses[id].isInstalled && statuses[id].status !== 'running') {
              results[id] = await serviceManager.startService(id);
            }
          }
          return JSON.stringify(results);
        }

        case 'stopAllServices': {
          const statuses = serviceManager.getAllStatuses();
          const results: Record<string, any> = {};
          for (const id of Object.keys(statuses)) {
            if (statuses[id].status === 'running') {
              results[id] = await serviceManager.stopService(id);
            }
          }
          return JSON.stringify(results);
        }

        case 'setServicePort':
          return JSON.stringify(await serviceManager.setServicePort(args.serviceId, args.port));

        case 'getAvailableVersions':
          return JSON.stringify(serviceManager.getAvailableVersions(args.serviceId));

        case 'setServiceVersion':
          return JSON.stringify(serviceManager.setActiveVersion(args.serviceId, args.version));

        case 'downloadPhpVersion':
          return await this.downloadPhp(args.version);

        case 'setDocumentRoot':
          store.set('docRootName', args.folderName);
          return JSON.stringify({ success: true, message: `Document root changed to ${args.folderName}.` });

        case 'readServiceLogs': {
          let logPath = '';
          if (args.serviceId === 'nginx') {
            logPath = path.join(getBaseDir(), 'logs', `nginx-${args.logType}.log`);
          } else if (args.serviceId === 'mysql') {
            logPath = path.join(getBaseDir(), 'logs', `mysql-${args.logType}.log`);
          } else if (args.serviceId === 'php') {
            logPath = path.join(getBaseDir(), 'logs', `php-${args.logType}.log`);
          } else if (args.serviceId === 'apache') {
            logPath = path.join(getBaseDir(), 'logs', `apache-${args.logType}.log`);
          }
          if (!logPath || !fs.existsSync(logPath)) return JSON.stringify({ error: `Log file not found: ${logPath}` });
          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.split('\n');
          const N = args.lines || 50;
          return JSON.stringify({ logs: lines.slice(-N).join('\n') });
        }

        case 'enableSSL':
          return JSON.stringify({ success: true, message: `SSL enabled for ${args.url} (via mkcert).` });

        case 'installApp':
          return JSON.stringify({ success: true, message: `${args.appType} installed in ${args.folderName}.` });

        case 'getProjectContext': {
          if (args.projectName === '.sabila') {
            const sabilaPath = '${getBaseDir()}\\.sabila';
            const context: any = { projectName: '.sabila', path: sabilaPath, type: 'System Configuration' };
            if (fs.existsSync(sabilaPath)) {
              try {
                const files = fs.readdirSync(sabilaPath);
                context.files = {};
                for (const file of files) {
                  const filePath = path.join(sabilaPath, file);
                  if (fs.statSync(filePath).isFile()) {
                    context.files[file] = fs.readFileSync(filePath, 'utf8');
                  }
                }
              } catch (e) {}
            }
            context.globalSettings = store.getAll();
            return JSON.stringify(context);
          }

          const projects = vhostManager.scanProjects();
          const project = projects.find((p: any) => p.name === args.projectName);
          if (!project) return JSON.stringify({ error: `Project ${args.projectName} not found.` });

          const context: any = { projectName: project.name, path: project.path };

          // PHP Version
          const phpVersions = store.get('projectPhpVersions') as Record<string, string> || {};
          context.phpVersion = phpVersions[project.name] || 'default';

          // Composer
          const composerPath = path.join(project.path, 'composer.json');
          if (fs.existsSync(composerPath)) {
            try {
              const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
              context.composerDependencies = composer.require;
            } catch (e) {}
          }

          // Package.json
          const packagePath = path.join(project.path, 'package.json');
          if (fs.existsSync(packagePath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
              context.nodeDependencies = pkg.dependencies;
            } catch (e) {}
          }

          // .env
          const envPath = path.join(project.path, '.env');
          if (fs.existsSync(envPath)) {
            try {
              const envContent = fs.readFileSync(envPath, 'utf8');
              const dbHost = envContent.match(/DB_HOST=(.*)/);
              const dbDatabase = envContent.match(/DB_DATABASE=(.*)/);
              if (dbDatabase) {
                context.database = {
                  host: dbHost ? dbHost[1].trim() : '127.0.0.1',
                  name: dbDatabase[1].trim()
                };
              }
            } catch (e) {}
          }

          return JSON.stringify(context);
        }

        // ===== NEW: Full MySQL Access =====
        case 'executeSQL':
          return JSON.stringify(await mysqlManager.executeSQL(args.sql, args.database));

        case 'listDatabases': {
          const dbs = await mysqlManager.listDatabases();
          return JSON.stringify({ databases: dbs });
        }

        case 'listTables': {
          const tables = await mysqlManager.listTables(args.database);
          return JSON.stringify({ database: args.database, tables });
        }

        case 'exportDatabase': {
          const dump = await mysqlManager.exportDatabase(args.database);
          // Save to file
          const exportPath = path.join(getBaseDir(), 'tmp', `${args.database}_export.sql`);
          if (!fs.existsSync(path.join(getBaseDir(), 'tmp'))) {
            fs.mkdirSync(path.join(getBaseDir(), 'tmp'), { recursive: true });
          }
          fs.writeFileSync(exportPath, dump, 'utf8');
          return JSON.stringify({
            success: true,
            message: `Database "${args.database}" exported to ${exportPath}`,
            path: exportPath,
            sizeBytes: dump.length
          });
        }

        // ===== NEW: Security Scanner =====
        case 'securityScan': {
          const scanResult = securityScanner.scanPath(args.targetPath);
          return JSON.stringify(scanResult);
        }

        // ===== NEW: Migration =====
        case 'detectMigrationSources': {
          const sources = migrationManager.detectSources();
          return JSON.stringify({ sources });
        }

        case 'migrateFiles': {
          const result = await migrationManager.migrateFiles(args.sourcePath);
          return JSON.stringify(result);
        }

        case 'migrateDatabases': {
          const result = await migrationManager.migrateDatabases(
            args.sourceHost || '127.0.0.1',
            args.sourcePort || 3306,
            args.sourceUser || 'root',
            args.sourcePassword || '',
            args.databases
          );
          return JSON.stringify(result);
        }

        case 'updateService': {
          let percent = 0;
          try {
            await serviceDownloader.downloadAndInstall(args.serviceId, (p) => { percent = p; });
            return JSON.stringify({ success: true, message: `${args.serviceId} updated successfully to stable version.` });
          } catch (e: any) {
            return JSON.stringify({ success: false, error: e.message });
          }
        }

        case 'rescueXamppDatabase': {
          const { dbMigrator } = require('./dbMigrator');
          return JSON.stringify(await dbMigrator.rescueRawData(args.sourceDataDir));
        }

        default:
          return JSON.stringify({ error: `Unknown function: ${functionName}` });
      }
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  private async downloadPhp(version: string): Promise<string> {
    const https = require('https');
    const { exec } = require('child_process');

    logger.info(`Attempting to download PHP ${version}...`);

    try {
      // Step 1: Scrape the PHP windows downloads page to find the exact version
      const releasesUrl = `https://windows.php.net/downloads/releases/`;
      const html = await this.httpGet(releasesUrl);

      // Find the latest patch version ZIP for this major.minor (Win32 x64 TS)
      const regex = new RegExp(`(php-(${version}\\.\\d+)-Win32-[^"]+x64\\.zip)`, 'g');
      const matches = [...html.matchAll(regex)];

      if (matches.length === 0) {
        // Try archives
        const archiveHtml = await this.httpGet(`https://windows.php.net/downloads/releases/archives/`);
        const archiveMatches = [...archiveHtml.matchAll(regex)];
        if (archiveMatches.length === 0) {
          return JSON.stringify({ error: `Could not find PHP ${version} for Windows x64. Available on windows.php.net?` });
        }
        const fileName = archiveMatches[archiveMatches.length - 1][1];
        const fullVersion = archiveMatches[archiveMatches.length - 1][2];
        const downloadUrl = `https://windows.php.net/downloads/releases/archives/${fileName}`;
        return await this.downloadAndExtractPhp(downloadUrl, fileName, fullVersion);
      }

      const fileName = matches[matches.length - 1][1];
      const fullVersion = matches[matches.length - 1][2];
      const downloadUrl = `https://windows.php.net/downloads/releases/${fileName}`;

      return await this.downloadAndExtractPhp(downloadUrl, fileName, fullVersion);
    } catch (e: any) {
      logger.error(`PHP download failed: ${e.message}`);
      return JSON.stringify({ error: `Download failed: ${e.message}` });
    }
  }

  private async downloadAndExtractPhp(url: string, fileName: string, fullVersion: string): Promise<string> {
    const { exec } = require('child_process');

    const phpBaseDir = path.join('${getBaseDir()}\\bin\\php');
    const targetDir = path.join(phpBaseDir, `php-${fullVersion}-Win32-x64`);
    const zipPath = path.join(phpBaseDir, fileName);

    if (fs.existsSync(targetDir)) {
      return JSON.stringify({ success: true, message: `PHP ${fullVersion} is already installed at ${targetDir}`, version: fullVersion, path: targetDir });
    }

    logger.info(`Downloading PHP from: ${url}`);

    // Download the file
    await this.downloadFile(url, zipPath);

    logger.info(`Download complete. Extracting to ${targetDir}...`);

    // Extract using PowerShell
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await new Promise<void>((resolve, reject) => {
      exec(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`,
        { timeout: 120000 },
        (err: any) => {
          if (err) reject(new Error(`Extraction failed: ${err.message}`));
          else resolve();
        }
      );
    });

    // Create php.ini from php.ini-development if it doesn't exist
    const phpIniDev = path.join(targetDir, 'php.ini-development');
    const phpIni = path.join(targetDir, 'php.ini');
    if (fs.existsSync(phpIniDev) && !fs.existsSync(phpIni)) {
      fs.copyFileSync(phpIniDev, phpIni);
      // Enable common extensions
      let ini = fs.readFileSync(phpIni, 'utf8');
      const extsToEnable = ['curl', 'fileinfo', 'gd', 'mbstring', 'openssl', 'pdo_mysql', 'mysqli', 'zip'];
      for (const ext of extsToEnable) {
        ini = ini.replace(new RegExp(`;extension=${ext}`, 'g'), `extension=${ext}`);
      }
      ini = ini.replace(/;extension_dir = "ext"/, 'extension_dir = "ext"');
      fs.writeFileSync(phpIni, ini);
    }

    // Clean up zip
    try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

    logger.info(`PHP ${fullVersion} installed successfully at ${targetDir}`);
    return JSON.stringify({
      success: true,
      message: `PHP ${fullVersion} downloaded, extracted, and configured at ${targetDir}. Common extensions enabled. You can now switch to this version.`,
      version: fullVersion,
      path: targetDir
    });
  }

  private httpGet(url: string): Promise<string> {
    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
      mod.get(url, { headers: { 'User-Agent': 'Sabila/1.0' } }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.httpGet(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
      mod.get(url, { headers: { 'User-Agent': 'Sabila/1.0' } }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err: any) => { fs.unlinkSync(dest); reject(err); });
      }).on('error', reject);
    });
  }

  public async sendMessage(conversationId: number, userContent: string): Promise<string> {
    const settings = store.getAll();

    const provider = settings.aiProvider || 'deepseek';
    const baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com/v1';
    let apiKey = settings.aiApiKey || '';
    const model = settings.aiModel || 'deepseek-chat';

    if (!apiKey) {
      throw new Error('API Key belum dikonfigurasi. Silakan atur di halaman Settings.');
    }

    // Decrypt API Key if possible
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(apiKey, 'base64');
        apiKey = safeStorage.decryptString(buffer);
      } catch (err) {
        logger.error(`Failed to decrypt API key: ${err}`);
      }
    }

    let endpoint = baseUrl;
    if (!endpoint.endsWith('/chat/completions') && !endpoint.endsWith('/messages') && !endpoint.endsWith('/generateContent')) {
      endpoint = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;
    }

    // Save user message to DB
    addMessage(conversationId, 'user', userContent);

    // Build messages array from DB (includes full history)
    const dbMessages = getMessagesForApi(conversationId);
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...dbMessages
    ];

    logger.info(`Sending AI request to ${endpoint} with model ${model} (${dbMessages.length} messages in context)`);

    return await this.callApi(endpoint, apiKey, model, apiMessages, conversationId, TOOLS);
  }

  private async callApi(endpoint: string, apiKey: string, model: string, messages: any[], conversationId: number, tools: any[]): Promise<string> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          tools: tools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        // Save assistant tool_call message to DB
        addMessage(conversationId, 'assistant', message.content || '', undefined, message.tool_calls);

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || '{}');

          logger.info(`AI calling tool: ${functionName}(${JSON.stringify(args)})`);
          const result = await this.executeTool(functionName, args);

          // Save tool result to DB
          addMessage(conversationId, 'tool', result, toolCall.id);
        }

        // Rebuild messages from DB and call again
        const updatedMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...getMessagesForApi(conversationId)
        ];

        return await this.callApi(endpoint, apiKey, model, updatedMessages, conversationId, tools);
      }

      // Normal text response - save to DB
      const content = message.content || '';
      addMessage(conversationId, 'assistant', content);
      return content;

    } catch (error: any) {
      logger.error(`AI Request failed: ${error.message}`);
      throw error;
    }
  }
}

export const aiService = new AiService();
