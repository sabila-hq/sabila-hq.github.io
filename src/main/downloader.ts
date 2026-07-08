import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { logger } from './logger';
import { serviceManager } from './serviceManager';
import { getBaseDir } from './env';

export class ServiceDownloader {
  private baseDir: string = getBaseDir();

  // We map services to their reliable stable download URLs.
  // In a real production app, these would fetch from a JSON registry on GitHub.
  private registry: Record<string, string> = {
    'php': 'https://windows.php.net/downloads/releases/php-8.2.20-nts-Win32-vs16-x64.zip',
    'nginx': 'https://nginx.org/download/nginx-1.24.0.zip',
    // Using MariaDB as MySQL drop-in for Windows due to simpler portable zips
    'mysql': 'https://archive.mariadb.org/mariadb-10.11.4/winx64-packages/mariadb-10.11.4-winx64.zip' 
  };

  public async downloadAndInstall(serviceId: string, onProgress: (percent: number) => void): Promise<boolean> {
    const url = this.registry[serviceId];
    if (!url) {
      throw new Error(`No stable download found for service: ${serviceId}`);
    }

    const tempZipPath = path.join(this.baseDir, 'tmp', `${serviceId}.zip`);
    const extractDest = path.join(this.baseDir, 'bin', serviceId, 'latest');

    try {
      logger.info(`Starting download for ${serviceId} from ${url}`);
      
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });

      const totalLength = response.headers['content-length'];

      const writer = fs.createWriteStream(tempZipPath);
      
      let downloaded = 0;
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalLength) {
          const percent = Math.round((downloaded / parseInt(totalLength as string)) * 100);
          onProgress(percent);
        }
      });

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error: Error | null = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) resolve(true);
        });
      });

      logger.info(`Extracting ${serviceId}...`);
      onProgress(100); // Extracting state
      
      const zip = new AdmZip(tempZipPath);
      
      // Clear old directory if exists
      if (fs.existsSync(extractDest)) {
        fs.rmSync(extractDest, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDest, { recursive: true });
      
      zip.extractAllTo(extractDest, true);
      
      logger.info(`Successfully installed ${serviceId} to ${extractDest}`);
      fs.unlinkSync(tempZipPath);
      
      // Update store so it uses the 'latest' version
      const { store } = require('./store');
      store.set(`${serviceId}Version`, 'latest');
      
      return true;
    } catch (e: any) {
      logger.error(`Download failed for ${serviceId}: ${e.message}`);
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
      throw e;
    }
  }
}

export const serviceDownloader = new ServiceDownloader();
