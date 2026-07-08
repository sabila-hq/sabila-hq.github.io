import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { logger } from './logger';

let db: Database.Database;

export interface ChatConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  tool_call_id?: string;
  tool_calls?: string; // JSON stringified
  created_at: string;
}

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'chat_history.db');
    logger.info(`Opening chat database at: ${dbPath}`);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT DEFAULT '',
      tool_call_id TEXT,
      tool_calls TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);
}

// --- Conversation CRUD ---

export function createConversation(title: string = 'New Chat'): ChatConversation {
  const stmt = getDb().prepare('INSERT INTO conversations (title) VALUES (?)');
  const result = stmt.run(title);
  return getConversation(result.lastInsertRowid as number)!;
}

export function getConversation(id: number): ChatConversation | undefined {
  return getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ChatConversation | undefined;
}

export function listConversations(): ChatConversation[] {
  return getDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as ChatConversation[];
}

export function updateConversationTitle(id: number, title: string): void {
  getDb().prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function deleteConversation(id: number): void {
  getDb().prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// --- Message CRUD ---

export function addMessage(conversationId: number, role: string, content: string, toolCallId?: string, toolCalls?: any): ChatMessage {
  const stmt = getDb().prepare(
    'INSERT INTO messages (conversation_id, role, content, tool_call_id, tool_calls) VALUES (?, ?, ?, ?, ?)'
  );
  const toolCallsStr = toolCalls ? JSON.stringify(toolCalls) : null;
  const result = stmt.run(conversationId, role, content || '', toolCallId || null, toolCallsStr);
  // Touch conversation updated_at
  getDb().prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid as number) as ChatMessage;
}

export function getMessages(conversationId: number): ChatMessage[] {
  return getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(conversationId) as ChatMessage[];
}

export function getMessagesForApi(conversationId: number): any[] {
  const messages = getMessages(conversationId);
  return messages.map(m => {
    const msg: any = { role: m.role, content: m.content };
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (m.tool_calls) {
      try {
        msg.tool_calls = JSON.parse(m.tool_calls);
      } catch { /* ignore */ }
    }
    // tool role messages need a name field too
    if (m.role === 'tool' && m.tool_call_id) {
      // We don't store function name separately, but the API usually doesn't require it
    }
    return msg;
  });
}

export function clearMessages(conversationId: number): void {
  getDb().prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
}
