import net from 'net';
import { logger } from './logger';
import { BrowserWindow, Notification } from 'electron';
import { store } from './store';
import nodemailer from 'nodemailer';

export interface MailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  html: string;
  date: string;
  headers: Record<string, string>;
}

/**
 * A minimal SMTP server that catches all outgoing emails from local PHP/Node apps.
 * Acts as a local mail trap similar to MailHog/Mailtrap.
 * 
 * Configure PHP to use this as SMTP:
 *   php.ini: SMTP=localhost, smtp_port=2525
 * 
 * Or for Node.js (nodemailer):
 *   host: 'localhost', port: 2525
 */
export class MailCatcher {
  private server: net.Server | null = null;
  private messages: MailMessage[] = [];
  private port: number;
  private maxMessages: number;

  constructor(port: number = 2525, maxMessages: number = 500) {
    this.port = port;
    this.maxMessages = maxMessages;
  }

  public start(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.server) {
        resolve(true);
        return;
      }

      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err: any) => {
        logger.error(`MailCatcher server error: ${err.message}`);
        if (err.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is in use. Try a different port.`);
        }
        resolve(false);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        logger.info(`📧 MailCatcher started on port ${this.port}`);
        resolve(true);
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('📧 MailCatcher stopped.');
    }
  }

  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  public getPort(): number {
    return this.port;
  }

  public getMessages(): MailMessage[] {
    return [...this.messages].reverse(); // newest first
  }

  public getMessage(id: string): MailMessage | undefined {
    return this.messages.find(m => m.id === id);
  }

  public deleteMessage(id: string): boolean {
    const idx = this.messages.findIndex(m => m.id === id);
    if (idx > -1) {
      this.messages.splice(idx, 1);
      return true;
    }
    return false;
  }

  public clearAll(): void {
    this.messages = [];
    logger.info('📧 All caught emails cleared.');
  }

  private handleConnection(socket: net.Socket): void {
    let state: 'GREETING' | 'COMMAND' | 'DATA' = 'GREETING';
    let currentMail: Partial<MailMessage> = {};
    let dataBuffer = '';
    let from = '';
    let to: string[] = [];

    // Send SMTP greeting
    socket.write('220 Sabila MailCatcher ESMTP\r\n');
    state = 'COMMAND';

    socket.on('data', (data) => {
      const input = data.toString();

      if (state === 'DATA') {
        dataBuffer += input;

        // Check for end of data marker
        if (dataBuffer.includes('\r\n.\r\n')) {
          const rawData = dataBuffer.split('\r\n.\r\n')[0];
          this.processMessage(from, to, rawData);
          dataBuffer = '';
          state = 'COMMAND';
          socket.write('250 OK: Message queued\r\n');
          return;
        }
        return;
      }

      // Handle SMTP commands
      const lines = input.split('\r\n').filter(l => l.trim());
      for (const line of lines) {
        const cmd = line.toUpperCase();

        if (cmd.startsWith('HELO') || cmd.startsWith('EHLO')) {
          socket.write('250-Sabila MailCatcher\r\n250-SIZE 10485760\r\n250 OK\r\n');
        } else if (cmd.startsWith('MAIL FROM:')) {
          from = this.extractEmail(line);
          socket.write('250 OK\r\n');
        } else if (cmd.startsWith('RCPT TO:')) {
          to.push(this.extractEmail(line));
          socket.write('250 OK\r\n');
        } else if (cmd === 'DATA') {
          state = 'DATA';
          dataBuffer = '';
          socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
        } else if (cmd === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else if (cmd === 'RSET') {
          from = '';
          to = [];
          currentMail = {};
          socket.write('250 OK\r\n');
        } else if (cmd === 'NOOP') {
          socket.write('250 OK\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });

    socket.on('error', (err) => {
      // Client disconnected, ignore
    });
  }

  private extractEmail(line: string): string {
    const match = line.match(/<([^>]+)>/);
    if (match) return match[1];
    // Fallback: extract after the colon
    const parts = line.split(':');
    if (parts.length > 1) return parts.slice(1).join(':').trim();
    return line;
  }

  private processMessage(from: string, to: string[], rawData: string): void {
    // Parse headers and body
    const headerEndIdx = rawData.indexOf('\r\n\r\n');
    const headersRaw = headerEndIdx > -1 ? rawData.substring(0, headerEndIdx) : rawData;
    const body = headerEndIdx > -1 ? rawData.substring(headerEndIdx + 4) : '';

    const headers: Record<string, string> = {};
    const headerLines = headersRaw.split('\r\n');
    let currentKey = '';
    for (const hl of headerLines) {
      if (hl.startsWith(' ') || hl.startsWith('\t')) {
        // Continuation of previous header
        if (currentKey) headers[currentKey] += ' ' + hl.trim();
      } else {
        const colonIdx = hl.indexOf(':');
        if (colonIdx > -1) {
          currentKey = hl.substring(0, colonIdx).trim();
          headers[currentKey] = hl.substring(colonIdx + 1).trim();
        }
      }
    }

    const subject = headers['Subject'] || headers['subject'] || '(No Subject)';
    
    // Check if body is HTML
    const contentType = headers['Content-Type'] || headers['content-type'] || '';
    const isHtml = contentType.includes('text/html') || body.includes('<html') || body.includes('<HTML');

    const message: MailMessage = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      from: headers['From'] || headers['from'] || from,
      to: to,
      subject,
      body: isHtml ? '' : body,
      html: isHtml ? body : '',
      date: headers['Date'] || headers['date'] || new Date().toISOString(),
      headers
    };

    this.messages.push(message);
    
    // Trim to max messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    logger.info(`📧 Mail caught: "${subject}" from ${from} to ${to.join(', ')}`);

    // Desktop Notification for Mail Catcher
    if (Notification.isSupported()) {
      new Notification({ 
        title: `📧 New Mail: ${subject}`, 
        body: `From: ${from}\nTo: ${to.join(', ')}` 
      }).show();
    }

    // Check if Mail Sender is enabled
    const mailSender = store.get('mailSender') as any;
    if (mailSender && mailSender.enabled && mailSender.gmailAccount && mailSender.gmailPassword) {
      this.relayEmail(message, mailSender.gmailAccount, mailSender.gmailPassword);
    }

    // Notify renderer
    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('mail-received', message);
        }
      });
    } catch (e) { /* ignore */ }
  }

  private async relayEmail(message: MailMessage, user: string, pass: string): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
      
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
        html: message.html,
      });
      logger.info(`📧 Mail relayed successfully to ${message.to.join(', ')} via Gmail`);
      
      if (Notification.isSupported()) {
        new Notification({ title: `📧 Mail Sent Successfully`, body: `Relayed to ${message.to.join(', ')}` }).show();
      }
    } catch (err: any) {
      logger.error(`❌ Mail relay failed: ${err.message}`);
      if (Notification.isSupported()) {
        new Notification({ title: `❌ Mail Relay Failed`, body: err.message }).show();
      }
    }
  }
}

export const mailCatcher = new MailCatcher(2525);
