import React, { useEffect, useState, useRef } from 'react';
import { Play, Square, RotateCw, Terminal, Download, PlayCircle, StopCircle, Zap, ChevronUp, ChevronDown, ExternalLink, Database, Server } from 'lucide-react';
import { translations } from '../translations';
import { ServiceMenu } from '../components/ServiceMenu';
import { ToolMenu } from '../components/ToolMenu';

const DASHBOARD_DOWNLOADS: Record<string, { stable: string, other: string }> = {
  nginx: {
    stable: 'https://nginx.org/download/nginx-1.31.2.zip',
    other: 'https://nginx.org/en/download.html'
  },
  apache: {
    stable: 'https://www.apachelounge.com/download/VS16/binaries/httpd-2.4.57-win64-VS16.zip',
    other: 'https://www.apachelounge.com/download/'
  },
  php: {
    stable: 'https://downloads.php.net/~windows/releases/archives/php-8.3.32-Win32-vs16-x64.zip',
    other: 'https://windows.php.net/download/'
  },
  mysql: {
    stable: 'https://dev.mysql.com/downloads/file/?id=551515',
    other: 'https://dev.mysql.com/downloads/mysql/'
  }
};

const getTimeGreeting = (lang: string): string => {
  const hour = new Date().getHours();
  
  if (lang === 'id') {
    if (hour >= 3 && hour < 6) return 'Selamat Subuh';
    if (hour >= 6 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }
  
  if (lang === 'su') {
    if (hour >= 3 && hour < 10) return 'Wilujeng Énjing';
    if (hour >= 10 && hour < 15) return 'Wilujeng Siang';
    if (hour >= 15 && hour < 18) return 'Wilujeng Sonten';
    return 'Wilujeng Wengi';
  }
  
  if (lang === 'jv') {
    if (hour >= 3 && hour < 10) return 'Sugeng Énjing';
    if (hour >= 10 && hour < 15) return 'Sugeng Siang';
    if (hour >= 15 && hour < 18) return 'Sugeng Sonten';
    return 'Sugeng Dalu';
  }
  
  if (lang === 'ar') {
    if (hour >= 3 && hour < 12) return 'صباح الخير';
    return 'مساء الخير';
  }
  
  if (lang === 'zh') {
    if (hour >= 3 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  }
  
  // Default to English
  if (hour >= 3 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const Dashboard: React.FC<{ lang?: string }> = ({ lang = 'en' }) => {
  const [services, setServices] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>(['[System] Sabila UI Started...']);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [bulkAction, setBulkAction] = useState<'idle' | 'starting' | 'stopping'>('idle');
  const [logCopied, setLogCopied] = useState(false);
  const [isLogMinimized, setIsLogMinimized] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('terminalHeight');
    return saved ? parseInt(saved) : 150;
  });
  const [isDragging, setIsDragging] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueSource, setRescueSource] = useState<'xampp' | 'laragon' | 'other' | null>(null);
  const [rescuePath, setRescuePath] = useState('');
  const [isRescuing, setIsRescuing] = useState(false);
  const [autoRescueSources, setAutoRescueSources] = useState<{name: string, path: string, type: string}[]>([]);

  const t = translations[lang as keyof typeof translations] || translations.en;

  const toolsDataRef = useRef<any[]>([]);

  const loadServices = async () => {
    // @ts-ignore
    const statuses = await window.api.getServices();
    // @ts-ignore
    const dItems = await window.api.getDashboardItems();
    
    // Fetch tools only if not fetched yet
    if (toolsDataRef.current.length === 0) {
      // @ts-ignore
      toolsDataRef.current = await window.api.getTools();
    }
    const toolsData = toolsDataRef.current;
    
    const svcArray = dItems.map((key: string) => {
      if (statuses[key]) {
        return {
          id: key,
          type: 'service',
          ...statuses[key]
        };
      } else {
        const toolInfo = toolsData.find((t: any) => t.id === key);
        if (toolInfo) {
          return {
            id: key,
            type: 'tool',
            name: toolInfo.name,
            status: toolInfo.isInstalled ? 'installed' : 'not_installed',
            isInstalled: toolInfo.isInstalled,
            activeVersion: toolInfo.activeVersion || (toolInfo.version === '-' ? undefined : toolInfo.version),
            path: toolInfo.path,
            port: null
          };
        }
      }
      return null;
    }).filter(Boolean);

    setServices(svcArray);
    setInitialLoading(false);
  };

  useEffect(() => {
    loadServices();
    const interval = setInterval(loadServices, 5000);
    


    let removeLogListener = () => {};
    // @ts-ignore
    if (window.api.onLogMessage) {
      // @ts-ignore
      removeLogListener = window.api.onLogMessage((msg: string) => {
        setLogs(prev => [...prev, msg].slice(-200));
      });
    }

    let removeDownloadListener = () => {};
    // @ts-ignore
    if (window.api.onDownloadProgress) {
      // @ts-ignore
      removeDownloadListener = window.api.onDownloadProgress((data: { serviceId: string, percent: number }) => {
        setDownloadProgress(prev => ({ ...prev, [data.serviceId]: data.percent }));
      });
    }

    return () => {
      clearInterval(interval);
      removeLogListener();
      removeDownloadListener();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      const container = logEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs]);

  // Terminal drag resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setTerminalHeight(prev => {
        let newH = prev - e.movementY;
        if (newH < 50) newH = 50;
        if (newH > window.innerHeight * 0.7) newH = window.innerHeight * 0.7;
        localStorage.setItem('terminalHeight', newH.toString());
        return newH;
      });
    };
    
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const [portConflictModal, setPortConflictModal] = useState<{ show: boolean, serviceId: string, port: number } | null>(null);

  const handleStart = async (id: string) => {
    const svc = services.find(s => s.id === id);
    // @ts-ignore
    const res = await window.api.startService(id);
    if (res && res.success === false) {
      if (res.error.toLowerCase().includes('in use') || res.error.includes('EADDRINUSE')) {
        setPortConflictModal({ show: true, serviceId: id, port: svc ? svc.port : 0 });
      } else {
        alert(`Gagal menjalankan ${id}: ${res.error}`);
      }
    }
    loadServices();
  };

  const handleForceStop = async () => {
    if (!portConflictModal) return;
    try {
      // @ts-ignore
      const res = await window.api.killProcessOnPort(portConflictModal.port);
      if (res.success) {
        alert('Proses berhasil dihentikan. Memulai ulang layanan...');
        handleStart(portConflictModal.serviceId);
        setPortConflictModal(null);
      } else {
        alert(`Gagal mematikan proses: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAutoPort = async () => {
    if (!portConflictModal) return;
    try {
      // @ts-ignore
      const newPort = await window.api.findAvailablePort(portConflictModal.port + 1);
      // @ts-ignore
      const res = await window.api.setServicePort(portConflictModal.serviceId, newPort);
      if (res.success !== false) {
        alert(`Port diubah otomatis ke ${newPort}.`);
        setPortConflictModal(null);
        handleStart(portConflictModal.serviceId);
      } else {
        alert(`Gagal: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCustomPortFromModal = () => {
    if (portConflictModal) {
      const id = portConflictModal.serviceId;
      const port = portConflictModal.port;
      setPortConflictModal(null);
      handlePortChange(id, port);
    }
  };

  const handlePortChange = async (id: string, currentPort: number) => {
    // Navigate to settings page where port configuration is now located
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'settings' } }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scroll-to-section', { detail: { id: 'service-ports-config' } }));
    }, 150);
  };

  const handleStop = async (id: string) => {
    // @ts-ignore
    await window.api.stopService(id);
    loadServices();
  };

  const handleStartAll = async () => {
    setBulkAction('starting');
    // @ts-ignore
    await window.api.startAllServices();
    await loadServices();
    setBulkAction('idle');
  };

  const handleStopAll = async () => {
    setBulkAction('stopping');
    // @ts-ignore
    await window.api.stopAllServices();
    await loadServices();
    setBulkAction('idle');
  };

  const handleDownload = async (id: string) => {
    setIsDownloading(prev => ({ ...prev, [id]: true }));
    setDownloadProgress(prev => ({ ...prev, [id]: 0 }));
    
    try {
      // @ts-ignore
      const res = await window.api.downloadService(id);
      if (res.success) {
        alert(`${id} berhasil diunduh dan dipasang.`);
        loadServices();
      } else {
        alert(`Gagal mengunduh ${id}: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsDownloading(prev => ({ ...prev, [id]: false }));
      setDownloadProgress(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const handleRescueDb = async () => {
    setShowRescueModal(true);
    setRescueSource(null);
    try {
      // @ts-ignore
      const sources = await window.api.discoverRescueSources();
      setAutoRescueSources(sources.filter((s: any) => s.type === 'xampp')); // Focus on XAMPP
    } catch (e) {
      setAutoRescueSources([]);
    }
  };

  const handleRescueConfirm = async () => {
    if (!window.confirm(`Perhatian: Anda akan menimpa file inti MySQL XAMPP Anda dengan file dari folder backup.\n\nPastikan XAMPP sedang dalam keadaan MATI. Lanjutkan?`)) return;

    setIsRescuing(true);
    try {
      // @ts-ignore
      const res = await window.api.fixXamppMysql(rescuePath);
      if (res.success) {
        if (window.confirm('Perbaikan XAMPP berhasil dilakukan! 🎉\n\nApakah Anda ingin membuka xampp-control.exe sekarang?\n(Layanan Sabila akan dihentikan otomatis agar tidak ada konflik port)')) {
          // @ts-ignore
          await window.api.openXamppControl(rescuePath);
        }
        loadServices();
        setShowRescueModal(false);
      } else {
        alert(`Gagal: ${res.message}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsRescuing(false);
    }
  };

  const runningCount = services.filter(s => s.status === 'running').length;
  const installedCount = services.filter(s => s.status === 'stopped' || s.status === 'running' || s.isInstalled).length;

  if (initialLoading) {
    return (
      <div className="page-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" style={{ marginBottom: '1rem' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Memuat Dashboard...</p>
      </div>
    );
  }

  const getLogColor = (log: string) => {
    if (log.includes('[ERROR]') || log.includes('Error')) return '#ef4444';
    if (log.includes('[WARN]')) return '#f59e0b';
    if (log.includes('[INFO]') && (log.includes('started') || log.includes('Started'))) return '#10b981';
    if (log.includes('[System]')) return 'var(--brand-blue)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="page-container">
      {/* Greeting Section */}
      <div style={{ flexShrink: 0, marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>
          {getTimeGreeting(lang)}! 👋
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0rem' }}>{t.dashboard_desc}</p>
      </div>

      {/* Status Bento Card */}
      <div style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: '20px',
        padding: '1rem 1.25rem',
        border: '1px solid var(--outline-variant)',
        boxShadow: 'var(--shadow-ambient)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.2rem 0.6rem',
            background: runningCount > 0 ? 'rgba(209, 250, 229, 0.6)' : 'var(--surface-container)',
            borderRadius: '9999px',
            fontSize: '0.7rem', fontWeight: 500,
            color: runningCount > 0 ? '#065f46' : 'var(--text-muted)',
            border: runningCount > 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--outline-variant)',
            marginBottom: '0.5rem',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: runningCount > 0 ? '#10b981' : 'var(--outline-variant)' }}></span>
            {runningCount > 0 ? (lang === 'id' ? 'Sistem Aktif' : 'System Healthy') : (lang === 'id' ? 'Sistem Siaga' : 'System Standby')}
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.3, color: 'var(--on-surface)', marginBottom: '0.25rem' }}>
            {lang === 'id'
              ? `Anda punya ${installedCount} layanan siap, ${runningCount} sedang aktif.`
              : `You have ${installedCount} services ready, ${runningCount} active.`}
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            {runningCount > 0
              ? (lang === 'id' ? 'Semuanya berjalan lancar.' : 'Everything is running smoothly.')
              : (lang === 'id' ? 'Semua terkonfigurasi dan menunggu perintah Anda.' : 'Everything is configured and waiting for your command.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={handleRescueDb}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: 600, background: 'var(--amber-warning)', color: '#92400e', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px' }}
            title="Perbaiki MySQL XAMPP yang rusak (Restore Backup)"
          >
            <Database size={14} /> Perbaiki XAMPP
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (runningCount > 0) {
                if (window.confirm('Tindakan ini akan menghentikan semua layanan. Lanjutkan?')) handleStopAll();
              } else {
                handleStartAll();
              }
            }}
            disabled={bulkAction !== 'idle'}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '12px',
              background: runningCount > 0 ? 'var(--error)' : 'var(--primary)',
            }}
          >
            {runningCount > 0 ? <StopCircle size={16} /> : <PlayCircle size={16} />}
            {runningCount > 0
              ? (bulkAction === 'stopping' ? t.stopping_all : t.stop_all)
              : (bulkAction === 'starting' ? t.starting_all : t.start_all)}
          </button>
        </div>
      </div>

      {/* Service Cards */}
      <div style={{
        overflowY: 'auto',
        flex: 1,
        minHeight: '0',
        scrollbarWidth: 'thin',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gridAutoRows: 'max-content',
        gap: '1rem',
        paddingRight: '4px',
        paddingBottom: '1rem',
      }}>
        {services.map((svc, idx) => (
          <div key={svc.id} className="glass-card" style={{
            display: 'flex', flexDirection: 'column',
            padding: '1.25rem',
            borderRadius: '20px',
            position: 'relative',
            overflow: 'visible',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid var(--outline-variant)',
            boxShadow: svc.status === 'running' ? '0 8px 24px rgba(0,0,0,0.12)' : '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--outline-variant)'; }}
          >
            {/* Ambient glow */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '20px', overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '100px', height: '100px', background: svc.status === 'running' ? 'var(--primary)' : 'var(--secondary)', opacity: svc.status === 'running' ? 0.15 : 0.05, borderRadius: '50%', filter: 'blur(30px)', transition: 'all 0.5s ease' }}></div>
            </div>
            {/* Header: Icon + Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '12px', 
                background: svc.status === 'running' ? 'var(--primary-container)' : 'var(--surface-container-high)', 
                color: svc.status === 'running' ? 'var(--on-primary-container)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', 
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: svc.status === 'running' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                {svc.id === 'nginx' ? '🚀' : svc.id === 'apache' ? '🏠' : svc.id === 'php' ? '🐘' : svc.id === 'mysql' ? '🐬' : '⚙️'}
              </div>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.25rem 0.6rem', borderRadius: '9999px',
                background: svc.status === 'running' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                border: svc.status === 'running' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent'
              }}>
                <span className={`status-orb ${svc.type === 'tool' && svc.isInstalled ? 'running' : svc.status === 'running' ? 'running' : 'stopped'}`}></span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: svc.status === 'running' ? '#10b981' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {svc.status === 'running' ? (lang === 'id' ? 'Aktif' : 'Running') : (svc.type === 'tool' && svc.isInstalled ? (lang === 'id' ? 'Terpasang' : 'Installed') : (lang === 'id' ? 'Mati' : 'Stopped'))}
                </span>
              </div>
            </div>
            {/* Name + Info */}
            <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', margin: '0 0 0.35rem', textTransform: 'capitalize', letterSpacing: '-0.01em' }}>{svc.name}</h5>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1, fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {svc.type === 'service' && <div>Port: <strong style={{ color: 'var(--text-primary)' }}>{svc.port}</strong></div>}
              {svc.activeVersion ? (
                <div>{svc.activeVersion}</div>
              ) : (
                svc.type === 'tool' && svc.path && <div>{svc.path.length > 25 ? '...' + svc.path.slice(-25) : svc.path}</div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--outline-variant)' }}>
              {!svc.isInstalled ? (
                <div style={{ display: 'flex', borderRadius: '12px', flex: 1 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem 0.75rem', borderRadius: '12px', fontWeight: 600 }}
                    onClick={() => {
                      const url = DASHBOARD_DOWNLOADS[svc.id]?.stable;
                      if (url) { 
                        // @ts-ignore
                        window.api.openExternalUrl(url); 
                      } else { 
                        handleDownload(svc.id); 
                      }
                    }}
                    disabled={isDownloading[svc.id]}
                  >
                    <Download size={16} className={isDownloading[svc.id] ? 'pulse-animation' : ''} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    {isDownloading[svc.id]
                      ? (downloadProgress[svc.id] === 100 ? 'Ekstrak...' : `${downloadProgress[svc.id] || 0}%`)
                      : t.download}
                  </button>
                  {svc.type === 'service' && (
                    <div style={{ display: 'flex' }}>
                      <button
                        className="btn-primary"
                        style={{ background: 'var(--brand-purple)', padding: '0.5rem 0.6rem', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, display: 'flex', alignItems: 'center' }}
                        onClick={() => setActiveDropdown(activeDropdown === svc.id ? null : svc.id)}
                      >
                        <span style={{ fontSize: '10px', transform: activeDropdown === svc.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </button>
                      
                      {activeDropdown === svc.id && (
                        <>
                          <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                            onClick={() => setActiveDropdown(null)} 
                          />
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '6px',
                            background: 'var(--surface-container-high)',
                            border: '1px solid var(--outline-variant)',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            zIndex: 100,
                            minWidth: '180px',
                            overflow: 'hidden'
                          }}>
                            {svc.id === 'apache' && (
                              <button 
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  width: '100%',
                                  padding: '0.75rem 1rem',
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                  color: 'var(--text-primary)',
                                  textAlign: 'left',
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                onClick={() => {
                                  setIsDownloading(prev => ({ ...prev, [svc.id]: true }));
                                  setDownloadProgress(prev => ({ ...prev, [svc.id]: 0 }));
                                  // @ts-ignore
                                  window.api.downloadTool('vcredist', 'https://aka.ms/vc14/vc_redist.x64.exe').then((res: any) => {
                                    setIsDownloading(prev => ({ ...prev, [svc.id]: false }));
                                    if (res.success) alert('VC Redist berhasil diinstal!');
                                    else alert('Gagal menginstal VC Redist: ' + res.error);
                                  });
                                  setActiveDropdown(null);
                                }}
                              >
                                <Zap size={14} color="var(--brand-purple)" /> Unduh & Instal VC Redist
                              </button>
                            )}
                            <button 
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              onClick={() => {
                                // @ts-ignore
                                const otherUrl = DASHBOARD_DOWNLOADS[svc.id]?.other || `https://github.com/topics/${svc.id}`;
                                // @ts-ignore
                                window.api.openExternalUrl(otherUrl);
                                setActiveDropdown(null);
                              }}
                            >
                              Unduh versi lain
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : svc.type === 'tool' ? (
                <>
                  <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4rem' }} onClick={() => {
                    // @ts-ignore
                    window.api.openTerminal(svc.id);
                  }}>
                    <Terminal size={14} /> CMD
                  </button>
                  {['node', 'php', 'mysql', 'apache', 'nginx', 'composer'].includes(svc.id) ? (
                    <div style={{ flex: 1, minWidth: '40px' }}>
                      <ToolMenu 
                        toolId={svc.id} 
                        activeVersion={svc.activeVersion} 
                        onOpenFolder={() => {
                          const folderPath = svc.path.includes('.') ? svc.path.substring(0, svc.path.lastIndexOf('\\')) : svc.path;
                          // @ts-ignore
                          window.api.openDirectory(folderPath);
                        }}
                        onRefresh={loadServices} 
                      />
                    </div>
                  ) : (
                    <button className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4rem' }} onClick={() => {
                      const folderPath = svc.path.includes('.') ? svc.path.substring(0, svc.path.lastIndexOf('\\')) : svc.path;
                      // @ts-ignore
                      window.api.openDirectory(folderPath);
                    }}>
                      <ExternalLink size={14} /> Folder
                    </button>
                  )}
                </>
              ) : svc.status !== 'running' ? (
                <button className="btn-primary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', flex: 1, display: 'flex', justifyContent: 'center', gap: '0.4rem', borderRadius: '12px', fontWeight: 600 }} onClick={() => handleStart(svc.id)}>
                  <Play size={16} /> {t.start}
                </button>
              ) : (
                <>
                  <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', fontSize: '0.85rem', padding: '0.5rem 0.9rem', borderRadius: '12px' }} onClick={() => handleStop(svc.id)} title={t.stop}>
                    <Square size={14} />
                  </button>
                  <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', borderRadius: '12px' }} onClick={async () => {
                    await handleStop(svc.id);
                    await handleStart(svc.id);
                  }} title={t.restart}>
                    <RotateCw size={14} />
                  </button>
                  {['mysql', 'nginx', 'apache'].includes(svc.id) && (
                    <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '12px', flex: 1, justifyContent: 'center' }} onClick={() => {
                      let url = '';
                      if (svc.id === 'mysql') url = 'http://localhost/phpmyadmin';
                      else if (svc.id === 'nginx' || svc.id === 'apache') url = 'http://localhost';
                      if (url) {
                        // @ts-ignore
                        window.api.openExternalUrl(url);
                      }
                    }}>
                      <ExternalLink size={14} /> Admin
                    </button>
                  )}
                </>
              )}

              {svc.isInstalled && svc.type === 'service' && (
                <ServiceMenu serviceId={svc.id} activeVersion={svc.activeVersion} onRefresh={loadServices} />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* System Log Terminal Resizer */}
      {!isLogMinimized && (
        <div 
          style={{
            height: '8px',
            cursor: 'row-resize',
            marginTop: '0.5rem',
            background: isDragging ? 'var(--primary)' : 'transparent',
            borderRadius: '4px',
            transition: 'background 0.2s',
            flexShrink: 0,
            opacity: isDragging ? 1 : 0.5,
          }}
          onMouseDown={() => setIsDragging(true)}
          onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'transparent' }}
        />
      )}
      
      {/* System Log Terminal */}
      <div className="terminal-panel" style={{ 
        marginTop: isLogMinimized ? '1rem' : '0.25rem', 
        display: 'flex', flexDirection: 'column', 
        flex: isLogMinimized ? '0 0 auto' : 'none', 
        height: isLogMinimized ? '44px' : `${terminalHeight}px`, 
        minHeight: isLogMinimized ? '44px' : '50px', 
        overflow: 'hidden',
        transition: isDragging ? 'none' : 'height 0.3s ease',
      }}>
        <div className="terminal-header"
          onClick={() => setIsLogMinimized(!isLogMinimized)}
          style={{ cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Terminal size={15} color="#9fcaff" />
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: '#e2e2e2', fontWeight: 600 }}>Server Logs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#b8cac9', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={isLogMinimized ? 'Expand' : 'Minimize'}>
              {isLogMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
        </div>
        {!isLogMinimized && (
          <div className="terminal-body" style={{ flex: 1 }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: getLogColor(log), padding: '1px 0' }}>{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
      
      {/* Port Conflict Modal */}
      {portConflictModal && portConflictModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '450px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              ⚠️ {(t as any).port_conflict_title || "Konflik Port Terdeteksi"}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {((t as any).port_conflict_desc || "Port {port} saat ini sedang digunakan oleh aplikasi lain. Apa yang ingin Anda lakukan?").replace('{port}', portConflictModal.port.toString())}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={handleForceStop} className="btn-primary" style={{ background: '#ef4444', color: '#fff', width: '100%', padding: '0.75rem' }}>
                🛑 {(t as any).port_conflict_force || "Paksa Tutup (Force Stop) Proses Lain"}
              </button>
              <button onClick={handleAutoPort} className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                🤖 {(t as any).port_conflict_auto || "Cari Port Kosong Otomatis"}
              </button>
              <button onClick={handleCustomPortFromModal} className="btn-secondary" style={{ width: '100%', padding: '0.75rem' }}>
                ✏️ {(t as any).port_conflict_custom || "Ubah ke Port Kustom"}
              </button>
              <button onClick={() => setPortConflictModal(null)} className="btn-secondary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: 'transparent', border: 'none' }}>
                {(t as any).cancel || "Batal"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Rescue DB Modal */}
      {showRescueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '500px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '80vh', overflow: 'hidden' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} /> Perbaiki XAMPP
            </h3>
            
            {!rescueSource && (
              <>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Pilih lokasi XAMPP Anda. Sabila akan membantu memperbaiki MySQL XAMPP yang tidak bisa start secara otomatis.</p>
                
                {autoRescueSources.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Terdeteksi Otomatis:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                      {autoRescueSources.map(src => (
                        <button key={src.path} className="btn-secondary" onClick={() => { setRescueSource(src.type as any); setRescuePath(src.path); }} style={{ justifyContent: 'flex-start', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                          <Database size={16} style={{ marginRight: '0.5rem' }} /> {src.name} ({src.path})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Atau Pilih Manual:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <button className="btn-secondary" onClick={() => { setRescueSource('xampp'); setRescuePath('C:\\xampp\\mysql\\data'); }}>
                    XAMPP (Default)
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => setShowRescueModal(false)} className="btn-secondary">Batal</button>
                </div>
              </>
            )}

            {rescueSource && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Path Folder Data MySQL XAMPP</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={rescuePath} 
                      onChange={e => setRescuePath(e.target.value)} 
                      placeholder="Misal: C:\xampp\mysql\data"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Sistem akan menyalin dan menimpa direktori berikut dari <code style={{color: 'var(--accent)'}}>backup</code> ke <code style={{color: 'var(--accent)'}}>data</code>:
                    <br/><br/>
                    • <code style={{color: 'var(--accent)'}}>mysql/</code><br/>
                    • <code style={{color: 'var(--accent)'}}>performance_schema/</code><br/>
                    • <code style={{color: 'var(--accent)'}}>phpmyadmin/</code><br/>
                    • <code style={{color: 'var(--accent)'}}>test/</code><br/>
                    • <code style={{color: 'var(--accent)'}}>ibdata1</code>
                  </p>
                  <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--error)', fontWeight: 600 }}>
                      ⚠️ Pastikan XAMPP dalam keadaan MATI sebelum mengeklik tombol di bawah ini.
                    </p>
                  </div>
                </div>

                {isRescuing ? (
                  <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem' }}>
                    <div className="spinner" style={{ marginBottom: '1rem', display: 'inline-block' }}></div>
                    <div style={{ color: 'var(--accent)', fontSize: '0.95rem' }}>Sedang menyalin file backup...</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button className="btn-secondary" onClick={() => { setRescueSource(null); }}>
                      Kembali
                    </button>
                    <button className="btn-primary" onClick={handleRescueConfirm} disabled={!rescuePath}>
                      <Database size={16} />
                      Mulai Perbaiki XAMPP
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
