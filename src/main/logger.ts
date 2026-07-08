import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export class Logger {
  private logPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logPath = path.join(userDataPath, 'sabila.log');
  }

  private write(level: string, message: string) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(formattedMessage.trim());

    try {
      fs.appendFileSync(this.logPath, formattedMessage);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }

    // Stream logs to the frontend
    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('log-message', formattedMessage.trim());
        }
      });
    } catch (e) {
      // Ignore if BrowserWindow is not ready
    }
  }

  info(message: string) {
    this.write('INFO', message);
  }

  warn(message: string) {
    this.write('WARN', message);
  }

  error(message: string) {
    this.write('ERROR', message);
  }

  getLogPath(): string {
    return this.logPath;
  }
}

export const logger = new Logger();
