import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './logger';
import { getBaseDir } from './env';
import { serviceManager } from './serviceManager';

export class DbMigrator extends EventEmitter {
  public discoverRescueSources(): { name: string, path: string, type: string }[] {
    const drives = ['C:', 'D:', 'E:'];
    const sources: { name: string, path: string, type: string }[] = [];
    
    for (const drive of drives) {
      try {
        const xamppPath = path.join(drive, '\\', 'xampp', 'mysql', 'data');
        if (fs.existsSync(xamppPath)) {
          sources.push({ name: `XAMPP (${drive})`, path: xamppPath, type: 'xampp' });
        }
        
        const laragonPath = path.join(drive, '\\', 'laragon', 'data', 'mysql');
        if (fs.existsSync(laragonPath)) {
          sources.push({ name: `Laragon (${drive})`, path: laragonPath, type: 'laragon' });
        }
      } catch (e) {
        // ignore access errors on drives
      }
    }
    return sources;
  }
  public async scanRescueDatabases(sourceDataDir: string): Promise<{ success: boolean; databases?: string[]; message?: string }> {
    try {
      if (!fs.existsSync(sourceDataDir)) {
        return { success: false, message: `Source directory ${sourceDataDir} does not exist.` };
      }
      
      const entries = fs.readdirSync(sourceDataDir, { withFileTypes: true });
      const systemDbs = ['mysql', 'performance_schema', 'information_schema', 'sys', 'phpmyadmin', 'test'];
      const databases = entries
        .filter(e => e.isDirectory() && !systemDbs.includes(e.name.toLowerCase()))
        .map(e => e.name);
        
      return { success: true, databases };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Rescues databases using logical dump (mysqldump).
   * This is the safest way to migrate across major versions (e.g., MariaDB to MySQL 8)
   * as it forces the target format to adapt to Sabila's database structure.
   */
  public async rescueViaLogicalDump(sourceDataDir: string, selectedDatabases: string[]): Promise<{ success: boolean; message: string; details?: string[] }> {
    try {
      const sourceMysqlDir = path.dirname(sourceDataDir);
      let sourceMysqld = path.join(sourceMysqlDir, 'bin', 'mysqld.exe');
      if (!fs.existsSync(sourceMysqld)) {
        let found = false;
        // Check Laragon pattern: C:\laragon\data\mysql -> C:\laragon\bin\mysql\*\bin\mysqld.exe
        const laragonMysqlRoot = path.join(sourceDataDir, '..', '..', 'bin', 'mysql');
        if (fs.existsSync(laragonMysqlRoot)) {
          const dirs = fs.readdirSync(laragonMysqlRoot, { withFileTypes: true });
          for (const d of dirs) {
            if (d.isDirectory()) {
               const p = path.join(laragonMysqlRoot, d.name, 'bin', 'mysqld.exe');
               if (fs.existsSync(p)) {
                 sourceMysqld = p;
                 found = true;
                 break;
               }
            }
          }
        }
        
        if (!found) {
          const upBin = path.join(sourceDataDir, '..', 'bin', 'mysqld.exe');
          if (fs.existsSync(upBin)) {
            sourceMysqld = upBin;
            found = true;
          }
        }
        
        if (!found) {
          return { success: false, message: `Gagal menemukan mysqld.exe di XAMPP/Laragon Anda. Metode migrasi (Logical Dump) memerlukan executable lama agar bisa mengkonversi data ke MySQL 8.` };
        }
      }

      const sabilaMysqlExe = serviceManager.getExecutablePath('mysql');
      if (!sabilaMysqlExe) {
        return { success: false, message: 'MySQL Sabila belum terinstal.' };
      }
      const sabilaMysqldump = path.join(path.dirname(sabilaMysqlExe), 'mysqldump.exe');
      const sabilaMysqlClient = path.join(path.dirname(sabilaMysqlExe), 'mysql.exe');

      // Ensure Sabila MySQL is running to receive the import
      const sabilaMysqlStatus = serviceManager.getAllStatuses()['mysql'];
      if (sabilaMysqlStatus.status !== 'running') {
        await serviceManager.startService('mysql');
        await new Promise(res => setTimeout(res, 3000));
      }
      // Re-fetch port just in case it was started
      const activeSabilaStatus = serviceManager.getAllStatuses()['mysql'];
      const sabilaPort = activeSabilaStatus.port || 3306;

      const rescuePort = await serviceManager.findAvailablePort(3310);
      const details: string[] = [];
      details.push(`Memulai engine database lama pada port isolasi (${rescuePort})...`);

      const sourceProcess = spawn(sourceMysqld, [
        `--datadir=${sourceDataDir}`,
        `--port=${rescuePort}`,
        '--skip-grant-tables',
        '--console'
      ]);

      let isReady = false;
      let didError = false;
      let startupLogs = '';
      
      sourceProcess.stderr.on('data', (data) => {
        const str = data.toString();
        startupLogs += str;
        const log = str.toLowerCase();
        if (log.includes('ready for connections') || log.includes('socket')) {
          isReady = true;
        }
        if (log.includes('aborting')) {
          didError = true;
        }
      });
      sourceProcess.stdout.on('data', (data) => {
        const str = data.toString();
        startupLogs += str;
        const log = str.toLowerCase();
        if (log.includes('ready for connections') || log.includes('socket')) {
          isReady = true;
        }
      });

      let waitTime = 0;
      while (!isReady && !didError && waitTime < 15000) {
        await new Promise(res => setTimeout(res, 500));
        waitTime += 500;
      }

      if (didError || !isReady) {
        sourceProcess.kill();
        logger.warn('Failed to start old mysqld for logical dump. Logs: ' + startupLogs);
        return { success: false, message: `Gagal menyalakan MySQL lama Anda dalam mode terisolasi.\n\nLogs dari MySQL lama:\n${startupLogs.slice(-500)}` };
      }

      details.push('Engine lama berjalan. Mengkonversi format & menyinkronkan data...');

      for (const dbName of selectedDatabases) {
        details.push(`Mengekstrak dan menyesuaikan format: ${dbName}...`);
        
        // Dump via Stream (No temporary file, huge performance boost)
        await new Promise<void>((resolve, reject) => {
          const dumpProcess = spawn(sabilaMysqldump, [
            '--host=127.0.0.1',
            `--port=${rescuePort}`,
            '--user=root',
            '--force',
            '--opt',
            '--verbose',
            '--databases',
            dbName
          ]);

          const importProcess = spawn(sabilaMysqlClient, [
            '--host=127.0.0.1',
            `--port=${sabilaPort}`,
            '--user=root'
          ]);

          let hasError = false;

          // Pipe directly!
          dumpProcess.stdout.pipe(importProcess.stdin);

          // Track progress from stderr of mysqldump
          dumpProcess.stderr.on('data', (data) => {
            const logStr = data.toString().trim();
            if (logStr) {
              this.emit('progress', { dbName, log: logStr });
            }
          });

          dumpProcess.on('error', (err) => {
            hasError = true;
            reject(new Error(`Gagal dump ${dbName}: ${err.message}`));
          });

          importProcess.on('error', (err) => {
            hasError = true;
            reject(new Error(`Gagal import ${dbName}: ${err.message}`));
          });

          importProcess.on('close', (code) => {
            if (!hasError) {
              if (code === 0) resolve();
              else reject(new Error(`Gagal mengimpor ${dbName} (exit code ${code})`));
            }
          });
        });

        details.push(`✓ Database ${dbName} berhasil dikonversi dan disimpan.`);
      }

      sourceProcess.kill();
      details.push('Tugas selesai dengan aman. Database Anda sekarang menggunakan format Sabila (MySQL 8).');
      
      return { success: true, message: 'Berhasil', details };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Rescues a broken XAMPP MySQL by copying backup files to the data directory.
   */
  public async fixXamppMysql(sourceDataDir: string): Promise<{ success: boolean; message: string; details?: string[] }> {
    try {
      if (!fs.existsSync(sourceDataDir)) {
        return { success: false, message: `Source directory ${sourceDataDir} does not exist.` };
      }

      const backupDir = path.join(sourceDataDir, '..', 'backup');
      if (!fs.existsSync(backupDir)) {
        return { success: false, message: `Folder backup XAMPP tidak ditemukan di ${backupDir}. XAMPP Anda mungkin tidak memiliki fitur backup bawaan.` };
      }

      const details: string[] = [];

      // Required targets as specified by the user
      const targets = [
        { name: 'mysql', type: 'dir' },
        { name: 'performance_schema', type: 'dir' },
        { name: 'phpmyadmin', type: 'dir' },
        { name: 'test', type: 'dir' },
        { name: 'ibdata1', type: 'file' }
      ];

      for (const target of targets) {
        const srcPath = path.join(backupDir, target.name);
        const destPath = path.join(sourceDataDir, target.name);

        if (!fs.existsSync(srcPath)) {
          details.push(`⚠️ Lewati: ${target.name} (tidak ada di folder backup)`);
          continue;
        }

        if (target.type === 'dir') {
          // Empty the destination directory first if it exists to ensure a clean overwrite
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true });
          }
          this.copyDirectoryRecursiveSync(srcPath, destPath);
          details.push(`✓ Menyalin folder: ${target.name}`);
        } else {
          fs.copyFileSync(srcPath, destPath);
          details.push(`✓ Menyalin file: ${target.name}`);
        }
      }

      logger.info('XAMPP MySQL rescue completed successfully.');
      return { 
        success: true, 
        message: 'Perbaikan XAMPP MySQL berhasil dilakukan.',
        details 
      };
    } catch (e: any) {
      logger.error(`Failed to fix XAMPP MySQL data: ${e.message}`);
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  private copyDirectoryRecursiveSync(source: string, target: string) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target);
    }
    const files = fs.readdirSync(source);
    files.forEach(file => {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        this.copyDirectoryRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

export const dbMigrator = new DbMigrator();
