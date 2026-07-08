import http from 'http';
import { serviceManager } from './serviceManager';
// (we will import aiService or other managers as needed)
import { logger } from './logger';
import { getBaseDir } from './env';

export class HttpApi {
  private server: http.Server;

  constructor() {
    this.server = http.createServer(async (req, res) => {
      // CORS headers for local usage
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/api/services' && req.method === 'GET') {
        const statuses = serviceManager.getAllStatuses();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(statuses));
        return;
      }

      // We can add POST /api/execute for tool executions
      if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { tool, params } = data;
            let result: any = { success: false, message: 'Unknown tool' };

            if (tool === 'start_service') {
              const success = await serviceManager.startService(params.id);
              result = { success, message: success ? 'Started' : 'Failed to start' };
            } else if (tool === 'stop_service') {
              const success = await serviceManager.stopService(params.id);
              result = { success, message: success ? 'Stopped' : 'Failed to stop' };
            } 
            // We will add more tools here later

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (req.url?.startsWith('/api/cli')) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const cmd = urlObj.searchParams.get('cmd');
        const arg = urlObj.searchParams.get('arg');
        
        let output = '';
        if (cmd === 'start') {
          if (arg === 'all') {
            const statuses = serviceManager.getAllStatuses();
            for (const id of Object.keys(statuses)) {
              if (statuses[id].isInstalled && statuses[id].status !== 'running') {
                await serviceManager.startService(id);
              }
            }
            output = 'All services started.';
          } else if (arg) {
            await serviceManager.startService(arg);
            output = `Service ${arg} started.`;
          }
        } else if (cmd === 'stop') {
          if (arg === 'all') {
            const statuses = serviceManager.getAllStatuses();
            for (const id of Object.keys(statuses)) {
              if (statuses[id].status === 'running') {
                await serviceManager.stopService(id);
              }
            }
            output = 'All services stopped.';
          } else if (arg) {
            await serviceManager.stopService(arg);
            output = `Service ${arg} stopped.`;
          }
        } else if (cmd === 'logs') {
          if (arg) {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(getBaseDir(), 'logs', `${arg}-error.log`);
            if (fs.existsSync(logPath)) {
              const content = fs.readFileSync(logPath, 'utf8');
              const lines = content.split('\\n');
              output = lines.slice(-20).join('\\n');
            } else {
              output = `No logs found for ${arg}.`;
            }
          }
        } else {
          output = 'Sabila CLI\\nUsage: sabila [start|stop|logs] [all|service_name]';
        }
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(output + '\\n');
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });
  }

  public start(port: number = 31337) {
    this.server.listen(port, '127.0.0.1', () => {
      logger.info(`Local HTTP API running on port ${port}`);
    });
    this.server.on('error', (err) => {
      logger.error(`HTTP API Error: ${err.message}`);
    });
  }
}

export const httpApi = new HttpApi();
