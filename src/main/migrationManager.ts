import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { store } from './store';
import { mysqlManager } from './mysqlManager';
import { exec } from 'child_process';
import { getBaseDir } from './env';

interface MigrationSource {
  name: string;
  detected: boolean;
  basePath: string;
  htdocsPath: string;
  mysqlDataPath: string;
  mysqlPort: number;
}

interface MigrationResult {
  success: boolean;
  filesCopied: number;
  databasesMigrated: string[];
  errors: string[];
}

export class MigrationManager {

  /**
   * Detect installed XAMPP/WAMP/Laragon on the system
   */
  public detectSources(): MigrationSource[] {
    const sources: MigrationSource[] = [];

    // XAMPP common paths
    const xamppPaths = ['C:\\xampp', 'D:\\xampp', 'C:\\Program Files\\XAMPP'];
    for (const basePath of xamppPaths) {
      if (fs.existsSync(basePath)) {
        sources.push({
          name: 'XAMPP',
          detected: true,
          basePath,
          htdocsPath: path.join(basePath, 'htdocs'),
          mysqlDataPath: path.join(basePath, 'mysql', 'data'),
          mysqlPort: 3306
        });
      }
    }

    // WAMP common paths
    const wampPaths = ['C:\\wamp', 'C:\\wamp64', 'D:\\wamp', 'D:\\wamp64'];
    for (const basePath of wampPaths) {
      if (fs.existsSync(basePath)) {
        sources.push({
          name: 'WAMP',
          detected: true,
          basePath,
          htdocsPath: path.join(basePath, 'www'),
          mysqlDataPath: path.join(basePath, 'bin', 'mysql'),
          mysqlPort: 3306
        });
      }
    }

    // Laragon common paths
    const laragonPaths = ['C:\\laragon', 'D:\\laragon'];
    for (const basePath of laragonPaths) {
      if (fs.existsSync(basePath)) {
        sources.push({
          name: 'Laragon',
          detected: true,
          basePath,
          htdocsPath: path.join(basePath, 'www'),
          mysqlDataPath: path.join(basePath, 'data', 'mysql'),
          mysqlPort: 3306
        });
      }
    }

    return sources;
  }

  /**
   * Copy all project files from source htdocs to Sabila document root
   */
  public async migrateFiles(sourcePath: string): Promise<{ filesCopied: number; errors: string[] }> {
    const docRootName = store.get('docRootName') || 'www';
    const destPath = path.join(getBaseDir(), docRootName);
    let filesCopied = 0;
    const errors: string[] = [];

    if (!fs.existsSync(sourcePath)) {
      return { filesCopied: 0, errors: [`Source path not found: ${sourcePath}`] };
    }

    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    try {
      const entries = fs.readdirSync(sourcePath, { withFileTypes: true });

      for (const entry of entries) {
        const srcFullPath = path.join(sourcePath, entry.name);
        const destFullPath = path.join(destPath, entry.name);

        // Skip system folders
        if (['dashboard', 'img', 'xampp', '.', '..'].includes(entry.name)) continue;

        if (entry.isDirectory()) {
          try {
            this.copyDirRecursive(srcFullPath, destFullPath);
            filesCopied++;
            logger.info(`Migrated project folder: ${entry.name}`);
          } catch (err: any) {
            errors.push(`Failed to copy ${entry.name}: ${err.message}`);
          }
        } else if (entry.isFile()) {
          try {
            fs.copyFileSync(srcFullPath, destFullPath);
            filesCopied++;
          } catch (err: any) {
            errors.push(`Failed to copy file ${entry.name}: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Failed to read source directory: ${err.message}`);
    }

    return { filesCopied, errors };
  }

  /**
   * Migrate databases from an external MySQL source.
   * This uses mysqldump from the source, then imports into Sabila MySQL.
   */
  public async migrateDatabases(
    sourceHost: string = '127.0.0.1',
    sourcePort: number = 3306,
    sourceUser: string = 'root',
    sourcePassword: string = '',
    databases?: string[]
  ): Promise<{ migrated: string[]; errors: string[] }> {
    const migrated: string[] = [];
    const errors: string[] = [];

    try {
      // If no specific databases, discover them
      if (!databases || databases.length === 0) {
        const mysql2 = await import('mysql2/promise');
        const sourceConn = await mysql2.createConnection({
          host: sourceHost,
          port: sourcePort,
          user: sourceUser,
          password: sourcePassword
        });

        const [rows] = await sourceConn.query('SHOW DATABASES') as any;
        const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'];
        databases = rows
          .map((r: any) => r.Database || Object.values(r)[0] as string)
          .filter((db: string) => !systemDbs.includes(db));

        await sourceConn.end();
      }

      // For each database, export and import
      for (const db of databases!) {
        try {
          logger.info(`Migrating database: ${db}`);

          // Use mysqldump via shell if available, otherwise manual export
          const dumpPath = path.join(getBaseDir(), 'tmp', `${db}_migration.sql`);
          if (!fs.existsSync(path.join(getBaseDir(), 'tmp'))) {
            fs.mkdirSync(path.join(getBaseDir(), 'tmp'), { recursive: true });
          }

          // Try mysqldump first (faster and more reliable)
          const mysqldumpSuccess = await this.tryMysqldump(
            sourceHost, sourcePort, sourceUser, sourcePassword, db, dumpPath
          );

          if (mysqldumpSuccess && fs.existsSync(dumpPath)) {
            // Import into Sabila MySQL
            await mysqlManager.executeSQL(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
            const sql = fs.readFileSync(dumpPath, 'utf8');
            await mysqlManager.executeSQL(`USE \`${db}\`; ${sql}`);
            fs.unlinkSync(dumpPath); // cleanup
          } else {
            // Fallback: manual row-by-row migration via mysql2
            const mysql2 = await import('mysql2/promise');
            const sourceConn = await mysql2.createConnection({
              host: sourceHost,
              port: sourcePort,
              user: sourceUser,
              password: sourcePassword,
              database: db,
              multipleStatements: true
            });

            // Create database on target
            await mysqlManager.executeSQL(`CREATE DATABASE IF NOT EXISTS \`${db}\``);

            const [tables] = await sourceConn.query('SHOW TABLES') as any;
            for (const tableRow of tables) {
              const tableName = Object.values(tableRow)[0] as string;
              const [createResult] = await sourceConn.query(`SHOW CREATE TABLE \`${tableName}\``) as any;
              const createSQL = createResult[0]['Create Table'];
              if (createSQL) {
                await mysqlManager.executeSQL(`USE \`${db}\`; DROP TABLE IF EXISTS \`${tableName}\`; ${createSQL};`);
              }

              // Copy data
              const [rows] = await sourceConn.query(`SELECT * FROM \`${tableName}\``) as any;
              if (rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const values = rows.map((row: any) =>
                  `(${columns.map(col => {
                    const val = row[col];
                    if (val === null) return 'NULL';
                    if (typeof val === 'number') return val;
                    return `'${String(val).replace(/'/g, "\\'")}'`;
                  }).join(', ')})`
                ).join(',\n');
                await mysqlManager.executeSQL(
                  `USE \`${db}\`; INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES ${values};`
                );
              }
            }

            await sourceConn.end();
          }

          migrated.push(db);
          logger.info(`Database ${db} migrated successfully.`);
        } catch (err: any) {
          errors.push(`Database ${db}: ${err.message}`);
          logger.error(`Failed to migrate database ${db}: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Connection error: ${err.message}`);
    }

    return { migrated, errors };
  }

  private async tryMysqldump(
    host: string, port: number, user: string, password: string,
    database: string, outputPath: string
  ): Promise<boolean> {
    // Try to find mysqldump in Sabila
    const possiblePaths = [
      path.join(getBaseDir(), 'bin', 'mysql'),
    ];

    let mysqldumpPath = '';
    for (const basePath of possiblePaths) {
      if (!fs.existsSync(basePath)) continue;
      const search = (dir: string, depth: number): string | null => {
        if (depth > 3) return null;
        const target = path.join(dir, 'mysqldump.exe');
        if (fs.existsSync(target)) return target;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              const res = search(path.join(dir, entry.name), depth + 1);
              if (res) return res;
            }
          }
        } catch { /* ignore */ }
        return null;
      };
      const found = search(basePath, 0);
      if (found) { mysqldumpPath = found; break; }
    }

    if (!mysqldumpPath) return false;

    return new Promise(resolve => {
      const { spawn } = require('child_process');
      const args = ['-h', host, '-P', port.toString(), '-u', user];
      if (password) args.push(`-p${password}`);
      args.push('--databases', database);

      const dumpProcess = spawn(mysqldumpPath, args, { windowsHide: true });
      const writeStream = fs.createWriteStream(outputPath);
      dumpProcess.stdout.pipe(writeStream);

      let resolved = false;

      dumpProcess.on('close', (code: number) => {
        if (resolved) return;
        resolved = true;
        if (code !== 0) {
          logger.warn(`mysqldump failed for ${database} with code ${code}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });

      dumpProcess.on('error', (err: any) => {
        if (resolved) return;
        resolved = true;
        logger.warn(`mysqldump error for ${database}: ${err.message}`);
        resolve(false);
      });
      
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        logger.warn(`mysqldump timed out for ${database}`);
        dumpProcess.kill();
        resolve(false);
      }, 60000);
    });
  }

  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

export const migrationManager = new MigrationManager();
