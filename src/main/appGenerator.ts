import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { BrowserWindow } from 'electron';

export type AppTemplate = 'laravel' | 'wordpress' | 'codeigniter3' | 'codeigniter4' | 'symfony' | 'slim' | 'yii' | 'cakephp' | 'express' | 'fastify' | 'koa' | 'nestjs' | 'adonisjs' | 'hono';

export interface AppGeneratorProgress {
  step: string;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  log?: string;
}

export interface GenerateAppOptions {
  template: AppTemplate;
  projectName: string;
  docRoot: string; // e.g., C:\sabila\www
}

let currentStep = '';
let currentProgress = 0;

function sendProgress(step: string, progress: number, status: AppGeneratorProgress['status'], error?: string) {
  currentStep = step;
  currentProgress = progress;
  const payload: AppGeneratorProgress = { step, progress, status, error };
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('app-generator-progress', payload);
      }
    });
  } catch (e) { /* ignore */ }
  logger.info(`[AppGen] ${step} (${progress}%) - ${status}${error ? ': ' + error : ''}`);
}

function sendLog(logText: string) {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('app-generator-progress', { step: currentStep, progress: currentProgress, status: 'running', log: logText });
      }
    });
  } catch (e) { /* ignore */ }
}

function runCommand(command: string, args: string[], cwd: string): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const actualCommand = command;
    
    let output = '';
    let errorOutput = '';

    const child = spawn(actualCommand, args, {
      cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env as Record<string, string>, COMPOSER_NO_INTERACTION: '1' }
    });

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      logger.info(`[AppGen] ${text.trim()}`);
      sendLog(text);
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // Not all stderr is errors (composer uses stderr for progress)
      logger.info(`[AppGen] ${text.trim()}`);
      sendLog(text);
    });

    child.on('error', (err) => {
      resolve({ success: false, output, error: err.message });
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output, error: errorOutput || `Process exited with code ${code}` });
      }
    });
  });
}

export async function generateApp(options: GenerateAppOptions): Promise<{ success: boolean; projectPath: string; error?: string }> {
  const { template, projectName, docRoot } = options;
  const projectPath = path.join(docRoot, projectName);

  // Validate project name
  if (!projectName || /[^a-zA-Z0-9_-]/.test(projectName)) {
    return { success: false, projectPath, error: 'Invalid project name. Use only letters, numbers, hyphens and underscores.' };
  }

  // Check if directory already exists
  if (fs.existsSync(projectPath)) {
    return { success: false, projectPath, error: `Directory "${projectName}" already exists in ${docRoot}` };
  }

  sendProgress('Preparing...', 5, 'running');

  try {
    switch (template) {
      case 'laravel':
        return await generateLaravel(projectName, docRoot, projectPath);
      case 'wordpress':
        return await generateWordPress(projectName, docRoot, projectPath);
      case 'codeigniter3':
        return await generateCodeIgniter3(projectName, docRoot, projectPath);
      case 'codeigniter4':
        return await generateCodeIgniter4(projectName, docRoot, projectPath);
      case 'symfony':
        return await generateSymfony(projectName, docRoot, projectPath);
      case 'slim':
        return await generateSlim(projectName, docRoot, projectPath);
      case 'yii':
        return await generateYii(projectName, docRoot, projectPath);
      case 'cakephp':
        return await generateCakePHP(projectName, docRoot, projectPath);
      case 'express':
        return await generateExpress(projectName, docRoot, projectPath);
      case 'fastify':
        return await generateFastify(projectName, docRoot, projectPath);
      case 'koa':
        return await generateKoa(projectName, docRoot, projectPath);
      case 'nestjs':
        return await generateNestJS(projectName, docRoot, projectPath);
      case 'adonisjs':
        return await generateAdonisJS(projectName, docRoot, projectPath);
      case 'hono':
        return await generateHono(projectName, docRoot, projectPath);
      default:
        return { success: false, projectPath, error: `Unknown template: ${template}` };
    }
  } catch (err: any) {
    sendProgress('Error', 0, 'error', err.message);
    return { success: false, projectPath, error: err.message };
  }
}

async function generateLaravel(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Laravel project with Composer...', 15, 'running');

  const result = await runCommand('composer', ['create-project', '--prefer-dist', 'laravel/laravel', projectName], docRoot);

  if (!result.success) {
    sendProgress('Failed to create Laravel project', 0, 'error', result.error);
    return { success: false, projectPath, error: result.error || 'Composer create-project failed' };
  }

  sendProgress('Setting up .env file...', 80, 'running');

  // Copy .env.example to .env if exists
  const envExample = path.join(projectPath, '.env.example');
  const envFile = path.join(projectPath, '.env');
  if (fs.existsSync(envExample) && !fs.existsSync(envFile)) {
    fs.copyFileSync(envExample, envFile);
  }

  sendProgress('Generating application key...', 90, 'running');
  await runCommand('php', ['artisan', 'key:generate'], projectPath);

  sendProgress('Laravel project created successfully! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateWordPress(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Downloading WordPress latest (id_ID)...', 15, 'running');

  fs.mkdirSync(projectPath, { recursive: true });

  const wpCliResult = await runCommand('wp', ['--info'], docRoot);
  
  if (wpCliResult.success) {
    sendProgress('Using WP-CLI to download WordPress...', 30, 'running');
    const dlResult = await runCommand('wp', ['core', 'download', '--locale=id_ID', `--path=${projectPath}`], docRoot);
    
    if (!dlResult.success) {
      return { success: false, projectPath, error: 'WP-CLI download failed: ' + dlResult.error };
    }

    sendProgress('Creating wp-config.php...', 50, 'running');
    const configResult = await runCommand('wp', ['config', 'create', `--dbname=${projectName}`, '--dbuser=root', '--dbpass=', '--skip-check'], projectPath);
    if (!configResult.success) {
      return { success: false, projectPath, error: 'WP-CLI config create failed: ' + configResult.error };
    }

    sendProgress('Creating database...', 70, 'running');
    await runCommand('wp', ['db', 'create'], projectPath);

    sendProgress('Installing WordPress...', 85, 'running');
    const installResult = await runCommand('wp', ['core', 'install', `--url=http://localhost/${projectName}`, '--title=Web Saya', '--admin_user=admin', '--admin_password=passwordkuat', '--admin_email=email@domain.com'], projectPath);
    
    if (!installResult.success) {
      return { success: false, projectPath, error: 'WP-CLI install failed: ' + installResult.error };
    }
  } else {
    return { success: false, projectPath, error: 'WP-CLI is not installed or accessible.' };
  }

  sendProgress('WordPress installed successfully! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function downloadWordPressZip(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Downloading WordPress zip...', 40, 'running');

  const zipPath = path.join(docRoot, 'wordpress-latest.zip');

  // Download using powershell (works on Windows without extra tools)
  const dlResult = await runCommand('powershell', [
    '-Command',
    `Invoke-WebRequest -Uri 'https://wordpress.org/latest.zip' -OutFile '${zipPath}'`
  ], docRoot);

  if (!dlResult.success) {
    sendProgress('Failed to download WordPress', 0, 'error', dlResult.error);
    return { success: false, projectPath, error: 'Failed to download WordPress: ' + dlResult.error };
  }

  sendProgress('Extracting WordPress...', 65, 'running');

  // Extract using powershell
  const extractResult = await runCommand('powershell', [
    '-Command',
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${docRoot}' -Force`
  ], docRoot);

  if (!extractResult.success) {
    sendProgress('Failed to extract WordPress', 0, 'error', extractResult.error);
    return { success: false, projectPath, error: 'Failed to extract WordPress: ' + extractResult.error };
  }

  // WordPress extracts to a "wordpress" folder, rename it
  const wpExtracted = path.join(docRoot, 'wordpress');
  if (fs.existsSync(wpExtracted)) {
    // Remove existing target if needed, then rename
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    fs.renameSync(wpExtracted, projectPath);
  }

  // Clean up zip
  try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }

  sendProgress('Setting up wp-config.php...', 85, 'running');

  const wpConfigSample = path.join(projectPath, 'wp-config-sample.php');
  const wpConfig = path.join(projectPath, 'wp-config.php');
  if (fs.existsSync(wpConfigSample) && !fs.existsSync(wpConfig)) {
    let config = fs.readFileSync(wpConfigSample, 'utf8');
    config = config.replace("'database_name_here'", `'${projectName}'`);
    config = config.replace("'username_here'", "'root'");
    config = config.replace("'password_here'", "''");
    fs.writeFileSync(wpConfig, config);
  }

  sendProgress('WordPress installed successfully! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateCodeIgniter3(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Downloading CodeIgniter 3...', 15, 'running');

  fs.mkdirSync(projectPath, { recursive: true });

  const zipPath = path.join(docRoot, 'ci3-latest.zip');

  // Download CI3 from GitHub
  const dlResult = await runCommand('powershell', [
    '-Command',
    `Invoke-WebRequest -Uri 'https://api.github.com/repos/bcit-ci/CodeIgniter/zipball/refs/tags/3.1.13' -OutFile '${zipPath}'`
  ], docRoot);

  if (!dlResult.success) {
    sendProgress('Failed to download CodeIgniter 3', 0, 'error', dlResult.error);
    return { success: false, projectPath, error: 'Failed to download CI3: ' + dlResult.error };
  }

  sendProgress('Extracting CodeIgniter 3...', 50, 'running');

  const extractResult = await runCommand('powershell', [
    '-Command',
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${docRoot}' -Force`
  ], docRoot);

  if (!extractResult.success) {
    sendProgress('Failed to extract CodeIgniter 3', 0, 'error', extractResult.error);
    return { success: false, projectPath, error: 'Failed to extract CI3: ' + extractResult.error };
  }

  // CI3 extracts to CodeIgniter-develop, move contents
  // Find the extracted folder (GitHub zipballs have a dynamic hash like bcit-ci-CodeIgniter-bcb17eb)
  const filesInRoot = fs.readdirSync(docRoot);
  const extractedFolder = filesInRoot.find(f => f.startsWith('bcit-ci-CodeIgniter-'));
  
  if (extractedFolder) {
    const ci3Extracted = path.join(docRoot, extractedFolder);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    fs.renameSync(ci3Extracted, projectPath);
  } else {
    // Fallback if somehow it's different
    const ci3Old = path.join(docRoot, 'CodeIgniter-develop');
    if (fs.existsSync(ci3Old)) {
       if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });
       fs.renameSync(ci3Old, projectPath);
    }
  }

  try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }

  sendProgress('CodeIgniter 3 installed successfully! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateCodeIgniter4(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating CodeIgniter 4 project with Composer...', 15, 'running');

  const result = await runCommand('composer', ['create-project', 'codeigniter4/appstarter', projectName], docRoot);

  if (!result.success) {
    sendProgress('Failed to create CodeIgniter 4 project', 0, 'error', result.error);
    return { success: false, projectPath, error: result.error || 'Composer create-project failed for CI4' };
  }

  sendProgress('Setting up environment...', 80, 'running');

  // Copy env to .env
  const envFile = path.join(projectPath, 'env');
  const dotEnvFile = path.join(projectPath, '.env');
  if (fs.existsSync(envFile) && !fs.existsSync(dotEnvFile)) {
    let envContent = fs.readFileSync(envFile, 'utf8');
    envContent = envContent.replace(/# CI_ENVIRONMENT = production/g, 'CI_ENVIRONMENT = development');
    fs.writeFileSync(dotEnvFile, envContent);
  }

  sendProgress('CodeIgniter 4 installed successfully! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateSymfony(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Symfony project...', 15, 'running');
  const result = await runCommand('composer', ['create-project', 'symfony/skeleton', projectName], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('Symfony project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateSlim(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Slim project...', 15, 'running');
  const result = await runCommand('composer', ['create-project', 'slim/slim-skeleton', projectName], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('Slim project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateYii(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Yii project...', 15, 'running');
  const result = await runCommand('composer', ['create-project', '--prefer-dist', 'yiisoft/yii2-app-basic', projectName], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('Yii project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateCakePHP(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating CakePHP project...', 15, 'running');
  const result = await runCommand('composer', ['create-project', '--prefer-dist', 'cakephp/app', projectName], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('CakePHP project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateExpress(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Express project...', 15, 'running');
  fs.mkdirSync(projectPath, { recursive: true });
  await runCommand('npm', ['init', '-y'], projectPath);
  const result = await runCommand('npm', ['i', 'express'], projectPath);
  if (!result.success) return { success: false, projectPath, error: result.error };
  fs.writeFileSync(path.join(projectPath, 'index.js'), "const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('Hello Express!'));\napp.listen(3000, () => console.log('Listening on port 3000'));");
  sendProgress('Express project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateFastify(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Fastify project...', 15, 'running');
  fs.mkdirSync(projectPath, { recursive: true });
  await runCommand('npm', ['init', '-y'], projectPath);
  const result = await runCommand('npm', ['i', 'fastify'], projectPath);
  if (!result.success) return { success: false, projectPath, error: result.error };
  fs.writeFileSync(path.join(projectPath, 'index.js'), "const fastify = require('fastify')({ logger: true });\nfastify.get('/', async (request, reply) => { return { hello: 'world' } });\nfastify.listen({ port: 3000 }, (err) => { if (err) { fastify.log.error(err); process.exit(1); } });");
  sendProgress('Fastify project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateKoa(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Koa project...', 15, 'running');
  fs.mkdirSync(projectPath, { recursive: true });
  await runCommand('npm', ['init', '-y'], projectPath);
  const result = await runCommand('npm', ['i', 'koa'], projectPath);
  if (!result.success) return { success: false, projectPath, error: result.error };
  fs.writeFileSync(path.join(projectPath, 'index.js'), "const Koa = require('koa');\nconst app = new Koa();\napp.use(ctx => { ctx.body = 'Hello Koa'; });\napp.listen(3000);");
  sendProgress('Koa project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateNestJS(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating NestJS project...', 15, 'running');
  const result = await runCommand('npx', ['@nestjs/cli', 'new', projectName, '--package-manager', 'npm', '--strict', '--skip-git'], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('NestJS project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateAdonisJS(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating AdonisJS project...', 15, 'running');
  const result = await runCommand('npm', ['init', 'adonisjs@latest', projectName, '--', '--kit=api', '--package-manager=npm'], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('AdonisJS project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}

async function generateHono(projectName: string, docRoot: string, projectPath: string): Promise<{ success: boolean; projectPath: string; error?: string }> {
  sendProgress('Creating Hono project...', 15, 'running');
  const result = await runCommand('npm', ['create', 'hono@latest', projectName, '--', '--template', 'nodejs', '--install', '--pm', 'npm'], docRoot);
  if (!result.success) return { success: false, projectPath, error: result.error };
  sendProgress('Hono project created! 🎉', 100, 'done');
  return { success: true, projectPath };
}
