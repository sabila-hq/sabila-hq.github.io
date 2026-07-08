import mysql from 'mysql2/promise';
import { logger } from './logger';
import { serviceManager } from './serviceManager';

export class MySQLManager {
  private connection: mysql.Connection | null = null;

  /**
   * Get or create a MySQL connection using Sabila's MySQL instance.
   */
  private async getConnection(): Promise<mysql.Connection> {
    if (this.connection) {
      try {
        await this.connection.ping();
        return this.connection;
      } catch {
        this.connection = null;
      }
    }

    // Get the port from serviceManager
    const statuses = serviceManager.getAllStatuses();
    const mysqlStatus = statuses['mysql'];
    const port = mysqlStatus?.port || 3306;

    this.connection = await mysql.createConnection({
      host: '127.0.0.1',
      port,
      user: 'root',
      password: '',
      multipleStatements: true
    });

    logger.info(`MySQL connection established on port ${port}`);
    return this.connection;
  }

  /**
   * Execute any SQL query — DDL, DML, DCL, or DQL.
   * Full power: CREATE, DROP, ALTER, INSERT, UPDATE, DELETE, GRANT, SELECT, etc.
   */
  public async executeSQL(sql: string, database?: string): Promise<any> {
    try {
      const conn = await this.getConnection();

      if (database) {
        await conn.query(`USE \`${database}\``);
      }

      const [rows, fields] = await conn.query(sql);

      // For SELECT statements, return rows
      if (Array.isArray(rows)) {
        return {
          success: true,
          rowCount: rows.length,
          rows: rows.slice(0, 100), // Limit to 100 rows for AI context
          fields: fields && Array.isArray(fields) ? fields.map((f: any) => f.name) : undefined
        };
      }

      // For INSERT/UPDATE/DELETE/DDL/DCL, return affected info
      const result = rows as any;
      return {
        success: true,
        affectedRows: result.affectedRows,
        insertId: result.insertId,
        message: result.message || `Query executed successfully.`
      };
    } catch (err: any) {
      logger.error(`MySQL query error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * List all databases
   */
  public async listDatabases(): Promise<string[]> {
    const result = await this.executeSQL('SHOW DATABASES');
    if (result.success && result.rows) {
      return result.rows.map((r: any) => r.Database || r.database || Object.values(r)[0]);
    }
    return [];
  }

  /**
   * List tables in a database
   */
  public async listTables(database: string): Promise<string[]> {
    const result = await this.executeSQL('SHOW TABLES', database);
    if (result.success && result.rows) {
      return result.rows.map((r: any) => Object.values(r)[0] as string);
    }
    return [];
  }

  /**
   * Export a database to SQL string (for migration)
   */
  public async exportDatabase(database: string): Promise<string> {
    try {
      const conn = await this.getConnection();
      await conn.query(`USE \`${database}\``);

      let dump = `-- Sabila Database Export\n-- Database: ${database}\n-- Date: ${new Date().toISOString()}\n\n`;
      dump += `CREATE DATABASE IF NOT EXISTS \`${database}\`;\nUSE \`${database}\`;\n\n`;

      const tables = await this.listTables(database);

      for (const table of tables) {
        // Get CREATE TABLE
        const [createResult] = await conn.query(`SHOW CREATE TABLE \`${table}\``) as any;
        const createSQL = createResult[0]['Create Table'] || createResult[0]['Create View'];
        dump += `DROP TABLE IF EXISTS \`${table}\`;\n${createSQL};\n\n`;

        // Get data
        const [rows] = await conn.query(`SELECT * FROM \`${table}\``) as any;
        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          for (const row of rows) {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'number') return val;
              return `'${String(val).replace(/'/g, "\\'")}'`;
            });
            dump += `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          }
          dump += '\n';
        }
      }

      return dump;
    } catch (err: any) {
      logger.error(`Database export error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Import SQL dump into MySQL
   */
  public async importSQL(sqlContent: string): Promise<any> {
    return await this.executeSQL(sqlContent);
  }

  /**
   * Close connection
   */
  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

export const mysqlManager = new MySQLManager();
