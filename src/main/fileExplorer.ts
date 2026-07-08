import fs from 'fs';
import path from 'path';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
  children?: FileNode[];
}

export class FileExplorer {
  // Fast asynchronous recursive folder size calculation
  private async getFolderSize(dirPath: string): Promise<number> {
    let totalSize = 0;
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.getFolderSize(entryPath);
        } else {
          try {
            const stats = await fs.promises.stat(entryPath);
            totalSize += stats.size;
          } catch (e) {
            // Ignore access errors
          }
        }
      }
    } catch (e) {
      // Ignore access errors
    }
    return totalSize;
  }

  // Get directory contents for a specific path (lazy load to avoid freezing)
  public async getDirectoryInfo(targetPath: string): Promise<FileNode[]> {
    if (!fs.existsSync(targetPath)) return [];

    try {
      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(targetPath, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          const isDir = entry.isDirectory();
          
          let size = stats.size;
          // Only calculate folder size for the first level to avoid massive lag
          if (isDir) {
            size = await this.getFolderSize(fullPath);
          }

          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: isDir,
            size,
            modifiedAt: stats.mtime
          });
        } catch (e) {
          // Skip if we can't read stats (permissions, etc)
        }
      }

      // Sort: Folders first, then alphabetically
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return nodes;
    } catch (err) {
      console.error(`Failed to read directory ${targetPath}:`, err);
      return [];
    }
  }
}

export const fileExplorer = new FileExplorer();
