import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logger } from './logger';

export class CliManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  public async setupCli(): Promise<void> {
    const binDir = path.join(this.baseDir, 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const cmdPath = path.join(binDir, 'sabila.cmd');
    const cmdContent = `@echo off
curl -s "http://127.0.0.1:31337/api/cli?cmd=%1&arg=%2"
`;

    fs.writeFileSync(cmdPath, cmdContent, 'utf8');

    // Add to User PATH if not exists
    this.addToPath(binDir);
  }

  private addToPath(dirToAdd: string) {
    exec('powershell -Command "[Environment]::GetEnvironmentVariable(\'PATH\', \'User\')"', (error, stdout) => {
      if (!error && stdout) {
        const currentPath = stdout.trim();
        if (!currentPath.includes(dirToAdd)) {
          const newPath = `${currentPath};${dirToAdd}`;
          exec(`powershell -Command "[Environment]::SetEnvironmentVariable(\'PATH\', '${newPath}', \'User\')"`, (err) => {
            if (err) {
              logger.error(`Failed to add Sabila to PATH: ${err.message}`);
            } else {
              logger.info(`Successfully added ${dirToAdd} to User PATH.`);
            }
          });
        }
      }
    });
  }
}
