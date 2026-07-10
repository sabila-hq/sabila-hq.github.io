import React, { useEffect, useState } from 'react';
import { Terminal, ExternalLink, Package, GitBranch, Database, Wrench, HardDrive, Activity, Mail, Cpu, Box, Plus, Send, Clock, Info, Play } from 'lucide-react';
import { translations } from '../translations';
import { Explorer } from './Explorer';
import { LogViewerPage } from './LogViewerPage';
import { MailCatcherPage } from './MailCatcherPage';
import { PhpExtensionsPage } from './PhpExtensionsPage';
import { MailSenderPage } from './MailSenderPage';
import { ServicePortsPage } from './ServicePortsPage';
import { CronPage } from './CronPage';
import { ToolMenu } from '../components/ToolMenu';

interface ToolInfo {
  id: string;
  name: string;
  icon: string;
  version: string;
  activeVersion?: string;
  path: string;
  isInstalled: boolean;
  category: 'runtime' | 'package-manager' | 'vcs' | 'database-tool';
}

const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  runtime: { label: 'tools_cat_runtime', icon: <Package size={16} /> },
  'package-manager': { label: 'tools_cat_package_manager', icon: <Package size={16} /> },
  vcs: { label: 'tools_cat_vcs', icon: <GitBranch size={16} /> },
  'database-tool': { label: 'tools_cat_database_tool', icon: <Database size={16} /> },
};

const TOOL_DOWNLOADS: Record<string, { stable: string, other: string }> = {
  node: {
    stable: 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip',
    other: 'https://nodejs.org/en/download/current'
  },
  composer: {
    stable: 'https://getcomposer.org/download/latest-stable/composer.phar',
    other: 'https://getcomposer.org/download/'
  },
  git: {
    stable: 'https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/PortableGit-2.45.2-64-bit.7z.exe',
    other: 'https://git-scm.com/download/win'
  },
  'git-bash': {
    stable: 'https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/PortableGit-2.45.2-64-bit.7z.exe',
    other: 'https://git-scm.com/download/win'
  },
  phpmyadmin: {
    stable: 'https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-all-languages.zip',
    other: 'https://www.phpmyadmin.net/downloads/'
  },
  php: {
    stable: 'https://downloads.php.net/~windows/releases/archives/php-8.3.32-Win32-vs16-x64.zip',
    other: 'https://downloads.php.net/~windows/releases/archives/'
  },
  mysql: {
    stable: 'https://cdn.mysql.com/archives/mysql-8.0/mysql-8.0.34-winx64.zip',
    other: 'https://dev.mysql.com/downloads/mysql/'
  },
  nginx: {
    stable: 'https://nginx.org/download/nginx-1.24.0.zip',
    other: 'https://nginx.org/en/download.html'
  },
  apache: {
    stable: 'https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.68-260617-Win64-VS18.zip',
    other: 'https://www.apachelounge.com/download/'
  },
  postgresql: {
    stable: 'https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip',
    other: 'https://www.enterprisedb.com/download-postgresql-binaries'
  },
  python: {
    stable: 'https://www.python.org/ftp/python/3.12.3/python-3.12.3-embed-amd64.zip',
    other: 'https://www.python.org/downloads/windows/'
  },
  dbeaver: {
    stable: 'https://github.com/dbeaver/dbeaver/releases/latest/download/dbeaver-ce-26.1.2-windows-x86_64.zip',
    other: 'https://dbeaver.io/download/'
  },
  mongodb: {
    stable: 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.0.zip',
    other: 'https://www.mongodb.com/try/download/community'
  },
  go: {
    stable: 'https://go.dev/dl/go1.22.2.windows-amd64.zip',
    other: 'https://go.dev/dl/'
  },
  bun: {
    stable: 'https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip',
    other: 'https://bun.sh/docs/installation'
  },
  cloudflared: {
    stable: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
    other: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
  },
  ngrok: {
    stable: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip',
    other: 'https://ngrok.com/download'
  },
  'wp-cli': {
    stable: 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
    other: 'https://wp-cli.org/#installing'
  }
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  node: 'Node.js adalah runtime JavaScript untuk membangun aplikasi sisi server dan tool command-line.',
  composer: 'Composer adalah manajer dependensi tingkat aplikasi untuk bahasa pemrograman PHP.',
  git: 'Git adalah sistem kontrol versi terdistribusi untuk melacak perubahan source code secara efisien.',
  phpmyadmin: 'phpMyAdmin adalah alat berbasis web populer untuk mengelola database MySQL dan MariaDB.',
  php: 'PHP adalah bahasa skrip open-source serbaguna yang berjalan di sisi server (server-side).',
  mysql: 'MySQL adalah sistem manajemen database relasional (RDBMS) berbasis SQL yang cepat dan tangguh.',
  nginx: 'Nginx adalah server web HTTP berkinerja sangat tinggi, proxy terbalik (reverse proxy), dan load balancer.',
  apache: 'Apache HTTP Server adalah server web open-source lintas platform yang stabil dan sangat fleksibel.',
  postgresql: 'PostgreSQL adalah sistem database relasional-objek (ORDBMS) open-source tingkat perusahaan yang sangat andal.',
  python: 'Python adalah bahasa pemrograman tingkat tinggi serbaguna, ideal untuk automasi, AI, dan scripting.',
  dbeaver: 'DBeaver adalah alat klien antarmuka grafis (GUI) universal untuk mengelola berbagai macam sistem database.',
  mongodb: 'MongoDB adalah database NoSQL berorientasi dokumen yang cepat, tangguh, dan fleksibel (berbasis JSON).',
  go: 'Go (Golang) adalah bahasa pemrograman kompilasi statis ciptaan Google yang cepat, aman, dan efisien untuk konkurensi.',
  bun: 'Bun adalah runtime JavaScript "all-in-one" yang sangat cepat, sudah termasuk bundler, test runner, dan package manager.',
  cloudflared: 'Cloudflared (Cloudflare Tunnel) mengarahkan lalu lintas dari internet ke server lokal Anda secara aman tanpa public IP atau port forwarding.',
  ngrok: 'Ngrok adalah layanan tunnel lintas platform untuk mengekspos aplikasi lokal (localhost) Anda ke internet dengan mudah.',
  'wp-cli': 'WP-CLI adalah antarmuka baris perintah (CLI) untuk mengelola berbagai aspek instalasi WordPress tanpa web browser.'
};

export const Tools: React.FC<{ lang?: string }> = ({ lang = 'en' }) => {
  const [activeTab, setActiveTab] = useState<'ports' | 'extensions' | 'explorer' | 'logs' | 'mail' | 'mail_sender' | 'php' | 'cron'>('extensions');
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [downloadingTools, setDownloadingTools] = useState<Record<string, { progress: number, status?: string }>>({});
  const [dashboardItems, setDashboardItems] = useState<string[]>([]);
  const t = translations[lang as keyof typeof translations] || translations.en;

  useEffect(() => {
    // @ts-ignore
    window.api.getTools().then(data => {
      setTools(data);
      setLoading(false);
    });
    // @ts-ignore
    window.api.getDashboardItems().then(items => {
      setDashboardItems(items);
    });

    // Listen for download progress
    let removeListener = () => {};
    // @ts-ignore
    if (window.api.onDownloadProgress) {
      // @ts-ignore
      removeListener = window.api.onDownloadProgress((data: any) => {
        setDownloadingTools(prev => ({
          ...prev,
          [data.toolId]: { progress: data.progress, status: data.status }
        }));
      });
    }

    const handleSwitchToolTab = (e: any) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('switch-tool-tab', handleSwitchToolTab);

    return () => {
      removeListener();
      window.removeEventListener('switch-tool-tab', handleSwitchToolTab);
    };
  }, []);

  const handleToggleDashboard = async (toolId: string) => {
    // @ts-ignore
    const newItems = await window.api.toggleDashboardItem(toolId);
    setDashboardItems(newItems);
  };


  const handleOpenTerminal = async (toolId: string) => {
    // @ts-ignore
    await window.api.openTerminal(toolId);
  };

  const handleOpenDir = async (toolPath: string) => {
    // @ts-ignore
    await window.api.openDirectory(toolPath);
  };

  // Group by category
  const grouped = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="page-header" style={{ flexShrink: 0, paddingBottom: 0 }}>
        <h1 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)', fontWeight: 800 }}>
          <Wrench size={24} className="inline mr-2" style={{ verticalAlign: 'text-bottom', color: 'var(--primary)' }} /> {t.tools_title}
        </h1>
        <p style={{ marginBottom: '1rem', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{t.tools_desc}</p>
        
        {/* Custom Tab Navigation */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--glass-border)', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {[
            { id: 'extensions', label: t.tools_tab_extensions, icon: Box },
            { id: 'ports', label: t.tools_tab_ports, icon: Database },
            { id: 'explorer', label: t.tools_tab_explorer, icon: HardDrive },
            { id: 'logs', label: t.tools_tab_logs, icon: Activity },
            { id: 'mail', label: t.tools_tab_mail, icon: Mail },
            { id: 'mail_sender', label: t.tools_tab_mail_sender, icon: Send },
            { id: 'php', label: t.tools_tab_php, icon: Wrench },
            { id: 'cron', label: t.tools_tab_cron, icon: Clock }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: 'none', border: 'none', padding: '0.75rem 0.5rem', cursor: 'pointer',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
                  fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  transition: 'all 0.2s ease', fontFamily: 'var(--font-heading)'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'ports' && <ServicePortsPage lang={lang} embedded={true} />}
        {activeTab === 'explorer' && <Explorer lang={lang} embedded={true} />}
        {activeTab === 'logs' && <LogViewerPage lang={lang} embedded={true} />}
        {activeTab === 'mail' && <MailCatcherPage lang={lang} embedded={true} />}
        {activeTab === 'mail_sender' && <MailSenderPage lang={lang} embedded={true} />}
        {activeTab === 'php' && <PhpExtensionsPage lang={lang} embedded={true} />}
        {activeTab === 'cron' && <CronPage lang={lang} embedded={true} />}
        
        {activeTab === 'extensions' && (
          <div style={{ padding: '1.5rem' }}>
            {loading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.tools_detecting}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(grouped).map(([category, catTools]) => (
            <div key={category}>
              <h3 style={{ 
                marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase',
                letterSpacing: '0.08em', fontWeight: 600, fontFamily: 'var(--font-heading)'
              }}>
                {categoryLabels[category]?.icon} {(t as any)[categoryLabels[category]?.label || ""] || categoryLabels[category]?.label || category}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {catTools.map(tool => (
                  <div key={tool.id} className="glass-card" style={{ 
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                    opacity: 1,
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ padding: '0.5rem', background: 'var(--primary-container)', borderRadius: '12px', flexShrink: 0, color: 'var(--on-primary-container)' }}>
                        <span style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>{tool.icon}</span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>{tool.name}</h4>
                          <button
                            onClick={() => alert(`${tool.name}:\n\n${TOOL_DESCRIPTIONS[tool.id] || t.tools_no_desc}`)}
                            style={{ 
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-muted)', transition: 'color 0.2s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            title={t.tools_info_func}
                          >
                            <Info size={14} />
                          </button>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                          {tool.isInstalled ? (tool.version === '-' ? ((t as any).tools_installed) : `v${tool.version.replace(/^v/i, '')}`) : ((t as any).tools_not_installed)}
                        </span>
                      </div>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: tool.isInstalled ? 'var(--status-running)' : 'var(--status-stopped)',
                        boxShadow: tool.isInstalled ? '0 0 8px var(--status-running)' : 'none'
                      }}></div>
                    </div>

                    {tool.isInstalled && (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}>
                        <button
                          className="btn-secondary"
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', textAlign: 'center', lineHeight: '1.2' }}
                          onClick={() => handleOpenTerminal(tool.id)}
                          title={t.tools_open_cmd}
                        >
                          <Terminal size={14} style={{ marginBottom: '2px' }} /> CMD
                        </button>
                        {['node', 'php', 'mysql', 'apache', 'nginx', 'composer', 'postgresql', 'python', 'mongodb', 'go', 'bun'].includes(tool.id) ? (
                          <div style={{ flex: 1, display: 'flex' }}>
                            <ToolMenu 
                              toolId={tool.id} 
                              activeVersion={tool.activeVersion} 
                              isDashboardItem={dashboardItems.includes(tool.id)}
                              onToggleDashboard={() => handleToggleDashboard(tool.id)}
                              onOpenFolder={() => handleOpenDir(tool.path.includes('.') ? tool.path.substring(0, tool.path.lastIndexOf('\\')) : tool.path)}
                              onRefresh={() => {
                                setLoading(true);
                                // @ts-ignore
                                window.api.getTools().then(data => { setTools(data); setLoading(false); });
                              }} 
                              onAddVersion={() => {
                                const url = TOOL_DOWNLOADS[tool.id]?.other || `https://github.com/topics/${tool.id}`;
                                // @ts-ignore
                                window.api.openExternalUrl(url);
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <button
                              className="btn-secondary"
                              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', textAlign: 'center', lineHeight: '1.2' }}
                              onClick={() => handleOpenDir(tool.path.includes('.') ? tool.path.substring(0, tool.path.lastIndexOf('\\')) : tool.path)}
                              title={t.tools_open_folder}
                            >
                              <ExternalLink size={14} style={{ marginBottom: '2px' }} /> Folder
                            </button>
                            {tool.path.toLowerCase().endsWith('.exe') && (
                              <button
                                className="btn-secondary"
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', textAlign: 'center', lineHeight: '1.2' }}
                                onClick={() => {
                                  // @ts-ignore
                                  window.api.executeFile(tool.path);
                                }}
                                title={t.tools_run_app}
                              >
                                <Play size={14} style={{ marginBottom: "2px" }} /> {t.tools_run}
                              </button>
                            )}
                            <button
                              className="btn-secondary"
                              style={{ 
                                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', 
                                textAlign: 'center', lineHeight: '1.2',
                                color: dashboardItems.includes(tool.id) ? 'var(--error)' : 'inherit',
                                background: dashboardItems.includes(tool.id) ? 'var(--error-container)' : 'transparent',
                                borderColor: dashboardItems.includes(tool.id) ? 'var(--error)' : 'var(--outline)'
                              }}
                              onClick={() => handleToggleDashboard(tool.id)}
                              title={dashboardItems.includes(tool.id) ? (t.tools_remove_dashboard) : (t.tools_add_dashboard)}
                            >
                              <Plus size={14} style={{ 
                                marginBottom: '2px', 
                                transform: dashboardItems.includes(tool.id) ? 'rotate(45deg)' : 'none',
                                transition: 'transform 0.2s ease'
                              }} /> Dashboard
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {!tool.isInstalled && (
                      <div style={{ display: 'flex', marginTop: 'auto', borderRadius: '4px', position: 'relative' }}>
                        {downloadingTools[tool.id] !== undefined ? (
                          <div style={{ width: '100%', height: '32px', background: 'var(--surface-container-high)', borderRadius: '4px', overflow: 'hidden', position: 'relative', border: '1px solid var(--outline)' }}>
                            <div style={{
                              position: 'absolute', top: 0, left: 0, bottom: 0,
                              width: `${downloadingTools[tool.id].progress}%`,
                              background: 'var(--primary)', opacity: 0.3,
                              transition: 'width 0.3s ease'
                            }} />
                            <div style={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)'
                            }}>
                              {downloadingTools[tool.id].status || `${t.tools_downloading} ${Math.round(downloadingTools[tool.id].progress)}%`}
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              className="btn-primary"
                              style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', fontWeight: 600, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: '1px solid rgba(255,255,255,0.2)' }}
                              onClick={async () => {
                                const url = TOOL_DOWNLOADS[tool.id]?.stable;
                                if (url) {
                                  setDownloadingTools(prev => ({ ...prev, [tool.id]: { progress: 0 } }));
                                  // @ts-ignore
                                  const result = await window.api.downloadTool(tool.id, url);
                                  if (result && result.success) {
                                    alert(`${t.tools_download_success} ${result.savePath}`);
                                    // @ts-ignore
                                    window.api.getTools().then(data => setTools(data));
                                  } else {
                                    alert(`${t.tools_download_failed} ${tool.name}`);
                                  }
                                  setDownloadingTools(prev => {
                                    const next = { ...prev };
                                    delete next[tool.id];
                                    return next;
                                  });
                                } else {
                                  alert(`${t.tools_download_url_missing} ${tool.name}.`);
                                }
                              }}
                            >
                              {t.tools_download_stable}
                            </button>
                            <div style={{ display: 'flex' }}>
                              <button
                                className="btn-primary"
                                style={{ padding: '0.4rem 0.5rem', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, display: 'flex', alignItems: 'center' }}
                                onClick={() => setActiveDropdown(activeDropdown === tool.id ? null : tool.id)}
                              >
                                <span style={{ fontSize: '9px', transform: activeDropdown === tool.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                              </button>
                              
                              {activeDropdown === tool.id && (
                                <>
                                  <div 
                                    style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                                    onClick={() => setActiveDropdown(null)} 
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--surface-container-high)',
                                    border: '1px solid var(--outline)',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: 'var(--shadow-sm)',
                                    zIndex: 100,
                                    minWidth: '130px',
                                    overflow: 'hidden'
                                  }}>
                                    <button 
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.6rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        textAlign: 'left',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                      onClick={() => {
                                        // @ts-ignore
                                        const otherUrl = TOOL_DOWNLOADS[tool.id]?.other || `https://github.com/topics/${tool.id}`;
                                        // @ts-ignore
                                        window.api.openExternalUrl(otherUrl);
                                        setActiveDropdown(null);
                                      }}
                                    >
                                      {t.tools_download_other}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
          </div>
        )}
      </div>
    </div>
  );
};
