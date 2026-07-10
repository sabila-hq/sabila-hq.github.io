import { ipcMain } from 'electron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getDataDir } from './env';

const historyPath = path.join(getDataDir(), 'api-tester-history.json');

export function setupApiTesterIpc() {
  ipcMain.handle('api-tester-request', async (_, config) => {
    const startTime = Date.now();
    try {
      let finalData = config.data;
      let finalHeaders = { ...config.headers };

      // Handle auth separately if passed from UI
      if (config.auth) {
        if (config.auth.type === 'bearer' && config.auth.token) {
          finalHeaders['Authorization'] = `Bearer ${config.auth.token}`;
        } else if (config.auth.type === 'basic' && config.auth.username) {
          const credentials = Buffer.from(`${config.auth.username}:${config.auth.password || ''}`).toString('base64');
          finalHeaders['Authorization'] = `Basic ${credentials}`;
        }
      }

      if (config.bodyType === 'urlencoded' && finalData) {
        const params = new URLSearchParams();
        for (const key of Object.keys(finalData)) {
          params.append(key, finalData[key]);
        }
        finalData = params.toString();
        finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (config.bodyType === 'form-data' && finalData) {
        const form = new FormData();
        for (const key of Object.keys(finalData)) {
          form.append(key, finalData[key]);
        }
        finalData = form;
      }

      const response = await axios({
        url: config.url,
        method: config.method,
        headers: finalHeaders,
        data: finalData,
        params: config.params,
        timeout: 30000,
        validateStatus: () => true, // Don't throw on 4xx/5xx
      });

      const latency = Date.now() - startTime;
      
      let size = 0;
      if (response.data) {
        if (typeof response.data === 'string') {
          size = Buffer.byteLength(response.data);
        } else {
          size = Buffer.byteLength(JSON.stringify(response.data));
        }
      }

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        latency,
        size
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  });

  ipcMain.handle('api-tester-get-history', () => {
    try {
      if (fs.existsSync(historyPath)) {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }
    } catch (e) {}
    return [];
  });

  ipcMain.handle('api-tester-save-history', (_, history) => {
    try {
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      return true;
    } catch (e) {
      return false;
    }
  });
}
