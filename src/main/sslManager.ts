import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createCA, createCert } from 'mkcert';
import { logger } from './logger';

export class SslManager {
  private baseDir: string;
  private sslDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.sslDir = path.join(this.baseDir, 'ssl');
  }

  public async setupCA(): Promise<boolean> {
    if (!fs.existsSync(this.sslDir)) {
      fs.mkdirSync(this.sslDir, { recursive: true });
    }

    const caCertPath = path.join(this.sslDir, 'ca.crt');
    const caKeyPath = path.join(this.sslDir, 'ca.key');

    // If CA already exists, we assume it's installed
    if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
      return true;
    }

    logger.info('Generating new Sabila Local Root CA...');
    try {
      const ca = await createCA({
        organization: 'Sabila Local Dev',
        countryCode: 'ID',
        state: 'Jawa Barat',
        locality: 'Bandung',
        validity: 3650 // 10 years
      });

      fs.writeFileSync(caCertPath, ca.cert);
      fs.writeFileSync(caKeyPath, ca.key);

      logger.info('Installing Root CA to Windows Trust Store...');
      await this.installCAToWindows(caCertPath);

      return true;
    } catch (err: any) {
      logger.error(`Failed to setup CA: ${err.message}`);
      return false;
    }
  }

  private installCAToWindows(caCertPath: string): Promise<void> {
    const innerCommand = `certutil -addstore -f "Root" '${caCertPath}'`;
    const encodedCommand = Buffer.from(innerCommand, 'utf16le').toString('base64');
    const psCommand = `Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', '${encodedCommand}' -Verb RunAs -Wait`;
    
    return new Promise((resolve, reject) => {
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, (error) => {
        if (error) {
          logger.error(`Failed to install CA to trust store: ${error}`);
          reject(error);
        } else {
          logger.info('CA successfully installed to Windows trust store.');
          resolve();
        }
      });
    });
  }

  public async generateCertForProject(projectName: string, domain: string): Promise<{ certPath: string, keyPath: string } | null> {
    const certPath = path.join(this.sslDir, `${projectName}.crt`);
    const keyPath = path.join(this.sslDir, `${projectName}.key`);

    // Only generate if it doesn't exist
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return { certPath, keyPath };
    }

    const caCertPath = path.join(this.sslDir, 'ca.crt');
    const caKeyPath = path.join(this.sslDir, 'ca.key');

    if (!fs.existsSync(caCertPath) || !fs.existsSync(caKeyPath)) {
      logger.warn(`Cannot generate cert for ${domain} because CA does not exist.`);
      return null;
    }

    try {
      logger.info(`Generating SSL certificate for ${domain}...`);
      const caCert = fs.readFileSync(caCertPath, 'utf-8');
      const caKey = fs.readFileSync(caKeyPath, 'utf-8');

      const cert = await createCert({
        domains: [domain, `*.${domain}`],
        validity: 365,
        ca: {
          key: caKey,
          cert: caCert
        }
      });

      fs.writeFileSync(certPath, cert.cert);
      fs.writeFileSync(keyPath, cert.key);

      logger.info(`Successfully generated cert for ${domain}.`);
      return { certPath, keyPath };
    } catch (err: any) {
      logger.error(`Failed to generate cert for ${domain}: ${err.message}`);
      return null;
    }
  }
}
