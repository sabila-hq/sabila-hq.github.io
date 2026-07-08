import React, { useState, useEffect } from 'react';
import { Globe, Copy, Check, ExternalLink, Loader2, X, Wifi, WifiOff, QrCode } from 'lucide-react';
import { translations } from '../translations';
import { QRCodeSVG } from 'qrcode.react';

interface TunnelInfo {
  projectName: string;
  localPort: number;
  publicUrl: string;
  status: 'connecting' | 'active' | 'error' | 'stopped';
  startedAt?: string;
  error?: string;
}

export const ShareTunnel: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [projectName, setProjectName] = useState('');
  const [localPort, setLocalPort] = useState(80);
  const [subdomain, setSubdomain] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');
  const [qrModal, setQrModal] = useState<{open: boolean, url: string, projectName: string} | null>(null);

  useEffect(() => {
    loadTunnels();
    const interval = setInterval(loadTunnels, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTunnels = async () => {
    try {
      // @ts-ignore
      const list = await window.api.tunnelList();
      setTunnels(list);
    } catch { /* ignore */ }
  };

  const handleStart = async () => {
    if (!projectName.trim()) return;
    setIsStarting(true);
    try {
      // @ts-ignore
      const result = await window.api.tunnelStart(projectName.trim(), localPort, subdomain || undefined);
      if (result.status === 'active') {
        setProjectName('');
        setSubdomain('');
      }
      await loadTunnels();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async (name: string) => {
    try {
      // @ts-ignore
      await window.api.tunnelStop(name);
      await loadTunnels();
    } catch { /* ignore */ }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  return (
    <div className={embedded ? "" : "page-container scrollable"}>
      {!embedded && (
        <div className="page-header">
          <h1>🌍 {t.share}</h1>
          <p>{t.share_desc}</p>
        </div>
      )}

      {/* New Tunnel Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={18} color="var(--brand-blue)" /> {t.share_start}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              {t.share_project_name}
            </label>
            <input
              className="input-glass"
              placeholder="my-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              {t.share_local_port}
            </label>
            <input
              className="input-glass"
              type="number"
              value={localPort}
              onChange={(e) => setLocalPort(parseInt(e.target.value) || 80)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              {t.share_subdomain}
            </label>
            <input
              className="input-glass"
              placeholder="myapp"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleStart}
          disabled={isStarting || !projectName.trim()}
          style={{ padding: '0.65rem 1.5rem' }}
        >
          {isStarting ? (
            <><Loader2 size={16} className="spin-animation" /> {t.share_connecting}</>
          ) : (
            <><Globe size={16} /> {t.share_start}</>
          )}
        </button>

        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          💡 {lang === 'id' 
            ? 'Pastikan Nginx atau Apache sudah berjalan di port yang dipilih sebelum membuat tunnel.' 
            : 'Make sure Nginx or Apache is running on the selected port before creating a tunnel.'}
        </div>
      </div>

      {/* Active Tunnels */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wifi size={18} color="var(--status-running)" /> {t.share_active}
        </h3>

        {tunnels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <WifiOff size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>{t.share_no_active}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tunnels.map((tunnel) => (
              <div
                key={tunnel.projectName}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderLeft: `3px solid ${
                    tunnel.status === 'active' ? 'var(--status-running)' :
                    tunnel.status === 'connecting' ? '#f59e0b' :
                    tunnel.status === 'error' ? 'var(--status-stopped)' : 'var(--glass-border)'
                  }`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: tunnel.status === 'active' ? 'var(--status-running)' : 
                                   tunnel.status === 'connecting' ? '#f59e0b' : 'var(--status-stopped)',
                      boxShadow: tunnel.status === 'active' ? '0 0 8px var(--status-running)' : 'none',
                      animation: tunnel.status === 'connecting' ? 'pulse 1.5s ease infinite' : 'none'
                    }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{tunnel.projectName}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                      :{tunnel.localPort}
                    </span>
                  </div>
                  {tunnel.publicUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <code style={{ 
                        fontSize: '0.82rem', color: 'var(--brand-blue)', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        padding: '0.2rem 0.6rem', borderRadius: '4px' 
                      }}>
                        {tunnel.publicUrl}
                      </code>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleCopy(tunnel.publicUrl)}
                      >
                        {copiedUrl === tunnel.publicUrl ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        title="Tampilkan QR Code"
                        onClick={() => setQrModal({ open: true, url: tunnel.publicUrl, projectName: tunnel.projectName })}
                      >
                        <QrCode size={12} />
                      </button>
                      <a
                        href={tunnel.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--brand-purple)', cursor: 'pointer', marginLeft: '0.25rem' }}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                  {tunnel.error && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--status-stopped)' }}>❌ {tunnel.error}</span>
                  )}
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => handleStop(tunnel.projectName)}
                  style={{ color: 'var(--status-stopped)', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                >
                  <X size={14} /> {t.share_stop}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* QR Code Modal */}
      {qrModal?.open && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Scan QR Code 📱</h3>
              <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setQrModal(null)}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Akses proyek <strong>{qrModal.projectName}</strong> dari perangkat lain dengan memindai kode ini.
            </p>

            <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem' }}>
              <QRCodeSVG value={qrModal.url} size={200} />
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              {qrModal.url}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={() => {
                  navigator.clipboard.writeText(qrModal.url);
                  setCopiedUrl(qrModal.url);
                  setTimeout(() => setCopiedUrl(''), 2000);
                }}
              >
                {copiedUrl === qrModal.url ? <Check size={16} /> : <Copy size={16} />} Salin URL
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setQrModal(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
