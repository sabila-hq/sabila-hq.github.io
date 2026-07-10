import { app, shell, BrowserWindow, ipcMain, safeStorage, Tray, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Import backend modules
import { serviceManager } from './serviceManager'
import { vhostManager } from './vhostManager'
import { store } from './store'
import { logger } from './logger'
import { aiService } from './aiService'
import { toolsManager } from './toolsManager'
import * as chatDb from './chatDatabase'
import { fileExplorer } from './fileExplorer'

// New feature imports
import { tunnelManager } from './tunnelManager'
import { generateApp, AppTemplate } from './appGenerator'
import { logViewer } from './logViewer'
import { mailCatcher } from './mailCatcher'
import { httpApi } from './httpApi'
import { dbManager } from './dbManager'
import { getBaseDir } from './env'
import fs from 'fs'
import { serviceDownloader } from './downloader'
import { CliManager } from './cliManager'
import { dbMigrator } from './dbMigrator'
import { cronManager } from './cronManager'
import { setupApiTesterIpc } from './apiTester'

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): void {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault();
      isQuitting = true;
      
      logger.info('Shutting down: Stopping all services...');
      const statuses = serviceManager.getAllStatuses();
      for (const id of Object.keys(statuses)) {
        if (statuses[id].status === 'running') {
          await serviceManager.stopService(id);
        }
      }
      
      app.quit();
    }
  })

  mainWindow = win;
}
// Disable GPU cache to prevent "Unable to move the cache: Access is denied" errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sabila')
  logger.info('Sabila starting...');
  httpApi.start(31337);
  setupApiTesterIpc();

  // Initialize standard Laragon directories for compatibility and structure
  const fs = require('fs');
  const path = require('path');
  const baseDir = getBaseDir();
  const dirs = ['data', 'data/mysql', 'etc', 'tmp', 'usr', 'www'];
  dirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
        logger.info(`Created standard directory: ${fullPath}`);
      } catch (e) {
        logger.error(`Failed to create directory ${fullPath}: ${e}`);
      }
    }
  });

  // Initialize AI Context Files in .sabila
  const dotSabilaPath = path.join(baseDir, '.sabila');
  if (!fs.existsSync(dotSabilaPath)) {
    try {
      fs.mkdirSync(dotSabilaPath, { recursive: true });
      const mcpJson = {
        "mcpServers": {
          "sabila-mysql": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-mysql", "mysql://root@127.0.0.1:3306/"]
          },
          "sabila-filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\\\sabila\\\\www"]
          }
        }
      };
      const skillsMd = `# Sabila AI Development Guidelines

You are assisting a developer inside the Sabila environment.
Sabila is a local development server for Windows (similar to Laragon/XAMPP).

## Environment Details
- **Web Root:** \`${getBaseDir()}\\www\`
- **MySQL Database:** Running on \`127.0.0.1:3306\`, user: \`root\`, no password by default.
- **Nginx/Apache:** Hosted locally.
- **PHP:** Multiple versions supported.

## Access
- You have access to the MySQL database via the \`sabila-mysql\` MCP.
- You have access to the project files via the \`sabila-filesystem\` MCP.

Always leverage these MCP servers when requested to manage files or query databases for the user's project.`;
      
      fs.writeFileSync(path.join(dotSabilaPath, 'mcp.json'), JSON.stringify(mcpJson, null, 2));
      fs.writeFileSync(path.join(dotSabilaPath, 'Skills.md'), skillsMd);
      logger.info('Created AI context files in .sabila');
    } catch (e) {
      logger.error(`Failed to create .sabila context files: ${e}`);
    }
  }

  // Ensure CLI is registered
  try {
    const cliManager = new CliManager(baseDir);
    await cliManager.setupCli();
  } catch (e) {
    logger.error(`Failed to setup CLI: ${e}`);
  }

  // Ensure Nginx vhosts are generated on startup
  try {
    const projects = vhostManager.scanProjects();
    await vhostManager.generateNginxConfigs(projects);
  } catch (e) {
    logger.error(`Failed to generate vhosts on startup: ${e}`);
  }

  // Initialize extra PHP versions from projects
  const projectPhpVersions: Record<string, string> = store.get('projectPhpVersions') as Record<string, string> || {};
  const uniquePhpVersions = new Set<string>();
  for (const proj in projectPhpVersions) {
    if (projectPhpVersions[proj]) {
      uniquePhpVersions.add(projectPhpVersions[proj]);
    }
  }
  uniquePhpVersions.forEach(version => {
    serviceManager.getPhpPortForVersion(version);
  });

  // Setup Tray
  const iconPath = join(__dirname, '../../resources/icon.png');
  // fallback to build/icon.png if resources/icon.png not found
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    try {
      tray = new Tray(join(__dirname, '../../build/icon.png'));
    } catch(err) {
      // Guaranteed fallback icon (a 16x16 blue square in base64)
      const fallbackBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAXSURBVDhPY/z//z9VQILhwIABA4wMBAAzRBoG3C0nJAAAAABJRU5ErkJggg==';
      const { nativeImage } = require('electron');
      tray = new Tray(nativeImage.createFromDataURL(fallbackBase64));
    }
  }
  
  if (tray) {
    let currentIconType = 'off';
    setInterval(() => {
      try {
        const statuses = serviceManager.getAllStatuses();
        const isAnyRunning = Object.values(statuses).some((s: any) => s.status === 'running');
        const nextIconType = isAnyRunning ? 'on' : 'off';
        
        if (nextIconType !== currentIconType) {
          const fs = require('fs');
          const newIconPath = join(__dirname, isAnyRunning ? '../../build/sabila_on.png' : '../../build/icon.png');
          if (fs.existsSync(newIconPath)) {
            const { nativeImage } = require('electron');
            tray?.setImage(nativeImage.createFromPath(newIconPath));
          }
          currentIconType = nextIconType;
        }
      } catch (e) {
        // silently ignore error
      }
    }, 2000);

    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Tampilkan Sabila', 
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        } 
      },
      { 
        label: 'Keluar', 
        click: () => { 
          isQuitting = true;
          app.quit();
        } 
      }
    ]);
    tray.setToolTip('Sabila');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  // Window Controls
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });
  ipcMain.on('window-hide', () => mainWindow?.hide());

  ipcMain.handle('select-local-model', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Pilih File Model Lokal (.gguf)',
      filters: [{ name: 'GGUF Models', extensions: ['gguf'] }],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC Handlers
  ipcMain.handle('get-system-specs', () => {
    const os = require('os');
    return {
      platform: os.platform() === 'win32' ? 'Windows' : os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      ram: Math.round(os.totalmem() / (1024 * 1024 * 1024))
    };
  });
  
  ipcMain.handle('get-services', () => serviceManager.getAllStatuses())
  ipcMain.handle('start-service', async (_, id) => await serviceManager.startService(id))
  ipcMain.handle('stop-service', async (_, id) => await serviceManager.stopService(id))
  
  ipcMain.handle('get-projects', () => vhostManager.scanProjects())
  ipcMain.handle('sync-projects', async (_, projects) => {
    await vhostManager.generateNginxConfigs(projects);
    await vhostManager.syncHostsFile(projects);
    
    // Restart nginx if running to apply changes
    if (serviceManager.getAllStatuses()['nginx']?.status === 'running') {
       await serviceManager.stopService('nginx');
       await new Promise(resolve => setTimeout(resolve, 500));
       await serviceManager.startService('nginx');
    }
    
    return true;
  });
  
  ipcMain.handle('ensure-project-services', async (_, projectName) => {
    // Start nginx
    await serviceManager.startService('nginx');
    // Start mysql (optional but good for most projects)
    await serviceManager.startService('mysql');
    
    // Start php specific to this project
    const projectPhpVersions: Record<string, string> = store.get('projectPhpVersions') as Record<string, string> || {};
    const projVer = projectPhpVersions[projectName];
    if (projVer) {
      await serviceManager.startService(`php_${projVer}`);
    } else {
      await serviceManager.startService('php');
    }
    return true;
  });

  ipcMain.handle('delete-project', async (_, projectName, projectPath) => {
    try {
      // 1. Delete project directory
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }
      // 2. Remove specific PHP config
      const projectPhpVersions = store.get('projectPhpVersions') || {};
      if (projectPhpVersions[projectName]) {
        delete projectPhpVersions[projectName];
        store.set('projectPhpVersions', projectPhpVersions);
      }
      // 3. Remove Nginx config if it exists
      const nginxConfPath = path.join(vhostManager.nginxConfDir, `${projectName}.conf`);
      if (fs.existsSync(nginxConfPath)) {
        fs.unlinkSync(nginxConfPath);
      }
      return { success: true };
    } catch (e: any) {
      logger.error(`Failed to delete project ${projectName}: ${e}`);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('prepare-project-deps', async (event, projectPath) => {
    return new Promise((resolve) => {
      const sendLog = (msg: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('prep-progress', { log: msg });
        }
      };

      const runCmd = (cmd: string, args: string[]) => {
        return new Promise<boolean>((res) => {
          const { spawn } = require('child_process');
          const child = spawn(cmd, args, { cwd: projectPath, shell: true, windowsHide: true });
          
          child.stdout.on('data', (d: any) => sendLog(d.toString()));
          child.stderr.on('data', (d: any) => sendLog(d.toString()));
          
          child.on('exit', (code: number) => {
            res(code === 0);
          });
          child.on('error', (err: any) => {
            sendLog(`Error: ${err.message}`);
            res(false);
          });
        });
      };

      (async () => {
        let hasComposer = fs.existsSync(path.join(projectPath, 'composer.json'));
        let hasNpm = fs.existsSync(path.join(projectPath, 'package.json'));
        let hasArtisan = fs.existsSync(path.join(projectPath, 'artisan'));
        
        let success = true;
        
        if (hasComposer) {
          sendLog('Menjalankan composer install...\n');
          success = success && await runCmd('composer', ['install']);
        }
        
        if (hasNpm) {
          sendLog('Menjalankan npm install...\n');
          success = success && await runCmd('npm', ['install']);
        }

        // Jalankan perintah dev server di terminal terpisah
        let devCommands: string[] = [];
        
        if (hasArtisan) {
          devCommands.push('php artisan serve');
          if (hasNpm) devCommands.push('npm run dev');
        } else if (hasNpm) {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
            if (pkg?.scripts?.dev) devCommands.push('npm run dev');
            else if (pkg?.scripts?.start) devCommands.push('npm start');
            else if (fs.existsSync(path.join(projectPath, 'index.js'))) devCommands.push('node index.js');
          } catch (e) {
            if (fs.existsSync(path.join(projectPath, 'index.js'))) devCommands.push('node index.js');
          }
        }

        if (devCommands.length > 0) {
          const combinedCmd = devCommands.join(' & ');
          sendLog(`\nMenjalankan dev server (${combinedCmd}) di terminal terpisah...\n`);
          const { spawn } = require('child_process');
          
          // Construct custom env with PATH similar to open-project-terminal if needed
          const pathModule = require('path');
          const projName = pathModule.basename(projectPath);
          const sabilaPaths = serviceManager.getSabilaPaths();
          
          const projectPhpVersions = store.get('projectPhpVersions') || {};
          const pPhp = (projectPhpVersions as Record<string, string>)[projName];
          if (pPhp) {
            sabilaPaths.unshift(pathModule.join(getBaseDir(), 'bin', 'php', pPhp));
          }
          
          const projectNodeVersions = store.get('projectNodeVersions') || {};
          const pNode = (projectNodeVersions as Record<string, string>)[projName];
          if (pNode) {
            sabilaPaths.unshift(pathModule.join(getBaseDir(), 'bin', 'node', pNode));
          }
          
          const projectSecrets = store.get('projectSecrets') || {};
          const projSecrets = (projectSecrets as Record<string, any>)[projName] || {};
          
          const customEnv = { ...process.env, ...projSecrets };
          if (sabilaPaths.length > 0) {
            const uniquePaths = Array.from(new Set(sabilaPaths));
            customEnv.PATH = `${uniquePaths.join(';')};${process.env.PATH}`;
          }

          try {
            spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', combinedCmd], {
              cwd: projectPath,
              env: customEnv,
              detached: true,
              shell: true
            });
          } catch (err: any) {
            sendLog(`Gagal membuka terminal: ${err.message}\n`);
          }
        }
        
        resolve(success);
      })();
    });
  });

  ipcMain.handle('get-php-versions', () => serviceManager.getAvailableVersions('php'))
  ipcMain.handle('get-project-php-version', (_, projName) => {
    const projectPhpVersions = store.get('projectPhpVersions') || {};
    return projectPhpVersions[projName] || '';
  })
  ipcMain.handle('set-project-php-version', async (_, projName, version) => {
    const projectPhpVersions: Record<string, string> = store.get('projectPhpVersions') as Record<string, string> || {};
    if (version) {
      projectPhpVersions[projName] = version;
    } else {
      delete projectPhpVersions[projName];
    }
    store.set('projectPhpVersions', projectPhpVersions);
    
    // Auto-sync config
    const projects = vhostManager.scanProjects();
    await vhostManager.generateNginxConfigs(projects);
    
    // Ensure PHP process is started if it's new
    if (version) {
      const globalPhpVer = store.get('phpVersion') || serviceManager.getAvailableVersions('php')[0];
      if (version !== globalPhpVer) {
        // Find the dynamic service ID and start it
        const port = serviceManager.getPhpPortForVersion(version);
        await serviceManager.startService(`php_${version}`);
      }
    }

    // Restart nginx if running
    if (serviceManager.getAllStatuses()['nginx']?.status === 'running') {
       await serviceManager.stopService('nginx');
       await new Promise(resolve => setTimeout(resolve, 500)); // wait for OS to free port
       await serviceManager.startService('nginx');
    }
    return true;
  })

  ipcMain.handle('get-node-versions', () => {
    return toolsManager.getAvailableVersions('node');
  });
  
  ipcMain.handle('get-project-node-version', (_, projName) => {
    const projectNodeVersions = store.get('projectNodeVersions') || {};
    return projectNodeVersions[projName] || '';
  });
  
  ipcMain.handle('set-project-node-version', async (_, projName, version) => {
    const projectNodeVersions: Record<string, string> = store.get('projectNodeVersions') as Record<string, string> || {};
    if (version) {
      projectNodeVersions[projName] = version;
    } else {
      delete projectNodeVersions[projName];
    }
    store.set('projectNodeVersions', projectNodeVersions);
    return true;
  });

  ipcMain.handle('get-project-secrets', (_, projName) => {
    const projectSecrets = store.get('projectSecrets') || {};
    return projectSecrets[projName] || {};
  });

  ipcMain.handle('set-project-secrets', async (_, projName, secrets) => {
    const projectSecrets: Record<string, any> = store.get('projectSecrets') as Record<string, any> || {};
    projectSecrets[projName] = secrets;
    store.set('projectSecrets', projectSecrets);
    
    // Auto-sync Nginx configs to apply new fastcgi_param secrets
    const projects = vhostManager.scanProjects();
    await vhostManager.generateNginxConfigs(projects);
    
    // Restart nginx if running to apply changes
    if (serviceManager.getAllStatuses()['nginx']?.status === 'running') {
       await serviceManager.stopService('nginx');
       await new Promise(resolve => setTimeout(resolve, 500));
       await serviceManager.startService('nginx');
    }
    return true;
  });



  ipcMain.handle('detect-ides', async () => {
    return new Promise((resolve) => {
      const { execFile } = require('child_process');
      const isWin = process.platform === 'win32';
      const checkCmd = isWin ? 'where' : 'which';
      
      const ides = [
        { id: 'code', name: 'VS Code' },
        { id: 'cursor', name: 'Cursor' },
        { id: 'phpstorm64', name: 'PHPStorm' },
        { id: 'subl', name: 'Sublime Text' },
        { id: 'notepad++', name: 'Notepad++' }
      ];
      
      const detectPromises = ides.map(ide => {
        return new Promise<any>((res) => {
          execFile(checkCmd, [ide.id], (error: any) => {
            if (!error) res(ide);
            else res(null);
          });
        });
      });

      Promise.all(detectPromises).then(results => {
        resolve(results.filter(r => r !== null));
      });
    });
  });

  ipcMain.handle('open-project-terminal', async (_, targetPath: string) => {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const pathModule = require('path');
      
      const projName = pathModule.basename(targetPath);
      
      // Get global paths
      const sabilaPaths = serviceManager.getSabilaPaths();
      
      // Override with project-specific paths if they exist
      const projectPhpVersions = store.get('projectPhpVersions') || {};
      const projectNodeVersions = store.get('projectNodeVersions') || {};
      
      const pPhp = projectPhpVersions[projName];
      if (pPhp) {
        const phpDir = pathModule.join(getBaseDir(), 'bin', 'php', pPhp);
        sabilaPaths.unshift(phpDir);
      }
      
      const pNode = projectNodeVersions[projName];
      if (pNode) {
        const nodeDir = pathModule.join(getBaseDir(), 'bin', 'node', pNode);
        sabilaPaths.unshift(nodeDir);
      }
      
      const projectSecrets = store.get('projectSecrets') || {};
      const projSecrets = projectSecrets[projName] || {};
      
      const customEnv = { ...process.env, ...projSecrets };
      if (sabilaPaths.length > 0) {
        // Unique paths to prevent duplicates
        const uniquePaths = Array.from(new Set(sabilaPaths));
        customEnv.PATH = `${uniquePaths.join(';')};${process.env.PATH}`;
      }
      
      const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe'], { cwd: targetPath, env: customEnv, shell: true });
      child.on('exit', () => resolve(true));
      child.on('error', (err: any) => {
        logger.error(`Failed to open terminal: ${err.message}`);
        resolve(false);
      });
    });
  });

  ipcMain.handle('open-in-ide', async (_, targetPath: string, ideId?: string) => {
    // Whitelist allowed IDE commands to prevent command injection
    const ALLOWED_IDES = ['code', 'cursor', 'phpstorm64', 'subl', 'notepad++'];
    const { execFile } = require('child_process');
    
    const selectedIde = ideId && ALLOWED_IDES.includes(ideId) ? ideId : 'code';
    
    return new Promise((resolve) => {
      execFile(selectedIde, [targetPath], (error: any) => {
        if (error) {
          logger.error(`Failed to open IDE: ${error.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  })

  ipcMain.handle('download-service', async (event, serviceId: string) => {
    try {
      await serviceDownloader.downloadAndInstall(serviceId, (percent) => {
        // Send progress updates back to the specific event sender
        event.sender.send('download-progress', { serviceId, percent });
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('scan-rescue-databases', async (_, sourcePath: string) => {
    return await dbMigrator.scanRescueDatabases(sourcePath);
  });

  ipcMain.handle('discover-rescue-sources', async () => {
    return dbMigrator.discoverRescueSources();
  });

  ipcMain.handle('fix-xampp-mysql', async (event, sourcePath: string) => {
    return await dbMigrator.fixXamppMysql(sourcePath);
  });

  ipcMain.handle('open-xampp-control', async (_, sourcePath: string) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    // Stop Sabila services first
    const services = serviceManager.getAllStatuses();
    for (const [id, svc] of Object.entries(services)) {
      if (svc.status === 'running') {
        await serviceManager.stopService(id);
      }
    }

    // Attempt to open xampp-control.exe
    const xamppDir = path.join(sourcePath, '..', '..');
    const xamppControl = path.join(xamppDir, 'xampp-control.exe');
    const fs = require('fs');

    if (fs.existsSync(xamppControl)) {
      spawn(xamppControl, [], { detached: true, stdio: 'ignore' }).unref();
      return { success: true };
    } else {
      return { success: false, message: 'Tidak dapat menemukan xampp-control.exe di direktori ' + xamppDir };
    }
  });

  ipcMain.handle('open-config-file', async (_, serviceId: string) => {
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const execPath = serviceManager.getExecutablePath(serviceId);
    
    if (execPath) {
      let configPath = '';
      const basePath = path.dirname(execPath);
      
      if (serviceId === 'php') configPath = path.join(basePath, 'php.ini');
      else if (serviceId === 'mysql') configPath = path.join(basePath, '../my.ini');
      else if (serviceId === 'nginx') configPath = path.join(basePath, 'conf/nginx.conf');
      else if (serviceId === 'apache') configPath = path.join(basePath, '../conf/httpd.conf');
      
      if (configPath) {
        if (!fs.existsSync(configPath)) {
           // touch the file so notepad can open it
           let defaultContent = '';
           if (serviceId === 'mysql') {
             defaultContent = '[mysqld]\nport = 3306\nbasedir = .\ndatadir = ./data\n';
           }
           fs.writeFileSync(configPath, defaultContent);
        }
        exec(`start notepad "${configPath}"`);
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('get-project-info', async (_, targetPath: string) => {
    return new Promise(async (resolve) => {
      const { exec } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      
      const runCmd = (cmd: string): Promise<string> => {
        return new Promise((res) => {
          const tools = toolsManager.getInstalledTools();
          const sabilaPaths: string[] = [];
          
          const nodeTool = tools.find(t => t.id === 'node');
          if (nodeTool && nodeTool.path) sabilaPaths.push(path.dirname(nodeTool.path));
          
          const projName = path.basename(targetPath);
          const projectPhpVersions = store.get('projectPhpVersions') as Record<string, string> || {};
          const activePhp = projectPhpVersions[projName] || store.get('phpVersion');
          
          let phpAdded = false;
          if (activePhp) {
            const phpDir = path.join(getBaseDir(), 'bin', 'php', activePhp as string);
            if (fs.existsSync(phpDir)) {
              sabilaPaths.push(phpDir);
              phpAdded = true;
            }
          }
          if (!phpAdded) {
            const phpTool = tools.find(t => t.id === 'php');
            if (phpTool && phpTool.path) sabilaPaths.push(path.dirname(phpTool.path));
          }
          
          const composerTool = tools.find(t => t.id === 'composer');
          if (composerTool && composerTool.path) sabilaPaths.push(path.dirname(composerTool.path));

          const customEnv: Record<string, string | undefined> = { ...process.env, COMPOSER_NO_INTERACTION: '1' };
          if (sabilaPaths.length > 0) {
            customEnv.PATH = `${sabilaPaths.join(';')};${process.env.PATH}`;
          }

          exec(cmd, { cwd: targetPath, env: customEnv }, (err: any, stdout: string) => {
            if (stdout && stdout.trim()) {
              res(stdout);
            } else {
              res('');
            }
          });
        });
      };

      const results: { name: string; version: string }[] = [];

      // PHP
      const phpOut = await runCmd('php -v');
      if (phpOut) {
        const match = phpOut.match(/PHP\s+([\d\.]+)/);
        results.push({ name: 'PHP', version: match ? match[1] : phpOut.split('\n')[0].trim() });
      } else results.push({ name: 'PHP', version: 'Not installed' });

      // Node
      const nodeOut = await runCmd('node -v');
      if (nodeOut) {
        results.push({ name: 'Node.js', version: nodeOut.trim().replace(/^v/, '') });
      } else results.push({ name: 'Node.js', version: 'Not installed' });

      // Composer
      const compOut = await runCmd('composer -V --no-ansi');
      if (compOut) {
        const match = compOut.match(/Composer version\s+([\d\.]+)/i);
        results.push({ name: 'Composer', version: match ? match[1] : compOut.split('\n')[0].trim() });
      } else results.push({ name: 'Composer', version: 'Not installed' });

      // NPM
      const npmOut = await runCmd('npm -v');
      if (npmOut) {
        results.push({ name: 'NPM', version: npmOut.trim() });
      } else results.push({ name: 'NPM', version: 'Not installed' });

      // Framework Detection
      try {
        if (fs.existsSync(path.join(targetPath, 'artisan'))) {
          const artOut = await runCmd('php artisan --version');
          if (artOut) {
            const match = artOut.match(/(?:Laravel Framework\s+)?([\d\.]+)/i);
            results.push({ name: 'Laravel', version: match ? match[1] : artOut.trim() });
          } else {
            results.push({ name: 'Laravel', version: 'Unknown' });
          }
        } else if (fs.existsSync(path.join(targetPath, 'wp-includes', 'version.php'))) {
          const content = fs.readFileSync(path.join(targetPath, 'wp-includes', 'version.php'), 'utf8');
          const match = content.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
          results.push({ name: 'WordPress', version: match ? match[1] : 'Unknown' });
        } else if (fs.existsSync(path.join(targetPath, 'spark'))) {
          // CodeIgniter 4
          const artOut = await runCmd('php spark --version');
          let versionFound = false;
          if (artOut) {
            const match = artOut.match(/CodeIgniter v([\d\.]+)/i);
            if (match) {
              results.push({ name: 'CodeIgniter', version: match[1] });
              versionFound = true;
            }
          }
          if (!versionFound) {
            const systemPath = path.join(targetPath, 'system', 'CodeIgniter.php');
            if (fs.existsSync(systemPath)) {
              const content = fs.readFileSync(systemPath, 'utf8');
              const match = content.match(/const\s+CI_VERSION\s*=\s*['"]([^'"]+)['"]/);
              results.push({ name: 'CodeIgniter', version: match ? match[1] : '4.x' });
            } else {
              results.push({ name: 'CodeIgniter', version: '4.x' });
            }
          }
        } else if (fs.existsSync(path.join(targetPath, 'system', 'core', 'CodeIgniter.php'))) {
          // CodeIgniter 3
          const content = fs.readFileSync(path.join(targetPath, 'system', 'core', 'CodeIgniter.php'), 'utf8');
          const match = content.match(/define\s*\(\s*['"]CI_VERSION['"]\s*,\s*['"]([^'"]+)['"]/);
          results.push({ name: 'CodeIgniter', version: match ? match[1] : '3.x' });
        }
      } catch (e) {
        // ignore errors reading framework versions
      }

      resolve(results);
    });
  });
  // Directory Tree
  ipcMain.handle('get-dir-tree', async (_, targetPath) => {
    return await fileExplorer.getDirectoryInfo(targetPath)
  })

  // Service Options
  ipcMain.handle('get-service-versions', (_, id) => serviceManager.getAvailableVersions(id))
  ipcMain.handle('set-service-version', (_, id, version) => serviceManager.setActiveVersion(id, version))
  ipcMain.handle('set-service-port', async (_, id, port) => await serviceManager.setServicePort(id, port))
  ipcMain.handle('set-service-ssl', async (_, id, enabled, port) => await serviceManager.setServiceSsl(id, enabled, port))
  ipcMain.handle('find-available-port', async (_, startPort) => await serviceManager.findAvailablePort(startPort))
  ipcMain.handle('kill-process-on-port', async (_, port) => await serviceManager.killProcessOnPort(port))
  
  ipcMain.handle('open-file', (_, filePath: string) => {
    const { execFile } = require('child_process');
    const normalizedPath = require('path').resolve(filePath);
    execFile('notepad++', [normalizedPath], (error: any) => {
      if (error) {
        shell.openPath(normalizedPath);
      }
    });
  })
  
  ipcMain.handle('execute-file', (_, filePath: string) => {
    const { exec } = require('child_process');
    const normalizedPath = require('path').resolve(filePath);
    if (process.platform === 'win32') {
      exec(`start cmd.exe /K "${normalizedPath}"`);
    } else {
      shell.openPath(normalizedPath);
    }
  })
  
  ipcMain.handle('open-directory', (_, dirPath) => shell.openPath(dirPath))

  // Tools
  ipcMain.handle('get-tools', () => toolsManager.getInstalledTools())
  ipcMain.handle('open-terminal', (_, toolId) => toolsManager.openTerminal(toolId))
  ipcMain.handle('get-tool-versions', (_, toolId) => toolsManager.getAvailableVersions(toolId))
  ipcMain.handle('set-tool-version', (_, toolId, version) => {
    toolsManager.setActiveVersion(toolId, version);
    if (['php', 'mysql', 'nginx', 'apache'].includes(toolId)) {
      serviceManager.setActiveVersion(toolId, version);
    }
    toolsManager.clearCache();
  })

  ipcMain.handle('get-dashboard-items', () => {
    return store.get('dashboardItems') || ['nginx', 'apache', 'php', 'mysql'];
  })

  ipcMain.handle('toggle-dashboard-item', (_, toolId) => {
    let items = (store.get('dashboardItems') as string[]) || ['nginx', 'apache', 'php', 'mysql'];
    if (items.includes(toolId)) {
      items = items.filter(id => id !== toolId);
    } else {
      items.push(toolId);
    }
    store.set('dashboardItems', items);
    return items;
  })

  // Bulk Start/Stop
  ipcMain.handle('start-all-services', async () => {
    const statuses = serviceManager.getAllStatuses();
    const results: Record<string, { success: boolean, error?: string }> = {};
    for (const id of Object.keys(statuses)) {
      if (statuses[id].isInstalled && statuses[id].status !== 'running') {
        results[id] = await serviceManager.startService(id);
      }
    }
    return results;
  })
  ipcMain.handle('stop-all-services', async () => {
    const statuses = serviceManager.getAllStatuses();
    const results: Record<string, boolean> = {};
    for (const id of Object.keys(statuses)) {
      if (statuses[id].status === 'running') {
        results[id] = await serviceManager.stopService(id);
      }
    }
    return results;
  })

  // PHP Extensions
  ipcMain.handle('get-php-extensions', () => {
    return serviceManager.getPhpExtensions();
  })
  
  ipcMain.handle('toggle-php-extension', (_, extName: string, enable: boolean) => {
    return serviceManager.togglePhpExtension(extName, enable);
  })

  // Config Reader/Writer
  ipcMain.handle('project-env-get', (_, projectPath: string) => {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(projectPath, '.env');
    const htPath = path.join(projectPath, '.htaccess');
    return {
      env: fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '',
      htaccess: fs.existsSync(htPath) ? fs.readFileSync(htPath, 'utf8') : ''
    };
  })

  ipcMain.handle('project-env-set', (_, projectPath: string, type: 'env' | 'htaccess', content: string) => {
    const fs = require('fs');
    const path = require('path');
    // Only allow writing .env or .htaccess (prevent path traversal)
    const allowedFiles = ['.env', '.htaccess'];
    const fileName = type === 'env' ? '.env' : '.htaccess';
    if (!allowedFiles.includes(fileName)) return false;
    const targetFile = path.join(path.resolve(projectPath), fileName);
    // Ensure target is within a reasonable directory
    if (!targetFile.startsWith(path.resolve(projectPath))) return false;
    try {
      fs.writeFileSync(targetFile, content, 'utf8');
      return true;
    } catch {
      return false;
    }
  })

  // Local Domains & SSL
  ipcMain.handle('get-project-urls', (_, projectName: string) => {
    const httpPort = serviceManager.getAllStatuses()['apache']?.port || 80;
    const httpsPort = 443;
    const url = `http://${projectName}.test${httpPort !== 80 ? ':' + httpPort : ''}`;
    const urlHttps = `https://${projectName}.test${httpsPort !== 443 ? ':' + httpsPort : ''}`;
    return { http: url, https: urlHttps };
  })

  ipcMain.handle('project-enable-ssl', async (_, projectName: string) => {
    const { execFile } = require('child_process');
    const path = require('path');
    const sslDir = path.join(getBaseDir(), 'etc', 'ssl');
    
    // Validate projectName to prevent command injection (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
      return { success: false, error: 'Invalid project name. Only alphanumeric, dash, and underscore allowed.' };
    }
    
    const fs = require('fs');
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir, { recursive: true });
    }
    
    return new Promise((resolve) => {
      execFile('mkcert', [`${projectName}.test`], { cwd: sslDir }, (err: any) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true });
      });
    });
  })
  ipcMain.handle('get-settings', () => {
    const data = store.getAll()
    if (data.aiApiKey && safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(data.aiApiKey, 'base64')
        data.aiApiKey = safeStorage.decryptString(buffer).trim()
      } catch (e) {
        // May not be encrypted or invalid base64
      }
    }
    return data
  })
  
  ipcMain.handle('save-settings', (_, data) => {
    if (data.aiApiKey && safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = safeStorage.encryptString(data.aiApiKey.trim())
        data.aiApiKey = buffer.toString('base64')
      } catch (e) {
        logger.error('Failed to encrypt API key')
      }
    }
    store.setAll(data)
  })

  ipcMain.handle('rename-doc-root', async (_, newName: string) => {
    const oldName = store.get('docRootName') || 'www';
    if (newName === oldName) return { success: true };

    const oldPath = path.join(getBaseDir(), String(oldName));
    const newPath = path.join(getBaseDir(), String(newName));
    
    try {
      // 1. Stop all services to release file locks
      logger.info('Stopping services before renaming doc root...');
      const statuses = serviceManager.getAllStatuses();
      const activeServices = Object.keys(statuses).filter(s => statuses[s].status === 'running');
      for (const s of activeServices) {
        await serviceManager.stopService(s);
      }

      // 2. Wait a bit for OS to release locks
      await new Promise(res => setTimeout(res, 2000));

      // 3. Rename folder
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        logger.info(`Successfully renamed document root from ${oldName} to ${newName}`);
      }

      // 4. Save to store
      store.set('docRootName', newName);

      // 5. Trigger nginx config regen
      const projects = vhostManager.scanProjects();
      await vhostManager.generateNginxConfigs(projects);

      // 6. Restart previously running services
      logger.info('Restarting services after renaming doc root...');
      for (const s of activeServices) {
        await serviceManager.startService(s);
      }

      return { success: true };
    } catch (e: any) {
      logger.error(`Failed to rename document root: ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  // AI Chat with SQLite memory
  ipcMain.handle('ai-chat-send', async (event, conversationId: number, userContent: string) => {
    return await aiService.sendMessage(conversationId, userContent, (token) => {
      event.sender.send('ai-local-progress', token);
    });
  })
  ipcMain.handle('chat-create-conversation', (_, title?: string) => {
    return chatDb.createConversation(title || 'New Chat');
  })
  ipcMain.handle('chat-list-conversations', () => {
    return chatDb.listConversations();
  })
  ipcMain.handle('chat-get-messages', (_, conversationId: number) => {
    return chatDb.getMessages(conversationId);
  })
  ipcMain.handle('chat-delete-conversation', (_, conversationId: number) => {
    chatDb.deleteConversation(conversationId);
    return true;
  })
  ipcMain.handle('chat-update-title', (_, conversationId: number, title: string) => {
    chatDb.updateConversationTitle(conversationId, title);
    return true;
  })
  ipcMain.handle('test-ai-connection', async (_, baseUrl: string, apiKey: string) => {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
      });
      return { ok: res.ok, status: res.status };
    } catch (e: any) {
      return { ok: false, status: 0, error: e.message };
    }
  })

  ipcMain.handle('test-local-ai', async (_, modelPath: string) => {
    try {
      const fs = require('fs');
      if (!modelPath) return { ok: false, error: 'Path model tidak boleh kosong' };
      if (!fs.existsSync(modelPath)) return { ok: false, error: 'File tidak ditemukan di sistem' };
      
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(modelPath, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      
      const magic = buffer.toString('utf8');
      if (magic !== 'GGUF') {
        return { ok: false, error: 'File bukan format GGUF yang valid (Signature tidak cocok)' };
      }
      
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  })
  
  ipcMain.handle('show-alert', async (_, message: string, buttons?: string[]) => {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    const opts = { type: 'info', message, title: 'Sabila', buttons: buttons || ['OK'] };
    let res;
    if (win) {
      res = await dialog.showMessageBox(win, opts);
    } else {
      res = await dialog.showMessageBox(opts);
    }
    return res.response;
  })

  // ============================================================
  // NEW FEATURE: Share Local to Public (Tunnel Manager)
  // ============================================================
  ipcMain.handle('tunnel-start', async (_, projectName: string, localPort: number, subdomain?: string) => {
    return await tunnelManager.startTunnel(projectName, localPort, subdomain);
  })
  ipcMain.handle('tunnel-stop', async (_, projectName: string) => {
    return await tunnelManager.stopTunnel(projectName);
  })
  ipcMain.handle('tunnel-list', () => {
    return tunnelManager.getActiveTunnels();
  })



  // ============================================================
  // NEW FEATURE: Quick App Generator
  // ============================================================
  ipcMain.handle('generate-app', async (_, template: AppTemplate, projectName: string) => {
    const settings = store.getAll();
    const docRoot = `${getBaseDir()}\\${settings.docRootName || 'www'}`;
    return await generateApp({ template, projectName, docRoot });
  })

  // ============================================================
  // NEW FEATURE: Real-Time Log Viewer
  // ============================================================
  ipcMain.handle('log-get-files', () => {
    return logViewer.getLogFiles();
  })
  ipcMain.handle('log-read-tail', (_, logId: string, lines?: number) => {
    return logViewer.readLogTail(logId, lines);
  })
  ipcMain.handle('log-start-watching', (_, logId: string) => {
    return logViewer.startWatching(logId);
  })
  ipcMain.handle('log-stop-watching', (_, logId: string) => {
    logViewer.stopWatching(logId);
    return true;
  })
  ipcMain.handle('log-clear', (_, logId: string) => {
    return logViewer.clearLog(logId);
  })

  // ============================================================
  // NEW FEATURE: Local Mail Catcher
  // ============================================================
  ipcMain.handle('mail-start', async () => {
    return await mailCatcher.start();
  })
  ipcMain.handle('mail-stop', () => {
    mailCatcher.stop();
    return true;
  })
  ipcMain.handle('mail-status', () => {
    return { running: mailCatcher.isRunning(), port: mailCatcher.getPort() };
  })
  ipcMain.handle('mail-list', () => {
    return mailCatcher.getMessages();
  })
  ipcMain.handle('mail-get', (_, id: string) => {
    return mailCatcher.getMessage(id);
  })
  ipcMain.handle('mail-delete', (_, id: string) => {
    return mailCatcher.deleteMessage(id);
  })
  ipcMain.handle('mail-clear', () => {
    mailCatcher.clearAll();
    return true;
  })

  // ============================================================
  // Database Explorer
  // ============================================================
  ipcMain.handle('db-connect', async (_, config) => {
    return await dbManager.connect(config);
  });
  ipcMain.handle('db-disconnect', async () => {
    return await dbManager.disconnect();
  });
  ipcMain.handle('db-get-databases', async () => {
    return await dbManager.getDatabases();
  });
  ipcMain.handle('db-get-tables', async (_, database) => {
    return await dbManager.getTables(database);
  });
  ipcMain.handle('db-query', async (_, sql) => {
    return await dbManager.query(sql);
  });
  ipcMain.handle('db-create-snapshot', async (_, database: string, port: number) => {
    return await dbManager.createSnapshot(database, port);
  });
  ipcMain.handle('db-list-snapshots', async (_, database?: string) => {
    return await dbManager.listSnapshots(database);
  });
  ipcMain.handle('db-restore-snapshot', async (_, filename: string, port: number) => {
    return await dbManager.restoreSnapshot(filename, port);
  });
  ipcMain.handle('db-get-schema', async (_, config: any, database: string) => {
    return await dbManager.getSchema(config, database);
  });
  ipcMain.handle('db-get-detailed-schema', async (_, config: any, database: string) => {
    return await dbManager.getDetailedSchema(config, database);
  });
  ipcMain.handle('db-delete-snapshot', async (_, filename: string) => {
    return await dbManager.deleteSnapshot(filename);
  });
  ipcMain.handle('db-copy-snapshot', async (_, filename: string, targetDatabase: string, port: number) => {
    return await dbManager.copySnapshot(filename, targetDatabase, port);
  });
  ipcMain.handle('db-export-snapshot', async (event, filename: string) => {
    const { dialog } = require('electron');
    const path = require('path');
    
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: filename,
      filters: [{ name: 'SQL File', extensions: ['sql'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };
    
    try {
      const sourcePath = path.join(getBaseDir(), 'data', 'db_snapshots', filename);
      fs.copyFileSync(sourcePath, filePath);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle('db-export-sql', async (event, database: string, port: number) => {
    const { dialog } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: `Export Database: ${database}`,
      defaultPath: `${database}_export.sql`,
      filters: [{ name: 'SQL File', extensions: ['sql'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };
    return await dbManager.exportSql(database, port, filePath);
  });

  ipcMain.handle('db-import-sql', async (event, database: string, port: number) => {
    const { dialog } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: `Import SQL to Database: ${database}`,
      filters: [{ name: 'SQL File', extensions: ['sql'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return { success: false, canceled: true };
    return await dbManager.importSql(database, port, filePaths[0]);
  });

  // ============================================================
  // Setup Wizard & About
  // ============================================================
  ipcMain.handle('check-node-installed', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      exec('node -v', (err: any, stdout: string) => {
        if (err) return resolve({ installed: false });
        const nodeVersion = stdout.trim();
        exec('npm -v', (err2: any, stdout2: string) => {
          resolve({ installed: true, nodeVersion, npmVersion: err2 ? 'N/A' : stdout2.trim() });
        });
      });
    });
  })

  ipcMain.handle('get-setup-complete', () => {
    const fs = require('fs');
    const path = require('path');
    const flagPath = path.join(app.getPath('userData'), '.setup-complete');
    return fs.existsSync(flagPath);
  })

  ipcMain.handle('set-setup-complete', () => {
    const fs = require('fs');
    const path = require('path');
    const flagPath = path.join(app.getPath('userData'), '.setup-complete');
    fs.writeFileSync(flagPath, new Date().toISOString(), 'utf8');
    return true;
  })

  ipcMain.handle('open-external-url', (_, url: string) => {
    // Only allow http/https URLs to prevent arbitrary protocol execution
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
      return true;
    }
    logger.warn(`Blocked non-http(s) external URL: ${url}`);
    return false;
  })

  ipcMain.handle('browse-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Pilih Folder Utama',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  })

  ipcMain.handle('install-node-auto', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window found' };

    const nodeUrl = 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip';
    const session = win.webContents.session;

    const result = await new Promise((resolve) => {
      const listener = (e: any, item: any, webContents: any) => {
        const nodePath = require('path');
        const nodeFs = require('fs');
        const binDir = nodePath.join(getBaseDir(), 'bin');
        if (!nodeFs.existsSync(binDir)) nodeFs.mkdirSync(binDir, { recursive: true });

        const savePath = nodePath.join(binDir, item.getFilename());
        item.setSavePath(savePath);

        item.on('updated', (ev: any, state: string) => {
          if (state === 'progressing' && !item.isPaused()) {
            const progress = (item.getReceivedBytes() / item.getTotalBytes()) * 100;
            win.webContents.send('download-progress', { toolId: 'node-setup', progress, savePath });
          }
        });

        item.once('done', async (ev: any, state: string) => {
          session.removeListener('will-download', listener);
          if (state === 'completed') {
            try {
              win.webContents.send('download-progress', { toolId: 'node-setup', progress: 100, status: 'Menginstal...' });
              const { exec } = require('child_process');
              const nodeDir = nodePath.join(getBaseDir(), 'bin', 'node');
              const extractTemp = nodePath.join(nodeDir, 'temp_extract');
              if (!nodeFs.existsSync(nodeDir)) nodeFs.mkdirSync(nodeDir, { recursive: true });
              if (nodeFs.existsSync(extractTemp)) nodeFs.rmSync(extractTemp, { recursive: true, force: true });
              nodeFs.mkdirSync(extractTemp, { recursive: true });

              await new Promise((res, rej) => {
                exec(`powershell -Command "Expand-Archive -Path '${savePath}' -DestinationPath '${extractTemp}' -Force"`, (err: any) => {
                  if (err) rej(err); else res(true);
                });
              });

              const entries = nodeFs.readdirSync(extractTemp);
              const nodeFolder = entries.find((en: string) => en.startsWith('node-') && nodeFs.statSync(nodePath.join(extractTemp, en)).isDirectory());
              if (nodeFolder) {
                const versionMatch = nodeFolder.match(/node-v([\d\.]+)/);
                const version = versionMatch ? versionMatch[1] : 'latest';
                const targetDir = nodePath.join(nodeDir, version);

                if (nodeFs.existsSync(targetDir)) nodeFs.rmSync(targetDir, { recursive: true, force: true });
                nodeFs.renameSync(nodePath.join(extractTemp, nodeFolder), targetDir);

                nodeFs.rmSync(extractTemp, { recursive: true, force: true });
                nodeFs.unlinkSync(savePath);

                if (!store.get('nodeVersion')) {
                  store.set('nodeVersion', version);
                }

                resolve({ success: true, version });
              } else {
                resolve({ success: false, error: 'Invalid zip structure' });
              }
            } catch (e: any) {
              resolve({ success: false, error: e.message });
            }
          } else {
            resolve({ success: false, error: state });
          }
        });
      };

      session.on('will-download', listener);
      win.webContents.downloadURL(nodeUrl);
    });
    toolsManager.clearCache();
    return result;
  })

  ipcMain.handle('scan-project-security', async (event, projectPath: string) => {
    try {
      const { securityScanner } = require('./securityScanner');
      const result = securityScanner.scanPath(projectPath);
      return { success: true, result };
    } catch (e: any) {
      logger.error('Failed to scan project security: ' + e);
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // Recipe Export/Import
  // ============================================================
  ipcMain.handle('export-recipe', async (event) => {
    try {
      const tools = toolsManager.getInstalledTools();
      const stack: Record<string, string> = {};
      
      for (const t of tools) {
        if (t.isInstalled && t.activeVersion && t.activeVersion !== '-') {
          stack[t.id] = t.activeVersion;
        } else if (t.isInstalled && t.id === 'composer') {
           stack[t.id] = t.version || 'installed';
        }
      }

      const recipe = {
        name: "Sabila Recipe",
        exportedAt: new Date().toISOString(),
        stack
      };

      const win = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        title: 'Export Recipe',
        defaultPath: 'sabila-recipe.json',
        filters: [{ name: 'JSON File', extensions: ['json'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2), 'utf8');
      return { success: true, filePath };
    } catch (e: any) {
      logger.error('Failed to export recipe: ' + e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('import-recipe', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        title: 'Import Recipe',
        filters: [{ name: 'JSON File', extensions: ['json'] }],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) return { success: false, canceled: true };

      const fs = require('fs');
      const content = fs.readFileSync(filePaths[0], 'utf8');
      const recipe = JSON.parse(content);

      if (!recipe.stack) throw new Error("Format recipe tidak valid (tidak ada properti 'stack').");

      const results = [];
      for (const [toolId, version] of Object.entries(recipe.stack)) {
        if (typeof version !== 'string') continue;
        
        // Skip informational tools
        if (toolId === 'composer' || toolId === 'git' || toolId === 'phpmyadmin') {
           results.push({ toolId, version, status: 'skipped (unmanaged)' });
           continue;
        }

        const available = toolsManager.getAvailableVersions(toolId);
        if (available.includes(version)) {
          // It's installed, set as active
          toolsManager.setActiveVersion(toolId, version);
          results.push({ toolId, version, status: 'activated' });
        } else {
          results.push({ toolId, version, status: 'missing' });
        }
      }

      toolsManager.clearCache(); // Force refresh tools list

      return { success: true, recipeName: recipe.name, results };
    } catch (e: any) {
      logger.error('Failed to import recipe: ' + e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('download-tool', async (event, toolId: string, url: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window found' };
    
    // Set up a one-time listener for the download
    const session = win.webContents.session;
    
    const result = await new Promise((resolve) => {
      const listener = (e: any, item: any, webContents: any) => {
        const itemUrls = item.getURLChain();
        if (!itemUrls.includes(url) && item.getURL() !== url) {
          return; // Ignore other downloads
        }
        
        // Remove listener immediately so it doesn't intercept others
        session.removeListener('will-download', listener);
        
        // Set the save path to C:\sabila\bin\<filename>
        const path = require('path');
        const fs = require('fs');
        const binDir = path.join(getBaseDir(), 'bin');
        if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
        
        const savePath = path.join(binDir, item.getFilename());
        item.setSavePath(savePath);
        
        item.on('updated', (event: any, state: string) => {
          if (state === 'interrupted') {
            logger.error('Download is interrupted but can be resumed');
          } else if (state === 'progressing') {
            if (!item.isPaused()) {
              const progress = (item.getReceivedBytes() / item.getTotalBytes()) * 100;
              win.webContents.send('download-progress', { toolId, progress, savePath });
            }
          }
        });
        
        item.once('done', async (event: any, state: string) => {
          if (state === 'completed') {
            logger.info(`Download successfully to ${savePath}`);
            if (toolId === 'node' && savePath.endsWith('.zip')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const { exec } = require('child_process');
                const nodeDir = path.join(getBaseDir(), 'bin', 'node');
                const extractTemp = path.join(nodeDir, 'temp_extract');
                if (!fs.existsSync(nodeDir)) fs.mkdirSync(nodeDir, { recursive: true });
                if (fs.existsSync(extractTemp)) fs.rmSync(extractTemp, { recursive: true, force: true });
                fs.mkdirSync(extractTemp, { recursive: true });
                
                await new Promise((res, rej) => {
                  exec(`powershell -Command "Expand-Archive -Path '${savePath}' -DestinationPath '${extractTemp}' -Force"`, (err: any) => {
                    if (err) rej(err); else res(true);
                  });
                });
                
                const entries = fs.readdirSync(extractTemp);
                const nodeFolder = entries.find((e: string) => e.startsWith('node-') && fs.statSync(path.join(extractTemp, e)).isDirectory());
                if (nodeFolder) {
                  const versionMatch = nodeFolder.match(/node-v([\d\.]+)/);
                  const version = versionMatch ? versionMatch[1] : 'latest';
                  const targetDir = path.join(nodeDir, version);
                  
                  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
                  fs.renameSync(path.join(extractTemp, nodeFolder), targetDir);
                  
                  fs.rmSync(extractTemp, { recursive: true, force: true });
                  fs.unlinkSync(savePath);
                  
                  if (!store.get('nodeVersion')) {
                    store.set('nodeVersion', version);
                  }
                  
                  resolve({ success: true, savePath: targetDir });
                } else {
                  resolve({ success: false, error: 'Invalid zip structure' });
                }
              } catch (e: any) {
                logger.error('Failed to extract node: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if (toolId === 'composer' && savePath.endsWith('.phar')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const composerDir = path.join(getBaseDir(), 'bin', 'composer');
                if (!fs.existsSync(composerDir)) fs.mkdirSync(composerDir, { recursive: true });
                
                const targetPhar = path.join(composerDir, 'composer.phar');
                fs.copyFileSync(savePath, targetPhar);
                fs.unlinkSync(savePath);
                
                // Create a composer.bat wrapper
                const batPath = path.join(composerDir, 'composer.bat');
                fs.writeFileSync(batPath, '@php "%~dp0composer.phar" %*\n');
                
                resolve({ success: true, savePath: composerDir });
              } catch (e: any) {
                logger.error('Failed to install composer: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if (toolId === 'wp-cli' && savePath.endsWith('.phar')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const wpCliDir = path.join(getBaseDir(), 'bin', 'wp-cli');
                if (!fs.existsSync(wpCliDir)) fs.mkdirSync(wpCliDir, { recursive: true });
                
                const targetPhar = path.join(wpCliDir, 'wp-cli.phar');
                fs.copyFileSync(savePath, targetPhar);
                fs.unlinkSync(savePath);
                
                // Create a wp.bat wrapper
                const batPath = path.join(wpCliDir, 'wp.bat');
                fs.writeFileSync(batPath, '@php "%~dp0wp-cli.phar" %*\n');
                
                resolve({ success: true, savePath: wpCliDir });
              } catch (e: any) {
                logger.error('Failed to install wp-cli: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if (toolId === 'cloudflared' && savePath.endsWith('.exe')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const cloudflaredDir = path.join(getBaseDir(), 'bin', 'cloudflared');
                if (!fs.existsSync(cloudflaredDir)) fs.mkdirSync(cloudflaredDir, { recursive: true });
                
                const targetExe = path.join(cloudflaredDir, 'cloudflared.exe');
                fs.copyFileSync(savePath, targetExe);
                fs.unlinkSync(savePath);
                
                resolve({ success: true, savePath: cloudflaredDir });
              } catch (e: any) {
                logger.error('Failed to install cloudflared: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if ((toolId === 'git' || toolId === 'git-bash') && savePath.endsWith('.7z.exe')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const { exec } = require('child_process');
                const gitDir = path.join(getBaseDir(), 'bin', 'git');
                if (!fs.existsSync(gitDir)) fs.mkdirSync(gitDir, { recursive: true });
                
                await new Promise((res, rej) => {
                  // Run self-extracting archive silently to target dir
                  exec(`"${savePath}" -y -o"${gitDir}"`, (err: any) => {
                    if (err) rej(err); else res(true);
                  });
                });
                
                fs.unlinkSync(savePath); // Clean up the installer
                
                resolve({ success: true, savePath: gitDir });
              } catch (e: any) {
                logger.error('Failed to extract git: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if (toolId === 'vcredist') {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const { exec } = require('child_process');
                await new Promise((res, rej) => {
                  exec(`"${savePath}" /install /quiet /norestart`, (err: any) => {
                    if (err) rej(err); else res(true);
                  });
                });
                fs.unlinkSync(savePath); // Clean up
                resolve({ success: true, savePath: 'Instalasi selesai' });
              } catch (e: any) {
                logger.error('Failed to install vcredist: ' + e.message);
                resolve({ success: false, error: e.message });
              }
            } else if (savePath.endsWith('.zip')) {
              try {
                win.webContents.send('download-progress', { toolId, progress: 100, status: 'Menginstal...' });
                const { exec } = require('child_process');
                const toolBaseDir = path.join(getBaseDir(), 'bin', toolId);
                const extractTemp = path.join(toolBaseDir, 'temp_extract');
                if (!fs.existsSync(toolBaseDir)) fs.mkdirSync(toolBaseDir, { recursive: true });
                if (fs.existsSync(extractTemp)) fs.rmSync(extractTemp, { recursive: true, force: true });
                fs.mkdirSync(extractTemp, { recursive: true });
                
                await new Promise((res, rej) => {
                  exec(`powershell -Command "Expand-Archive -Path '${savePath}' -DestinationPath '${extractTemp}' -Force"`, (err: any) => {
                    if (err) rej(err); else res(true);
                  });
                });
                
                // Determine folder structure
                const entries = fs.readdirSync(extractTemp);
                let sourceDir = extractTemp;
                let targetFolderName = path.basename(savePath, '.zip'); // default fallback (e.g., php-8.2.10)
                
                // If it only contains a single directory, use that directory
                if (entries.length === 1 && fs.statSync(path.join(extractTemp, entries[0])).isDirectory()) {
                  sourceDir = path.join(extractTemp, entries[0]);
                  targetFolderName = entries[0];
                }
                
                const targetDir = path.join(toolBaseDir, targetFolderName);
                if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
                
                fs.renameSync(sourceDir, targetDir);
                
                if (fs.existsSync(extractTemp)) fs.rmSync(extractTemp, { recursive: true, force: true });
                fs.unlinkSync(savePath);
                
                // Save active version to store
                store.set(`${toolId}Version`, targetFolderName);
                
                // Post-extract hooks
                if (toolId === 'python') {
                  try {
                    // Python embeddable zip has a ._pth file that needs "import site" uncommented so pip can work
                    const pthFiles = fs.readdirSync(targetDir).filter((f: string) => f.endsWith('._pth'));
                    if (pthFiles.length > 0) {
                      const pthPath = path.join(targetDir, pthFiles[0]);
                      let content = fs.readFileSync(pthPath, 'utf8');
                      content = content.replace(/#import site/gi, 'import site');
                      fs.writeFileSync(pthPath, content);
                    }
                    
                    // Download and run get-pip.py
                    const getPipScript = path.join(targetDir, 'get-pip.py');
                    await new Promise((res) => {
                      exec(`powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '${getPipScript}'"`, (err: any) => {
                        if (err) res(false);
                        else {
                          exec(`"${path.join(targetDir, 'python.exe')}" "${getPipScript}"`, { cwd: targetDir }, (err2: any) => {
                            res(true);
                          });
                        }
                      });
                    });
                  } catch (e) {
                    logger.error('Failed to configure python pip: ' + e);
                  }
                }

                
                resolve({ success: true, savePath: targetDir });
              } catch (e: any) {
                logger.error(`Failed to extract ${toolId}: ` + e.message);
                resolve({ success: false, error: e.message });
              }
            } else {
              resolve({ success: true, savePath });
            }
          } else {
            logger.error(`Download failed: ${state}`);
            resolve({ success: false, error: state });
          }
        });
      };
      
      session.on('will-download', listener);
      win.webContents.downloadURL(url);
    });
    toolsManager.clearCache();
    return result;
  })

  ipcMain.handle('get-about-info', () => {
    return {
      appName: 'Sabila',
      version: '1.0.0',
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
      os: `${process.platform} ${process.arch}`,
      permissions: [
        'File System Access – Membaca/menulis konfigurasi server lokal',
        'Network Access – Menjalankan layanan web server lokal',
        'Shell Access – Menjalankan proses Nginx, Apache, PHP, MySQL',
        'System Monitor – Memantau penggunaan CPU, RAM, dan Disk',
        'Clipboard – Menyalin log dan konfigurasi',
      ],
      description: 'SABILA (Sistem Asisten Backend dan Infrastruktur Lokal AI) adalah lingkungan pengembangan web lokal pintar yang dirancang untuk pemula. Dilengkapi dengan Asisten AI, Multi-Version Runtime, Secret Manager, Cron Job Runner, Mail Catcher, dan Auto-Rename Document Root. Dibangun dengan Electron, React, dan cinta ❤️',
      license: 'BSD 3-Clause License',
      github: 'https://github.com/sabila-hq/sabila'
    };
  })

  createWindow()

  // ============================================================
  // Task & Cron Job Runner
  // ============================================================
  ipcMain.handle('cron-get-tasks', () => {
    return cronManager.getTasks();
  });

  ipcMain.handle('cron-add-task', (_, task) => {
    return cronManager.addTask(task);
  });

  ipcMain.handle('cron-update-task', (_, id, updates) => {
    return cronManager.updateTask(id, updates);
  });

  ipcMain.handle('cron-delete-task', (_, id) => {
    return cronManager.deleteTask(id);
  });

  ipcMain.handle('cron-toggle-task', (_, id, active) => {
    return cronManager.toggleTask(id, active);
  });

  ipcMain.handle('cron-run-now', async (_, id) => {
    await cronManager.runTaskNow(id);
    return true;
  });

  // Start all crons on boot
  cronManager.init();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Cleanup before quitting
    mailCatcher.stop();
    logViewer.stopAll();
    tunnelManager.stopAll();
    app.quit()
  }
})
