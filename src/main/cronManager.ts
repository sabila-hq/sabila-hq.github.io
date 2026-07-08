import * as cron from 'node-cron';
import { exec } from 'child_process';
import { store } from './store';
import { logger } from './logger';
import path from 'path';

export interface CronTask {
  id: string;
  name: string;
  command: string;
  cwd: string;
  schedule: string;
  active: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'running';
  lastOutput?: string;
}

export class CronManager {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private tasks: CronTask[] = [];

  constructor() {
    this.tasks = store.get('cronTasks') as CronTask[] || [];
  }

  public init() {
    for (const task of this.tasks) {
      if (task.active) {
        this.startJob(task);
      }
    }
  }

  public getTasks(): CronTask[] {
    return this.tasks;
  }

  public addTask(task: Omit<CronTask, 'id'>): CronTask {
    const newTask: CronTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      active: false
    };
    this.tasks.push(newTask);
    this.saveTasks();
    return newTask;
  }

  public updateTask(id: string, updates: Partial<CronTask>): CronTask | null {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    
    this.tasks[idx] = { ...this.tasks[idx], ...updates };
    this.saveTasks();

    if (this.tasks[idx].active) {
      this.stopJob(id);
      this.startJob(this.tasks[idx]);
    } else {
      this.stopJob(id);
    }

    return this.tasks[idx];
  }

  public deleteTask(id: string) {
    this.stopJob(id);
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
  }

  public toggleTask(id: string, active: boolean) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    this.tasks[idx].active = active;
    this.saveTasks();

    if (active) {
      this.startJob(this.tasks[idx]);
    } else {
      this.stopJob(id);
    }
  }

  public async runTaskNow(id: string): Promise<void> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    await this.executeCommand(task);
  }

  private startJob(task: CronTask) {
    if (this.activeJobs.has(task.id)) {
      this.stopJob(task.id);
    }

    if (!cron.validate(task.schedule)) {
      logger.error(`Invalid cron schedule for task ${task.id}: ${task.schedule}`);
      return;
    }

    const job = cron.schedule(task.schedule, async () => {
      await this.executeCommand(task);
    });

    this.activeJobs.set(task.id, job);
  }

  private stopJob(id: string) {
    const job = this.activeJobs.get(id);
    if (job) {
      job.stop();
      this.activeJobs.delete(id);
    }
  }

  private saveTasks() {
    store.set('cronTasks', this.tasks);
  }

  private async executeCommand(task: CronTask) {
    task.lastRun = new Date().toISOString();
    task.lastStatus = 'running';
    task.lastOutput = '';
    this.saveTasks();

    const projName = path.basename(task.cwd);
    const projectSecrets = store.get('projectSecrets') as Record<string, any> || {};
    const projSecrets = projectSecrets[projName] || {};
    const taskEnv = { ...process.env, ...projSecrets };

    return new Promise<void>((resolve) => {
      exec(task.command, { cwd: task.cwd, env: taskEnv }, (error, stdout, stderr) => {
        task.lastOutput = stdout ? stdout.toString() : (stderr ? stderr.toString() : '');
        if (error) {
          task.lastStatus = 'error';
          task.lastOutput = (error.message + '\n' + task.lastOutput).trim();
          logger.error(`Cron Job Failed [${task.name}]: ${error.message}`);
        } else {
          task.lastStatus = 'success';
        }
        this.saveTasks();
        resolve();
      });
    });
  }
}

export const cronManager = new CronManager();
