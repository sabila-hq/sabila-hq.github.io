import React, { useState, useEffect, useRef } from 'react';
import { FileText, Eye, EyeOff, Trash2, Bot, AlertTriangle, Info, AlertCircle, RotateCw, ArrowUpDown } from 'lucide-react';
import { translations } from '../translations';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  line: number;
}

interface LogFileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  exists: boolean;
}

const getLevelColor = (level: string) => {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'debug': return '#8b5cf6';
    default: return 'var(--text-secondary)';
  }
};

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'error': return <AlertCircle size={12} color="#ef4444" />;
    case 'warn': return <AlertTriangle size={12} color="#f59e0b" />;
    default: return <Info size={12} style={{ opacity: 0.4 }} />;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatLogTime = (ts: string) => {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('id-ID', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
};

export const LogViewerPage: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sysSpecs, setSysSpecs] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogFiles();
    // @ts-ignore
    window.api.getSystemSpecs().then(specs => setSysSpecs(specs));
  }, []);

  useEffect(() => {
    // Listen for real-time log updates
    // @ts-ignore
    if (window.api.onLogViewerUpdate) {
      // @ts-ignore
      const removeListener = window.api.onLogViewerUpdate((data: any) => {
        if (data.logId === selectedLog && data.entries) {
          setEntries(prev => [...prev, ...data.entries].slice(-500));
        }
      });
      return () => removeListener();
    }
  }, [selectedLog]);

  useEffect(() => {
    // Auto-scroll when new entries appear
    if (logEndRef.current && isWatching) {
      const container = logEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [entries]);

  const loadLogFiles = async () => {
    try {
      // @ts-ignore
      const files = await window.api.logGetFiles();
      setLogFiles(files);
    } catch { /* ignore */ }
  };

  const handleSelectLog = async (logId: string) => {
    // Stop watching previous log
    if (selectedLog && isWatching) {
      // @ts-ignore
      await window.api.logStopWatching(selectedLog);
    }

    setSelectedLog(logId);
    setIsWatching(false);
    setEntries([]);

    try {
      // @ts-ignore
      const logEntries = await window.api.logReadTail(logId, 200);
      setEntries(logEntries);
    } catch { /* ignore */ }
  };

  const toggleWatching = async () => {
    if (!selectedLog) return;
    
    if (isWatching) {
      // @ts-ignore
      await window.api.logStopWatching(selectedLog);
      setIsWatching(false);
    } else {
      // @ts-ignore
      const ok = await window.api.logStartWatching(selectedLog);
      setIsWatching(ok);
    }
  };

  const handleClearLog = async () => {
    if (!selectedLog) return;
    const msg = lang === 'id' ? 'Hapus semua isi log ini?' : 'Clear all contents of this log?';
    if (!window.confirm(msg)) return;
    
    // @ts-ignore
    await window.api.logClear(selectedLog);
    setEntries([]);
  };

  const handleRefresh = async () => {
    if (!selectedLog) return;
    try {
      // @ts-ignore
      const logEntries = await window.api.logReadTail(selectedLog, 200);
      setEntries(logEntries);
    } catch { /* ignore */ }
  };

  const filteredEntries = entries.filter(e => {
    if (filterLevel !== 'all' && e.level !== filterLevel) return false;
    if (searchTerm && !e.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const displayEntries = sortOrder === 'asc' ? filteredEntries : [...filteredEntries].reverse();

  const errorCount = entries.filter(e => e.level === 'error').length;
  const warnCount = entries.filter(e => e.level === 'warn').length;

  return (
    <div className={embedded ? "" : "page-container"} style={embedded ? { display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 } : {}}>
      {!embedded && (
        <div className="page-header" style={{ flexShrink: 0 }}>
          <h1>📝 {t.log_viewer}</h1>
          <p>{t.log_viewer_desc}</p>
        </div>
      )}

      {sysSpecs && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sistem Operasi</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sysSpecs.platform} {sysSpecs.release} ({sysSpecs.arch})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prosesor (CPU)</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sysSpecs.model} ({sysSpecs.cpus} Cores)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Memori (RAM)</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sysSpecs.ram} GB</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: '1rem', overflow: 'hidden', minHeight: 0 }}>
        {/* Log File List */}
        <div className="glass-panel" style={{ width: '250px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <FileText size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Log Files
            </h4>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', scrollbarWidth: 'thin' }}>
            {logFiles.filter(f => f.exists).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>
                {t.log_no_files}
              </p>
            ) : (
              logFiles.filter(f => f.exists).map(log => (
                <div
                  key={log.id}
                  onClick={() => handleSelectLog(log.id)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedLog === log.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: selectedLog === log.id ? '1px solid var(--brand-blue)' : '1px solid transparent',
                    marginBottom: '0.3rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (selectedLog !== log.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (selectedLog !== log.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: selectedLog === log.id ? 600 : 400, marginBottom: '0.15rem' }}>
                    {log.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {formatBytes(log.size)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Log Content */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedLog ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>{lang === 'id' ? 'Pilih log file dari panel kiri' : 'Select a log file from the left panel'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{
                padding: '0.6rem 1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--glass-border)', flexShrink: 0,
                background: 'rgba(0,0,0,0.15)', gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className={isWatching ? 'btn-primary' : 'btn-secondary'}
                    onClick={toggleWatching}
                    title={isWatching ? (lang === 'id' ? 'Hentikan Live Watch' : 'Stop Live Watch') : (lang === 'id' ? 'Mulai Live Watch' : 'Start Live Watch')}
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                  >
                    {isWatching ? <><EyeOff size={13} /> Stop</> : <><Eye size={13} /> Watch</>}
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={handleRefresh} 
                    title={lang === 'id' ? 'Muat Ulang Log' : 'Refresh Logs'}
                    style={{ padding: '0.3rem 0.6rem' }}
                  >
                    <RotateCw size={13} />
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                    title={lang === 'id' ? (sortOrder === 'asc' ? 'Urutkan: Terbaru di Atas' : 'Urutkan: Terbaru di Bawah') : (sortOrder === 'asc' ? 'Sort: Newest at Top' : 'Sort: Newest at Bottom')} 
                    style={{ padding: '0.3rem 0.6rem' }}
                  >
                    <ArrowUpDown size={13} />
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={handleClearLog} 
                    title={lang === 'id' ? 'Bersihkan Log' : 'Clear Logs'}
                    style={{ padding: '0.3rem 0.6rem', color: '#ef4444' }}
                  >
                    <Trash2 size={13} />
                  </button>
                  
                  {/* Stats */}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                    {filteredEntries.length} {t.log_lines}
                    {errorCount > 0 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>⬤ {errorCount} errors</span>}
                    {warnCount > 0 && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⬤ {warnCount} warns</span>}
                  </span>
                  
                  {isWatching && (
                    <span style={{
                      fontSize: '0.72rem', color: 'var(--status-running)',
                      display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-running)', animation: 'pulse 1.5s ease infinite' }} />
                      Live
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="input-glass"
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', width: 'auto', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
                  >
                    <option value="all">All Levels</option>
                    <option value="error">❌ Errors</option>
                    <option value="warn">⚠️ Warnings</option>
                    <option value="info">ℹ️ Info</option>
                  </select>
                  {/* Search */}
                  <input
                    className="input-glass"
                    placeholder="🔍 Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', width: '180px' }}
                  />
                </div>
              </div>

              {/* Log entries */}
              <div
                ref={containerRef}
                style={{
                  flex: 1, overflowY: 'auto', padding: '0.5rem',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  fontSize: '0.78rem', lineHeight: '1.55',
                  scrollbarWidth: 'thin'
                }}
              >
                {displayEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', gap: '0.5rem', padding: '0.15rem 0.5rem',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      color: getLevelColor(entry.level),
                      alignItems: 'flex-start',
                      background: entry.level === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                      borderRadius: entry.level === 'error' ? '4px' : '0',
                    }}
                  >
                    <span 
                      style={{ flexShrink: 0, marginTop: '4px', display: 'inline-flex', alignItems: 'center' }}
                      title={`Level: ${entry.level.toUpperCase()}`}
                    >
                      {getLevelIcon(entry.level)}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                      [{formatLogTime(entry.timestamp)}]
                    </span>
                    <span style={{ flex: 1, wordBreak: 'break-all' }}>{entry.message}</span>
                    {entry.level === 'error' && (
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '1px 6px', fontSize: '0.68rem', flexShrink: 0,
                          color: 'var(--brand-purple)', borderColor: 'var(--brand-purple)',
                          opacity: 0.7
                        }}
                        title={t.log_fix_ai}
                        onClick={() => {
                          // Switch to AI Chat tab
                          window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'ai-chat' } }));
                          // Trigger AI Fix with error message
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('trigger-ai-fix', { detail: entry.message }));
                          }, 100);
                        }}
                      >
                        <Bot size={10} /> AI
                      </button>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
