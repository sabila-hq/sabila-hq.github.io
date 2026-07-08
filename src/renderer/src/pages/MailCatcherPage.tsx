import React, { useState, useEffect } from 'react';
import { Mail, Play, Square, Trash2, RefreshCw, Eye, ChevronLeft, Copy, Check, Inbox, Info, X } from 'lucide-react';
import { translations } from '../translations';

interface MailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  html: string;
  date: string;
  headers: Record<string, string>;
}

export const MailCatcherPage: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [isRunning, setIsRunning] = useState(false);
  const [port, setPort] = useState(2525);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'html' | 'headers'>('text');
  const [copiedId, setCopiedId] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    checkStatus();
    loadMessages();

    // @ts-ignore
    if (window.api.onMailReceived) {
      // @ts-ignore
      const removeListener = window.api.onMailReceived((mail: MailMessage) => {
        setMessages(prev => [mail, ...prev]);
      });
      return () => removeListener();
    }
  }, []);

  const checkStatus = async () => {
    try {
      // @ts-ignore
      const status = await window.api.mailStatus();
      setIsRunning(status.running);
      setPort(status.port);
    } catch { /* ignore */ }
  };

  const loadMessages = async () => {
    try {
      // @ts-ignore
      const msgs = await window.api.mailList();
      setMessages(msgs);
    } catch { /* ignore */ }
  };

  const handleToggleServer = async () => {
    try {
      if (isRunning) {
        // @ts-ignore
        await window.api.mailStop();
      } else {
        // @ts-ignore
        await window.api.mailStart();
      }
      await checkStatus();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteMail = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      // @ts-ignore
      await window.api.mailDelete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMail?.id === id) setSelectedMail(null);
    } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    const msg = lang === 'id' ? 'Hapus semua email yang tertangkap?' : 'Clear all caught emails?';
    if (!window.confirm(msg)) return;
    try {
      // @ts-ignore
      await window.api.mailClear();
      setMessages([]);
      setSelectedMail(null);
    } catch { /* ignore */ }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div className={embedded ? "" : "page-container"} style={embedded ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
      {!embedded && (
        <div className="page-header" style={{ flexShrink: 0 }}>
          <h1>📧 {t.mail_catcher}</h1>
          <p>{t.mail_catcher_desc}</p>
        </div>
      )}

      {/* Status Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.75rem 1.25rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: isRunning ? 'var(--status-running)' : 'var(--status-stopped)',
            boxShadow: isRunning ? '0 0 10px var(--status-running)' : 'none'
          }} />
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.mail_server_status}</span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {isRunning ? `✅ Running on port ${port}` : '⏸️ Stopped'}
              <span style={{ marginLeft: '0.75rem', opacity: 0.6 }}>
                ({messages.length} {lang === 'id' ? 'email tertangkap' : 'emails caught'})
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={isRunning ? 'btn-secondary' : 'btn-primary'}
            onClick={handleToggleServer}
            style={{
              padding: '0.4rem 0.9rem', fontSize: '0.82rem',
              color: isRunning ? 'var(--status-stopped)' : undefined
            }}
          >
            {isRunning ? <><Square size={14} /> {t.stop}</> : <><Play size={14} /> {t.start}</>}
          </button>
          <button className="btn-secondary" onClick={loadMessages} style={{ padding: '0.4rem 0.6rem' }}>
            <RefreshCw size={14} />
          </button>
          {messages.length > 0 && (
            <button className="btn-secondary" onClick={handleClearAll} style={{ padding: '0.4rem 0.6rem', color: '#ef4444' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Config hint */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.5rem 1rem', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💡 {t.mail_config_hint}
        </div>
        <button className="btn-secondary" onClick={() => setShowInfo(true)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}>
          <Info size={14} />
          {t.mail_config_btn}
        </button>
      </div>

      {/* Mail list + detail */}
      <div style={{ flex: 1, display: 'flex', gap: '1rem', overflow: 'hidden', minHeight: 0 }}>
        {/* Mail List */}
        <div className="glass-panel" style={{
          width: selectedMail ? '340px' : '100%',
          flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width 0.3s ease'
        }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '1rem' }}>
              <Inbox size={48} style={{ opacity: 0.2 }} />
              <p style={{ margin: 0 }}>{t.mail_no_messages}</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {messages.map((mail) => (
                <div
                  key={mail.id}
                  onClick={() => setSelectedMail(mail)}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--glass-border)',
                    background: selectedMail?.id === mail.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    transition: 'background 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { if (selectedMail?.id !== mail.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (selectedMail?.id !== mail.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {mail.subject}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatDate(mail.date)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mail.from} → {mail.to.join(', ')}
                  </div>
                  <button
                    onClick={(e) => handleDeleteMail(mail.id, e)}
                    style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      background: 'none', border: 'none', cursor: 'pointer', opacity: 0.3, color: 'var(--text-secondary)', padding: '2px'
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.3'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mail Detail */}
        {selectedMail && (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Detail Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button className="btn-secondary" onClick={() => setSelectedMail(null)} style={{ padding: '0.3rem 0.5rem' }}>
                  <ChevronLeft size={14} />
                </button>
                <h3 style={{ margin: 0, fontSize: '1rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedMail.subject}
                </h3>
                <button
                  className="btn-secondary"
                  onClick={() => handleCopy(selectedMail.body || selectedMail.html, selectedMail.id)}
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                >
                  {copiedId === selectedMail.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.3rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.mail_from}:</span>
                <span>{selectedMail.from}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.mail_to}:</span>
                <span>{selectedMail.to.join(', ')}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.mail_date}:</span>
                <span>{formatDate(selectedMail.date)}</span>
              </div>
            </div>

            {/* View mode tabs */}
            <div style={{ display: 'flex', gap: '0.3rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              {(['text', 'html', 'headers'] as const).map(mode => (
                <button
                  key={mode}
                  className={viewMode === mode ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setViewMode(mode)}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', textTransform: 'capitalize' }}
                >
                  {mode === 'text' ? '📄 Text' : mode === 'html' ? '🌐 HTML' : '📋 Headers'}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', scrollbarWidth: 'thin' }}>
              {viewMode === 'text' && (
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedMail.body || '(No text body)'}
                </pre>
              )}
              {viewMode === 'html' && (
                selectedMail.html ? (
                  <div
                    style={{ background: 'white', borderRadius: '8px', padding: '1rem', color: '#333' }}
                    dangerouslySetInnerHTML={{ __html: selectedMail.html }}
                  />
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>(No HTML body)</p>
                )
              )}
              {viewMode === 'headers' && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem' }}>
                  {Object.entries(selectedMail.headers).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '0.2rem 0' }}>
                      <span style={{ color: 'var(--brand-blue)', fontWeight: 600 }}>{key}:</span>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showInfo && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel slide-down" style={{ width: '90%', maxWidth: '500px', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={18} color="var(--brand-blue)" />
                {t.mail_config_title}
              </h3>
              <button className="btn-secondary" onClick={() => setShowInfo(false)} style={{ padding: '0.2rem' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {t.mail_config_p1}
            </p>
            <div style={{ background: '#1e1e1e', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#d4d4d4', overflowX: 'auto', marginBottom: '1rem' }}>
              <span style={{ color: '#569cd6' }}>MAIL_MAILER</span>=smtp<br />
              <span style={{ color: '#569cd6' }}>MAIL_HOST</span>=127.0.0.1<br />
              <span style={{ color: '#569cd6' }}>MAIL_PORT</span>={port}<br />
              <span style={{ color: '#569cd6' }}>MAIL_USERNAME</span>=null<br />
              <span style={{ color: '#569cd6' }}>MAIL_PASSWORD</span>=null<br />
              <span style={{ color: '#569cd6' }}>MAIL_ENCRYPTION</span>=null<br />
              <span style={{ color: '#569cd6' }}>MAIL_FROM_ADDRESS</span>="hello@example.com"<br />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {t.mail_config_p2}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
