import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface SecurityIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  suggestion: string;
}

interface ScanResult {
  totalFiles: number;
  scannedFiles: number;
  issues: SecurityIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Security scanning patterns
const PATTERNS: {
  regex: RegExp;
  type: string;
  severity: SecurityIssue['severity'];
  description: string;
  suggestion: string;
}[] = [
  // SQL Injection
  {
    regex: /\$_(GET|POST|REQUEST|COOKIE)\s*\[.*?\].*?(mysql_query|mysqli_query|->query|->prepare)\s*\(/gi,
    type: 'SQL Injection',
    severity: 'critical',
    description: 'User input passed directly to SQL query without sanitization.',
    suggestion: 'Use prepared statements with parameterized queries (PDO or MySQLi).'
  },
  {
    regex: /["']\s*\.\s*\$_(GET|POST|REQUEST|COOKIE)\s*\[/gi,
    type: 'SQL Injection',
    severity: 'critical',
    description: 'String concatenation with user input in potential SQL context.',
    suggestion: 'Use parameterized queries instead of string concatenation.'
  },
  // XSS
  {
    regex: /echo\s+.*?\$_(GET|POST|REQUEST|COOKIE)\s*\[/gi,
    type: 'Cross-Site Scripting (XSS)',
    severity: 'high',
    description: 'User input echoed without escaping — vulnerable to XSS.',
    suggestion: 'Use htmlspecialchars($input, ENT_QUOTES, "UTF-8") before output.'
  },
  {
    regex: /print\s+.*?\$_(GET|POST|REQUEST|COOKIE)\s*\[/gi,
    type: 'Cross-Site Scripting (XSS)',
    severity: 'high',
    description: 'User input printed without escaping.',
    suggestion: 'Use htmlspecialchars() or a templating engine with auto-escaping.'
  },
  // File Inclusion
  {
    regex: /(include|require|include_once|require_once)\s*\(?\s*\$_(GET|POST|REQUEST)/gi,
    type: 'Local/Remote File Inclusion (LFI/RFI)',
    severity: 'critical',
    description: 'File inclusion using user-controlled input.',
    suggestion: 'Use a whitelist of allowed files instead of dynamic inclusion.'
  },
  // Command Injection
  {
    regex: /(exec|system|passthru|shell_exec|popen|proc_open)\s*\(.*?\$_(GET|POST|REQUEST)/gi,
    type: 'Command Injection',
    severity: 'critical',
    description: 'System command execution with user-controlled input.',
    suggestion: 'Avoid passing user input to shell commands. Use escapeshellarg() if unavoidable.'
  },
  // Hardcoded Credentials
  {
    regex: /(password|passwd|pwd|secret|api_key|apikey)\s*=\s*['"][^'"]{3,}['"]/gi,
    type: 'Hardcoded Credentials',
    severity: 'high',
    description: 'Credentials or secrets are hardcoded in source code.',
    suggestion: 'Use environment variables or a secure config file outside the web root.'
  },
  // Weak Hashing
  {
    regex: /\b(md5|sha1)\s*\(\s*\$/gi,
    type: 'Weak Hashing',
    severity: 'medium',
    description: 'Using MD5 or SHA1 for hashing — cryptographically weak.',
    suggestion: 'Use password_hash() and password_verify() for passwords. Use hash("sha256", ...) for other needs.'
  },
  // Unrestricted File Upload
  {
    regex: /move_uploaded_file\s*\(/gi,
    type: 'Unrestricted File Upload',
    severity: 'medium',
    description: 'File upload detected. Ensure proper validation of file type and size.',
    suggestion: 'Validate MIME type, extension, and file size. Store uploads outside web root.'
  },
  // Open Redirect
  {
    regex: /header\s*\(\s*['"]Location:\s*['"]?\s*\.\s*\$_(GET|POST|REQUEST)/gi,
    type: 'Open Redirect',
    severity: 'medium',
    description: 'Redirect URL controlled by user input.',
    suggestion: 'Validate redirect URLs against a whitelist of allowed domains.'
  },
  // Debug/Error Display
  {
    regex: /display_errors\s*=\s*(On|1|true)/gi,
    type: 'Information Disclosure',
    severity: 'low',
    description: 'PHP errors displayed to users — may leak sensitive information.',
    suggestion: 'Set display_errors = Off in production. Log errors to a file instead.'
  },
  // eval() usage
  {
    regex: /\beval\s*\(\s*\$/gi,
    type: 'Code Injection',
    severity: 'critical',
    description: 'eval() with dynamic input is extremely dangerous.',
    suggestion: 'Avoid eval() entirely. Use safer alternatives like json_decode() or specific parsers.'
  },
  // Unserialize
  {
    regex: /\bunserialize\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/gi,
    type: 'PHP Object Injection',
    severity: 'critical',
    description: 'Unserializing user input can lead to arbitrary code execution.',
    suggestion: 'Use json_decode() instead of unserialize() for user input.'
  },
  // CSRF Missing
  {
    regex: /<form[^>]*method\s*=\s*['"]post['"]/gi,
    type: 'Potential CSRF',
    severity: 'low',
    description: 'POST form detected without apparent CSRF token.',
    suggestion: 'Add CSRF token validation to all POST forms.'
  }
];

export class SecurityScanner {

  /**
   * Scan a directory or a single file for security vulnerabilities.
   */
  public scanPath(targetPath: string): ScanResult {
    const result: ScanResult = {
      totalFiles: 0,
      scannedFiles: 0,
      issues: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0 }
    };

    if (!fs.existsSync(targetPath)) {
      logger.error(`Security scan target not found: ${targetPath}`);
      return result;
    }

    // 1. Env & Database Weak Password Check
    const envPath = path.join(targetPath, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Parse DB_PASSWORD
        const dbPassMatch = envContent.match(/^DB_PASSWORD=(.*)$/m);
        if (dbPassMatch) {
          let pwd = dbPassMatch[1].trim().replace(/^['"](.*)['"]$/, '$1');
          const weakPasswords = ['', 'root', 'password', '123456', '12345678', 'admin'];
          if (weakPasswords.includes(pwd.toLowerCase())) {
            result.issues.push({
              file: '.env',
              line: 1,
              severity: 'critical',
              type: 'Weak Database Password',
              description: 'Password database menggunakan kata sandi lemah atau default (misal: kosong, root).',
              suggestion: 'Gunakan kata sandi database yang lebih kuat meskipun di lokal, untuk membiasakan praktik keamanan.'
            });
          }
        } else {
            result.issues.push({
              file: '.env',
              line: 1,
              severity: 'critical',
              type: 'Weak Database Password',
              description: 'DB_PASSWORD tidak ditemukan. Password kemungkinan kosong (default).',
              suggestion: 'Tambahkan dan gunakan DB_PASSWORD yang kuat.'
            });
        }

        // Parse APP_DEBUG
        const appDebugMatch = envContent.match(/^APP_DEBUG=(.*)$/m);
        if (appDebugMatch) {
          let debugVal = appDebugMatch[1].trim().toLowerCase();
          if (debugVal === 'true' || debugVal === '1') {
            result.issues.push({
              file: '.env',
              line: 1,
              severity: 'medium',
              type: 'Debug Mode Enabled',
              description: 'APP_DEBUG aktif (true).',
              suggestion: 'Di environment production, set APP_DEBUG=false agar tidak membocorkan error/informasi sensitif.'
            });
          }
        }
      } catch (e) {}
    }

    // Check if .env is exposed publicly (by checking nginx rules or HTTP, but we'll do HTTP)
    // We can't do HTTP easily here without project name, so we just add a suggestion about .env exposure.
    result.issues.push({
      file: '.env (Firewall)',
      line: 0,
      severity: 'high',
      type: 'Exposed .env Verification',
      description: 'Pastikan file .env diblokir oleh Nginx/Apache. Sabila secara default memblokir ini.',
      suggestion: 'Jangan letakkan .env di dalam folder public/.'
    });

    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
      result.totalFiles = 1;
      this.scanFile(targetPath, result);
    } else if (stat.isDirectory()) {
      this.scanDirectory(targetPath, result);
    }

    // Count summary
    for (const issue of result.issues) {
      result.summary[issue.severity]++;
    }

    logger.info(`Security scan complete: ${result.scannedFiles}/${result.totalFiles} files, ${result.issues.length} issues found.`);
    return result;
  }

  private scanDirectory(dirPath: string, result: ScanResult, depth = 0): void {
    if (depth > 10) return; // Prevent infinite recursion

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip common non-essential directories
        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', 'vendor', '.git', '.svn', 'storage', 'cache', 'tmp'];
          if (skipDirs.includes(entry.name)) continue;
          this.scanDirectory(fullPath, result, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.php', '.inc', '.phtml', '.php3', '.php4', '.php5', '.php7', '.php8'].includes(ext)) {
            result.totalFiles++;
            this.scanFile(fullPath, result);
          }
        }
      }
    } catch (err: any) {
      logger.error(`Error scanning directory ${dirPath}: ${err.message}`);
    }
  }

  private scanFile(filePath: string, result: ScanResult): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      result.scannedFiles++;

      for (const pattern of PATTERNS) {
        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(lines[i])) {
            result.issues.push({
              file: filePath,
              line: i + 1,
              severity: pattern.severity,
              type: pattern.type,
              description: pattern.description,
              suggestion: pattern.suggestion
            });
          }
        }
      }
    } catch (err: any) {
      logger.error(`Error scanning file ${filePath}: ${err.message}`);
    }
  }
}

export const securityScanner = new SecurityScanner();
