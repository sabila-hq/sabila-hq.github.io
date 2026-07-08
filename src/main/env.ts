import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export function getBaseDir(): string {
  let base: string;
  
  if (app && app.isPackaged) {
    const exeDir = path.dirname(process.execPath);
    // Auto-detect portable mode: if 'bin' or 'data' folder exists next to the exe, or '.portable' file exists
    if (fs.existsSync(path.join(exeDir, 'bin')) || fs.existsSync(path.join(exeDir, 'data')) || fs.existsSync(path.join(exeDir, '.portable'))) {
      base = exeDir;
    } else {
      base = 'C:\\sabila';
    }
  } else {
    // In development mode, use C:\sabila to sync with existing services and databases
    base = 'C:\\sabila';
  }
  
  // Ensure the directory exists
  if (!fs.existsSync(base)) {
    try {
      fs.mkdirSync(base, { recursive: true });
    } catch (e) {}
  }
  
  return base;
}

export function getDataDir(): string {
  const dataDir = path.join(getBaseDir(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {}
  }
  return dataDir;
}
