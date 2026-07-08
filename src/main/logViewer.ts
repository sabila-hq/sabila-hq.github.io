import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { BrowserWindow } from 'electron';
import { getBaseDir } from './env';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  line: number;
}

export interface LogFileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  exists: boolean;
}

export class LogViewer {
  private baseDir: string;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private lastPositions: Map<string, number> = new Map();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Get list of available log files
   */
  public getLogFiles(): LogFileInfo[] {
    const logPaths = [
      { id: 'nginx-error', name: 'Nginx Error Log', path: this.findLogFile('nginx', 'error.log') },
      { id: 'nginx-access', name: 'Nginx Access Log', path: this.findLogFile('nginx', 'access.log') },
      { id: 'php-error', name: 'PHP Error Log', path: this.findLogFile('php', 'php_errors.log') },
      { id: 'mysql-error', name: 'MySQL Error Log', path: this.findLogFile('mysql', 'mysql_error.log') },
      { id: 'apache-error', name: 'Apache Error Log', path: this.findLogFile('apache', 'error.log') },
      { id: 'apache-access', name: 'Apache Access Log', path: this.findLogFile('apache', 'access.log') },
      { id: 'sabila', name: 'Sabila App Log', path: this.getAppLogPath() },
    ];

    return logPaths.map(lp => {
      const exists = lp.path !== null && fs.existsSync(lp.path!);
      let size = 0;
      if (exists && lp.path) {
        try { size = fs.statSync(lp.path).size; } catch (e) { /* ignore */ }
      }
      return {
        id: lp.id,
        name: lp.name,
        path: lp.path || '',
        size,
        exists
      };
    });
  }

  private getAppLogPath(): string {
    // The app log path is managed by logger module
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'sabila.log');
  }

  private findLogFile(service: string, logFileName: string): string | null {
    const possiblePaths = [
      path.join(this.baseDir, 'logs', `${service}_${logFileName}`),
      path.join(this.baseDir, 'logs', logFileName),
      path.join(this.baseDir, 'bin', service, 'logs', logFileName),
      path.join(this.baseDir, 'bin', service, logFileName),
    ];

    // Search recursively in bin/service for log files
    const binServiceDir = path.join(this.baseDir, 'bin', service);
    if (fs.existsSync(binServiceDir)) {
      const found = this.searchForFile(binServiceDir, logFileName, 4);
      if (found) possiblePaths.unshift(found);
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p;
    }

    // Also check the logs folder in base
    const logsDir = path.join(this.baseDir, 'logs');
    if (fs.existsSync(logsDir)) {
      const found = this.searchForFile(logsDir, logFileName, 2);
      if (found) return found;
    }

    return null;
  }

  private searchForFile(dir: string, fileName: string, maxDepth: number, depth = 0): string | null {
    if (depth > maxDepth) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
          return fullPath;
        }
        if (entry.isDirectory()) {
          const found = this.searchForFile(fullPath, fileName, maxDepth, depth + 1);
          if (found) return found;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Read the last N lines of a log file
   */
  public readLogTail(logId: string, lines: number = 100): LogEntry[] {
    const logFiles = this.getLogFiles();
    const logFile = logFiles.find(l => l.id === logId);
    if (!logFile || !logFile.exists) return [];

    try {
      const content = fs.readFileSync(logFile.path, 'utf8');
      const allLines = content.split(/\r?\n/).filter(l => l.trim());
      const lastLines = allLines.slice(-lines);

      return lastLines.map((line, idx) => this.parseLine(line, logFile.id, allLines.length - lines + idx));
    } catch (e) {
      logger.error(`Failed to read log file ${logFile.path}: ${e}`);
      return [];
    }
  }

  /**
   * Start watching a log file for changes and stream new lines to renderer
   */
  public startWatching(logId: string): boolean {
    const logFiles = this.getLogFiles();
    const logFile = logFiles.find(l => l.id === logId);
    if (!logFile || !logFile.exists) return false;

    // Stop any existing watcher for this log
    this.stopWatching(logId);

    try {
      // Get current file size as starting position
      const stats = fs.statSync(logFile.path);
      this.lastPositions.set(logId, stats.size);

      const watcher = fs.watch(logFile.path, (eventType) => {
        if (eventType === 'change') {
          this.readNewLines(logId, logFile.path);
        }
      });

      this.watchers.set(logId, watcher);
      logger.info(`Started watching log: ${logFile.name}`);
      return true;
    } catch (e) {
      logger.error(`Failed to watch log ${logFile.path}: ${e}`);
      return false;
    }
  }

  private readNewLines(logId: string, filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      const lastPos = this.lastPositions.get(logId) || 0;

      if (stats.size <= lastPos) {
        // File was truncated, reset position
        this.lastPositions.set(logId, 0);
        return;
      }

      const fd = fs.openSync(filePath, 'r');
      const bufferSize = stats.size - lastPos;
      const buffer = Buffer.alloc(bufferSize);
      fs.readSync(fd, buffer, 0, bufferSize, lastPos);
      fs.closeSync(fd);

      this.lastPositions.set(logId, stats.size);

      const newContent = buffer.toString('utf8');
      const newLines = newContent.split(/\r?\n/).filter(l => l.trim());

      if (newLines.length > 0) {
        const entries = newLines.map((line, idx) => this.parseLine(line, logId, idx));
        
        // Send to all renderer windows
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('log-viewer-update', { logId, entries });
          }
        });
      }
    } catch (e) {
      // Ignore read errors during active file writes
    }
  }

  public stopWatching(logId: string): void {
    const watcher = this.watchers.get(logId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(logId);
      this.lastPositions.delete(logId);
      logger.info(`Stopped watching log: ${logId}`);
    }
  }

  public stopAll(): void {
    for (const [logId] of this.watchers) {
      this.stopWatching(logId);
    }
  }

  /**
   * Clear a log file
   */
  public clearLog(logId: string): boolean {
    const logFiles = this.getLogFiles();
    const logFile = logFiles.find(l => l.id === logId);
    if (!logFile || !logFile.exists) return false;

    try {
      fs.writeFileSync(logFile.path, '');
      this.lastPositions.set(logId, 0);
      logger.info(`Cleared log file: ${logFile.name}`);
      return true;
    } catch (e) {
      logger.error(`Failed to clear log: ${e}`);
      return false;
    }
  }

  private parseLine(line: string, source: string, lineNumber: number): LogEntry {
    let level: LogEntry['level'] = 'info';

    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('[error]') || lowerLine.includes('error') || lowerLine.includes('fatal')) {
      level = 'error';
    } else if (lowerLine.includes('[warn]') || lowerLine.includes('warning')) {
      level = 'warn';
    } else if (lowerLine.includes('[debug]') || lowerLine.includes('debug')) {
      level = 'debug';
    }

    // Try to extract timestamp
    let timestamp = new Date().toISOString();
    const tsMatch = line.match(/\[(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}[^\]]*)\]/);
    if (tsMatch) {
      try {
        timestamp = new Date(tsMatch[1]).toISOString();
      } catch (e) { /* use default */ }
    }

    return {
      timestamp,
      level,
      source,
      message: line,
      line: lineNumber
    };
  }
}

export const logViewer = new LogViewer(getBaseDir());
