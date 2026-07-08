import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { getDataDir } from './env';

export interface AppSettings {
  aiProvider: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  language: string;
  docRootName: string;
  theme: 'dark' | 'light' | 'system';
  projectPhpVersions: Record<string, string>;
  [key: string]: any;
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'deepseek',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiApiKey: '',
  aiModel: 'deepseek-chat',
  language: 'id',
  docRootName: 'www',
  theme: 'dark',
  projectPhpVersions: {},
  mailSender: {
    enabled: false,
    gmailAccount: '',
    gmailPassword: ''
  }
};

export class Store {
  private storePath: string;
  private data: AppSettings;

  constructor() {
    try {
      app.setPath('userData', getDataDir());
    } catch (e) {}
    this.storePath = path.join(getDataDir(), 'settings.json');
    this.data = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.storePath)) {
        const fileData = fs.readFileSync(this.storePath, 'utf8');
        const parsed = JSON.parse(fileData);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      logger.error(`Failed to load settings: ${err}`);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.data[key];
  }

  public getAll(): AppSettings {
    return { ...this.data };
  }

  public set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.data[key] = value;
    this.save();
  }

  public setAll(settings: Partial<AppSettings>): void {
    this.data = { ...this.data, ...settings };
    this.save();
  }

  private save(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
      logger.info('Settings saved successfully.');
    } catch (err) {
      logger.error(`Failed to save settings: ${err}`);
    }
  }
}

export const store = new Store();
