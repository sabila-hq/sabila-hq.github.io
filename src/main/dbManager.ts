import mysql from 'mysql2/promise';
import { logger } from './logger';
import { getBaseDir } from './env';
import { serviceManager } from './serviceManager';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

class DbManager {
  private connection: mysql.Connection | null = null;

  public async connect(config: mysql.ConnectionOptions) {
    try {
      if (this.connection) {
        await this.connection.end();
      }
      this.connection = await mysql.createConnection({
        host: config.host || '127.0.0.1',
        user: config.user || 'root',
        password: config.password || '',
        port: config.port || 3306,
        database: config.database
      });
      logger.info(`Database connected successfully to ${config.host}:${config.port}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Database connection failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  public async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
    return { success: true };
  }

  public async getDatabases() {
    if (!this.connection) return { success: false, error: 'Not connected' };
    try {
      const [rows] = await this.connection.query('SHOW DATABASES');
      const databases = (rows as any[]).map(row => Object.values(row)[0]);
      return { success: true, data: databases };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async getTables(database: string) {
    if (!this.connection) return { success: false, error: 'Not connected' };
    try {
      await this.connection.changeUser({ database });
      const [rows] = await this.connection.query('SHOW TABLES');
      const tables = (rows as any[]).map(row => Object.values(row)[0]);
      return { success: true, data: tables };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async query(sql: string) {
    if (!this.connection) return { success: false, error: 'Not connected' };
    try {
      const [result, fields] = await this.connection.query(sql);
      if (Array.isArray(result)) {
        const columns = fields ? (fields as any[]).map(f => f.name) : [];
        return { success: true, data: { isSelect: true, rows: result, columns } };
      } else {
        // It's a ResultSetHeader from DDL/DML/DCL
        const header = result as mysql.ResultSetHeader;
        return { 
          success: true, 
          data: { 
            isSelect: false, 
            affectedRows: header.affectedRows, 
            insertId: header.insertId,
            message: header.info || 'Query executed successfully'
          } 
        };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async createSnapshot(database: string, port: number) {
    return new Promise((resolve) => {
      try {
        const mysqlBinDir = path.join(getBaseDir(), 'bin', 'mysql', 'mysql-8.0.30-winx64', 'bin'); // Fallback if needed
        let mysqldumpExe = 'mysqldump';
        
        // Try to find the active MySQL binary
        const mysqlExe = serviceManager.getExecutablePath('mysql');
        if (mysqlExe) {
          mysqldumpExe = path.join(path.dirname(mysqlExe), 'mysqldump.exe');
        }

        const snapshotDir = path.join(getBaseDir(), 'data', 'db_snapshots');
        if (!fs.existsSync(snapshotDir)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${database}_${timestamp}.sql`;
        const filePath = path.join(snapshotDir, fileName);

        // Run mysqldump
        // Assuming user root, empty password, on 127.0.0.1
        const cmd = `"${mysqldumpExe}" -h 127.0.0.1 -P ${port} -u root ${database} > "${filePath}"`;
        
        exec(cmd, (err: any) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, filePath, fileName });
          }
        });
      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  public async listSnapshots(database?: string) {
    try {
      const snapshotDir = path.join(getBaseDir(), 'data', 'db_snapshots');
      if (!fs.existsSync(snapshotDir)) return { success: true, data: [] };

      const files = fs.readdirSync(snapshotDir);
      const snapshots = files
        .filter((f: string) => f.endsWith('.sql'))
        .filter((f: string) => !database || f.startsWith(`${database}_`))
        .map((f: string) => {
          const stats = fs.statSync(path.join(snapshotDir, f));
          return {
            filename: f,
            database: f.split('_')[0],
            createdAt: stats.birthtime,
            size: stats.size
          };
        })
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return { success: true, data: snapshots };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async restoreSnapshot(filename: string, port: number) {
    return new Promise((resolve) => {
      try {
        const snapshotDir = path.join(getBaseDir(), 'data', 'db_snapshots');
        const filePath = path.join(snapshotDir, filename);

        if (!fs.existsSync(filePath)) {
          return resolve({ success: false, error: 'Snapshot file not found' });
        }

        const database = filename.split('_')[0];
        
        let mysqlRestExe = 'mysql';
        const mysqldExe = serviceManager.getExecutablePath('mysql');
        if (mysqldExe) {
          mysqlRestExe = `"${path.join(path.dirname(mysqldExe), 'mysql.exe')}"`;
        }

        const cmd = `${mysqlRestExe} -h 127.0.0.1 -P ${port} -u root ${database} < "${filePath}"`;
        
        exec(cmd, (err: any) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  public async deleteSnapshot(filename: string) {
    try {
      const snapshotDir = path.join(getBaseDir(), 'data', 'db_snapshots');
      const filePath = path.join(snapshotDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: 'File not found' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async copySnapshot(filename: string, targetDatabase: string | undefined, port: number) {
    return new Promise(async (resolve) => {
      try {
        const snapshotDir = path.join(getBaseDir(), 'data', 'db_snapshots');
        const filePath = path.join(snapshotDir, filename);
        if (!fs.existsSync(filePath)) return resolve({ success: false, error: 'Snapshot not found' });

        const baseDbName = filename.split('_')[0];
        let finalTargetDb = targetDatabase;

        let conn: mysql.Connection | undefined;
        try {
          conn = await mysql.createConnection({
            host: '127.0.0.1', user: 'root', password: '', port: port
          });

          if (!finalTargetDb) {
            const [databasesResult] = await conn.query('SHOW DATABASES');
            const existingDbs = (databasesResult as any[]).map(r => Object.values(r)[0] as string);
            
            let seq = 1;
            while (existingDbs.includes(`${baseDbName}_${seq}`)) {
              seq++;
            }
            finalTargetDb = `${baseDbName}_${seq}`;
          }

          await conn.query(`CREATE DATABASE IF NOT EXISTS \`${finalTargetDb}\``);
        } catch (e: any) {
          return resolve({ success: false, error: 'Gagal membuat database baru: ' + e.message });
        } finally {
          if (conn) await conn.end();
        }

        let mysqlRestExe = 'mysql';
        const mysqldExe = serviceManager.getExecutablePath('mysql');
        if (mysqldExe) {
          mysqlRestExe = `"${path.join(path.dirname(mysqldExe), 'mysql.exe')}"`;
        }

        const cmd = `${mysqlRestExe} -h 127.0.0.1 -P ${port} -u root ${finalTargetDb} < "${filePath}"`;
        exec(cmd, (err: any) => {
          if (err) resolve({ success: false, error: err.message });
          else resolve({ success: true, newDatabase: finalTargetDb });
        });
      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  public async getSchema(config: any, database: string) {
    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host: config.host || '127.0.0.1',
        user: config.user || 'root',
        password: config.password || '',
        port: config.port || 3306,
        database: database
      });

      const [tables] = await connection.query('SHOW TABLES');
      const schemaMap: Record<string, string> = {};
      
      for (const row of (tables as any[])) {
        const tableName = Object.values(row)[0] as string;
        const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createString = (createTableResult as any[])[0]['Create Table'] || (createTableResult as any[])[0]['Create View'];
        schemaMap[tableName] = createString;
      }
      
      return { success: true, schema: schemaMap };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      if (connection) await connection.end();
    }
  }

  public async getDetailedSchema(config: any, database: string) {
    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host: config.host || '127.0.0.1',
        user: config.user || 'root',
        password: config.password || '',
        port: config.port || 3306,
        database: database
      });

      // Get all tables
      const [tablesResult] = await connection.query('SHOW TABLES');
      const tables = (tablesResult as any[]).map(r => Object.values(r)[0] as string);
      
      const detailedSchema: any = {
        database_name: database,
        tables: []
      };

      for (const tableName of tables) {
        const [columnsResult] = await connection.query(`SHOW FULL COLUMNS FROM \`${tableName}\``);
        
        let primaryKey = '';
        let totalSize = 0;
        
        const columns = (columnsResult as any[]).map(col => {
          if (col.Key === 'PRI') primaryKey = col.Field;
          
          // Estimate size based on Type
          let size = 0;
          const typeStr = col.Type.toLowerCase();
          if (typeStr.includes('int')) size = 4;
          if (typeStr.includes('bigint')) size = 8;
          if (typeStr.includes('varchar')) {
            const match = typeStr.match(/\((\d+)\)/);
            if (match) size = parseInt(match[1]);
          }
          if (typeStr.includes('text')) size = 65535; // arbitrary max
          if (typeStr.includes('datetime')) size = 8;
          
          totalSize += size;
          
          return {
            name: col.Field,
            type: col.Type,
            key: col.Key, // PRI, UNI, MUL
            comment: col.Comment || '',
            null: col.Null,
            default: col.Default,
            extra: col.Extra
          };
        });

        // Get Foreign Keys
        const [fksResult] = await connection.query(`
          SELECT 
            COLUMN_NAME, 
            REFERENCED_TABLE_NAME, 
            REFERENCED_COLUMN_NAME 
          FROM 
            INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE 
            TABLE_SCHEMA = ? AND 
            TABLE_NAME = ? AND 
            REFERENCED_TABLE_NAME IS NOT NULL
        `, [database, tableName]);

        detailedSchema.tables.push({
          table_name: tableName,
          primary_key: primaryKey,
          record_length: totalSize,
          columns: columns,
          foreign_keys: (fksResult as any[]).map(fk => ({
            column: fk.COLUMN_NAME,
            referenced_table: fk.REFERENCED_TABLE_NAME,
            referenced_column: fk.REFERENCED_COLUMN_NAME
          }))
        });
      }
      
      return { success: true, schema: detailedSchema };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      if (connection) await connection.end();
    }
  }

  public async exportSql(database: string, port: number, savePath: string) {
    return new Promise((resolve) => {
      try {
        let mysqldumpExe = 'mysqldump';
        const mysqlExe = serviceManager.getExecutablePath('mysql');
        if (mysqlExe) {
          mysqldumpExe = path.join(path.dirname(mysqlExe), 'mysqldump.exe');
        }

        const cmd = `"${mysqldumpExe}" -h 127.0.0.1 -P ${port} -u root ${database} > "${savePath}"`;
        
        exec(cmd, (err: any) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  public async importSql(database: string, port: number, loadPath: string) {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(loadPath)) {
          return resolve({ success: false, error: 'File SQL not found' });
        }

        let mysqlRestExe = 'mysql';
        const mysqldExe = serviceManager.getExecutablePath('mysql');
        if (mysqldExe) {
          mysqlRestExe = `"${path.join(path.dirname(mysqldExe), 'mysql.exe')}"`;
        }

        const cmd = `${mysqlRestExe} -h 127.0.0.1 -P ${port} -u root ${database} < "${loadPath}"`;
        
        exec(cmd, (err: any) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  }
}

export const dbManager = new DbManager();
