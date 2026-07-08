import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getServices: () => ipcRenderer.invoke('get-services'),
  startService: (id: string) => ipcRenderer.invoke('start-service', id),
  stopService: (id: string) => ipcRenderer.invoke('stop-service', id),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  syncProjects: (projects: any[]) => ipcRenderer.invoke('sync-projects', projects),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data: any) => ipcRenderer.invoke('save-settings', data),
  renameDocRoot: (newName: string) => ipcRenderer.invoke('rename-doc-root', newName),
  sendAiMessage: (conversationId: number, content: string) => ipcRenderer.invoke('ai-chat-send', conversationId, content),
  chatCreateConversation: (title?: string) => ipcRenderer.invoke('chat-create-conversation', title),
  chatListConversations: () => ipcRenderer.invoke('chat-list-conversations'),
  chatGetMessages: (conversationId: number) => ipcRenderer.invoke('chat-get-messages', conversationId),
  chatDeleteConversation: (conversationId: number) => ipcRenderer.invoke('chat-delete-conversation', conversationId),
  chatUpdateTitle: (conversationId: number, title: string) => ipcRenderer.invoke('chat-update-title', conversationId, title),
  testAiConnection: (baseUrl: string, apiKey: string) => ipcRenderer.invoke('test-ai-connection', baseUrl, apiKey),
  showAlert: (message: string, buttons?: string[]) => ipcRenderer.invoke('show-alert', message, buttons),
  getDirTree: (targetPath: string) => ipcRenderer.invoke('get-dir-tree', targetPath),
  getServiceVersions: (serviceId: string) => ipcRenderer.invoke('get-service-versions', serviceId),
  setServiceVersion: (serviceId: string, version: string) => ipcRenderer.invoke('set-service-version', serviceId, version),
  setServicePort: (serviceId: string, port: number) => ipcRenderer.invoke('set-service-port', serviceId, port),
  setServiceSsl: (serviceId: string, enabled: boolean, port: number) => ipcRenderer.invoke('set-service-ssl', serviceId, enabled, port),
  findAvailablePort: (startPort: number) => ipcRenderer.invoke('find-available-port', startPort),
  killProcessOnPort: (port: number) => ipcRenderer.invoke('kill-process-on-port', port),
  getPhpExtensions: () => ipcRenderer.invoke('get-php-extensions'),
  togglePhpExtension: (extName: string, enable: boolean) => ipcRenderer.invoke('toggle-php-extension', extName, enable),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  openInIDE: (dirPath: string, ideId?: string) => ipcRenderer.invoke('open-in-ide', dirPath, ideId),
  openProjectTerminal: (dirPath: string) => ipcRenderer.invoke('open-project-terminal', dirPath),
  projectEnvGet: (projectPath: string) => ipcRenderer.invoke('project-env-get', projectPath),
  projectEnvSet: (projectPath: string, type: 'env' | 'htaccess', content: string) => ipcRenderer.invoke('project-env-set', projectPath, type, content),
  getProjectUrls: (projectName: string) => ipcRenderer.invoke('get-project-urls', projectName),
  projectEnableSsl: (projectName: string) => ipcRenderer.invoke('project-enable-ssl', projectName),
  detectIDEs: () => ipcRenderer.invoke('detect-ides'),
  getProjectInfo: (dirPath: string) => ipcRenderer.invoke('get-project-info', dirPath),
  getPhpVersions: () => ipcRenderer.invoke('get-php-versions'),
  getProjectPhpVersion: (projName: string) => ipcRenderer.invoke('get-project-php-version', projName),
  setProjectPhpVersion: (projName: string, version: string) => ipcRenderer.invoke('set-project-php-version', projName, version),
  getNodeVersions: () => ipcRenderer.invoke('get-node-versions'),
  getProjectNodeVersion: (projName: string) => ipcRenderer.invoke('get-project-node-version', projName),
  setProjectNodeVersion: (projName: string, version: string) => ipcRenderer.invoke('set-project-node-version', projName, version),
  getProjectSecrets: (projName: string) => ipcRenderer.invoke('get-project-secrets', projName),
  setProjectSecrets: (projName: string, secrets: any) => ipcRenderer.invoke('set-project-secrets', projName, secrets),
  getTools: () => ipcRenderer.invoke('get-tools'),
  openTerminal: (toolId: string) => ipcRenderer.invoke('open-terminal', toolId),
  getToolVersions: (toolId: string) => ipcRenderer.invoke('get-tool-versions', toolId),
  setToolVersion: (toolId: string, version: string) => ipcRenderer.invoke('set-tool-version', toolId, version),
  getDashboardItems: () => ipcRenderer.invoke('get-dashboard-items'),
  toggleDashboardItem: (toolId: string) => ipcRenderer.invoke('toggle-dashboard-item', toolId),
  startAllServices: () => ipcRenderer.invoke('start-all-services'),
  stopAllServices: () => ipcRenderer.invoke('stop-all-services'),
  ensureProjectServices: (projectName: string) => ipcRenderer.invoke('ensure-project-services', projectName),
  deleteProject: (projectName: string, projectPath: string) => ipcRenderer.invoke('delete-project', projectName, projectPath),
  prepareProjectDeps: (projectPath: string) => ipcRenderer.invoke('prepare-project-deps', projectPath),
  onPrepProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('prep-progress', listener);
    return () => ipcRenderer.removeListener('prep-progress', listener);
  },
  getSystemSpecs: () => ipcRenderer.invoke('get-system-specs'),
  downloadService: (serviceId: string) => ipcRenderer.invoke('download-service', serviceId),
  discoverRescueSources: () => ipcRenderer.invoke('discover-rescue-sources'),
  fixXamppMysql: (sourcePath: string) => ipcRenderer.invoke('fix-xampp-mysql', sourcePath),
  openXamppControl: (sourcePath: string) => ipcRenderer.invoke('open-xampp-control', sourcePath),
  onRescueProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('rescue-progress', listener);
    return () => ipcRenderer.removeListener('rescue-progress', listener);
  },
  openConfigFile: (serviceId: string) => ipcRenderer.invoke('open-config-file', serviceId),
  scanProjectSecurity: (projectPath: string) => ipcRenderer.invoke('scan-project-security', projectPath),
  exportRecipe: () => ipcRenderer.invoke('export-recipe'),
  importRecipe: () => ipcRenderer.invoke('import-recipe'),
  cronGetTasks: () => ipcRenderer.invoke('cron-get-tasks'),
  cronAddTask: (task: any) => ipcRenderer.invoke('cron-add-task', task),
  cronUpdateTask: (id: string, updates: any) => ipcRenderer.invoke('cron-update-task', id, updates),
  cronDeleteTask: (id: string) => ipcRenderer.invoke('cron-delete-task', id),
  cronToggleTask: (id: string, active: boolean) => ipcRenderer.invoke('cron-toggle-task', id, active),
  cronRunNow: (id: string) => ipcRenderer.invoke('cron-run-now', id),
  onLogMessage: (callback: (msg: string) => void) => {
    const listener = (_: any, msg: string) => callback(msg);
    ipcRenderer.on('log-message', listener);
    return () => ipcRenderer.removeListener('log-message', listener);
  },

  // ============================================================
  // Share Local to Public (Tunnel)
  // ============================================================
  tunnelStart: (projectName: string, localPort: number, subdomain?: string) =>
    ipcRenderer.invoke('tunnel-start', projectName, localPort, subdomain),
  tunnelStop: (projectName: string) =>
    ipcRenderer.invoke('tunnel-stop', projectName),
  tunnelList: () => ipcRenderer.invoke('tunnel-list'),

  // ============================================================
  // Quick App Generator
  // ============================================================
  generateApp: (template: string, projectName: string) =>
    ipcRenderer.invoke('generate-app', template, projectName),
  onAppGeneratorProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('app-generator-progress', listener);
    return () => ipcRenderer.removeListener('app-generator-progress', listener);
  },

  // ============================================================
  // Real-Time Log Viewer
  // ============================================================
  logGetFiles: () => ipcRenderer.invoke('log-get-files'),
  logReadTail: (logId: string, lines?: number) =>
    ipcRenderer.invoke('log-read-tail', logId, lines),
  logStartWatching: (logId: string) =>
    ipcRenderer.invoke('log-start-watching', logId),
  logStopWatching: (logId: string) =>
    ipcRenderer.invoke('log-stop-watching', logId),
  logClear: (logId: string) => ipcRenderer.invoke('log-clear', logId),
  onLogViewerUpdate: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('log-viewer-update', listener);
    return () => ipcRenderer.removeListener('log-viewer-update', listener);
  },

  // ============================================================
  // Local Mail Catcher
  // ============================================================
  mailStart: () => ipcRenderer.invoke('mail-start'),
  mailStop: () => ipcRenderer.invoke('mail-stop'),
  mailStatus: () => ipcRenderer.invoke('mail-status'),
  mailList: () => ipcRenderer.invoke('mail-list'),
  mailGet: (id: string) => ipcRenderer.invoke('mail-get', id),
  mailDelete: (id: string) => ipcRenderer.invoke('mail-delete', id),
  mailClear: () => ipcRenderer.invoke('mail-clear'),
  onMailReceived: (callback: (mail: any) => void) => {
    const listener = (_: any, mail: any) => callback(mail);
    ipcRenderer.on('mail-received', listener);
    return () => ipcRenderer.removeListener('mail-received', listener);
  },

  // ============================================================
  // System Resource Monitor
  // ============================================================
  monitorStart: () => ipcRenderer.invoke('monitor-start'),
  monitorStop: () => ipcRenderer.invoke('monitor-stop'),
  monitorStatus: () => ipcRenderer.invoke('monitor-status'),
  monitorSnapshot: () => ipcRenderer.invoke('monitor-snapshot'),
  monitorHistory: () => ipcRenderer.invoke('monitor-history'),
  onSystemMetrics: (callback: (metrics: any) => void) => {
    const listener = (_: any, metrics: any) => callback(metrics);
    ipcRenderer.on('system-metrics', listener);
    return () => ipcRenderer.removeListener('system-metrics', listener);
  },
  windowControl: (action: string) => ipcRenderer.send(action),

  // ============================================================
  // Database Explorer
  // ============================================================
  dbConnect: (config: any) => ipcRenderer.invoke('db-connect', config),
  dbDisconnect: () => ipcRenderer.invoke('db-disconnect'),
  dbGetDatabases: () => ipcRenderer.invoke('db-get-databases'),
  dbGetTables: (database: string) => ipcRenderer.invoke('db-get-tables', database),
  dbQuery: (sql: string) => ipcRenderer.invoke('db-query', sql),
  dbCreateSnapshot: (database: string, port: number) => ipcRenderer.invoke('db-create-snapshot', database, port),
  dbListSnapshots: (database?: string) => ipcRenderer.invoke('db-list-snapshots', database),
  dbRestoreSnapshot: (filename: string, port: number) => ipcRenderer.invoke('db-restore-snapshot', filename, port),
  dbDeleteSnapshot: (filename: string) => ipcRenderer.invoke('db-delete-snapshot', filename),
  dbCopySnapshot: (filename: string, targetDatabase: string, port: number) => ipcRenderer.invoke('db-copy-snapshot', filename, targetDatabase, port),
  dbExportSnapshot: (filename: string) => ipcRenderer.invoke('db-export-snapshot', filename),
  dbGetSchema: (config: any, database: string) => ipcRenderer.invoke('db-get-schema', config, database),
  dbGetDetailedSchema: (config: any, database: string) => ipcRenderer.invoke('db-get-detailed-schema', config, database),
  dbExportSql: (database: string, port: number) => ipcRenderer.invoke('db-export-sql', database, port),
  dbImportSql: (database: string, port: number) => ipcRenderer.invoke('db-import-sql', database, port),

  // Setup Wizard & About
  checkNodeInstalled: () => ipcRenderer.invoke('check-node-installed'),
  getSetupComplete: () => ipcRenderer.invoke('get-setup-complete'),
  setSetupComplete: () => ipcRenderer.invoke('set-setup-complete'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  getAboutInfo: () => ipcRenderer.invoke('get-about-info'),
  downloadTool: (toolId: string, url: string) => ipcRenderer.invoke('download-tool', toolId, url),
  browseFolder: () => ipcRenderer.invoke('browse-folder'),
  installNodeAuto: () => ipcRenderer.invoke('install-node-auto'),
  onDownloadProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
