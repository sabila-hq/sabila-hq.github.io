import React, { useState, useEffect } from 'react';
import { Folder, Globe, ExternalLink, RefreshCw, FolderOpen, Code, PackagePlus, Rocket, Loader2, Check, Settings2, Share2, Search, Info, X, Terminal, Download, Upload } from 'lucide-react';
import { translations } from '../translations';
import { ProjectConfigModal } from '../components/ProjectConfigModal';

import { QRCodeSVG } from 'qrcode.react';

interface ProjectsProps {
  lang: string;
}

interface Project {
  name: string;
  path: string;
}

interface ProgressData {
  step: string;
  progress: number;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  log?: string;
}

const ProjectIcon: React.FC<{ projectName: string }> = ({ projectName }) => {
  const [imgError, setImgError] = useState(false);
  // Optional: add a cache buster if favicon changes frequently, but browser cache is usually fine.
  const faviconUrl = `http://${projectName}.test/favicon.ico`;

  if (imgError) {
    return (
      <div style={{ padding: '0.6rem', background: 'var(--primary-fixed)', borderRadius: '12px', flexShrink: 0 }}>
        <Globe color="var(--on-primary-container)" size={24} />
      </div>
    );
  }

  return (
    <div style={{ width: '43.2px', height: '43.2px', background: 'var(--surface-container)', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img 
        src={faviconUrl} 
        alt="icon" 
        onError={() => setImgError(true)}
        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
      />
    </div>
  );
};

export const Projects: React.FC<ProjectsProps> = ({ lang }) => {
  const t = (translations as any)[lang] || translations.id;
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [configProject, setConfigProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tunnelingProj, setTunnelingProj] = useState<string | null>(null);
  const [tunnelModal, setTunnelModal] = useState<{open: boolean, url: string, projectName: string} | null>(null);

  // Project Info State
  const [infoProject, setInfoProject] = useState<Project | null>(null);
  const [projectInfoData, setProjectInfoData] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Prep Dependencies State
  const [prepProject, setPrepProject] = useState<Project | null>(null);
  const [prepLogs, setPrepLogs] = useState<string[]>([]);
  const [isPrepping, setIsPrepping] = useState(false);

  // App Generator State
  const [showGenerator, setShowGenerator] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppTemplate, setNewAppTemplate] = useState('laravel');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [generatorLogs, setGeneratorLogs] = useState<string[]>([]);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      const container = logsEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [generatorLogs]);

  const [servicesReady, setServicesReady] = useState(false);

  useEffect(() => {
    loadProjects();
    
    // Poll service status to enable/disable the 'Buka di Browser' button
    const checkServices = async () => {
      try {
        const statuses = await (window as any).api.getServices();
        const isNginxRunning = statuses['nginx']?.status === 'running';
        const isPhpRunning = Object.values(statuses).some((s: any) => s.id?.startsWith('php') && s.status === 'running') || statuses['php']?.status === 'running';
        // For simplicity, we just check if Nginx is running. You can tighten this to check PHP and MySQL as well.
        setServicesReady(isNginxRunning && isPhpRunning);
      } catch (e) {
        // ignore
      }
    };
    checkServices();
    const interval = setInterval(checkServices, 2000);
    
    const unsub = (window as any).api.onAppGeneratorProgress((data: ProgressData) => {
      setProgress(data);
      if (data.log) {
        setGeneratorLogs(prev => {
          const newLogs = [...prev, data.log!];
          return newLogs.slice(-50); // Keep last 50 lines to prevent memory issues
        });
      }
    });
    const unsubPrep = (window as any).api.onPrepProgress((data: { log: string }) => {
      if (data.log) {
        setPrepLogs(prev => {
          const newLogs = [...prev, data.log];
          return newLogs.slice(-100);
        });
      }
    });

    return () => {
      clearInterval(interval);
      if (unsub) unsub();
      if (unsubPrep) unsubPrep();
    };
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projs = await (window as any).api.getProjects();
      setProjects(projs);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const syncProjects = async () => {
    setSyncing(true);
    try {
      await (window as any).api.syncProjects(projects);
      await (window as any).api.showAlert(t.vhosts_synced || 'Vhosts synced successfully!');
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const generateApp = async () => {
    if (!newAppName) return;
    setGenerating(true);
    setGeneratorLogs([]);
    setProgress({ step: 'Initializing...', progress: 0, status: 'running' });
    try {
      await (window as any).api.generateApp(newAppTemplate, newAppName);
      
      // Auto-sync hosts and nginx
      setProgress({ step: 'Sinkronisasi Vhost...', progress: 95, status: 'running' });
      const latestProjects = await (window as any).api.getProjects();
      setProjects(latestProjects);
      await (window as any).api.syncProjects(latestProjects);
      
      await (window as any).api.showAlert(`${t.app_gen_success}\n\n${t.app_gen_success_vhost}`);
      setShowGenerator(false);
      setNewAppName('');
    } catch (e) {
      console.error(e);
      await (window as any).api.showAlert(t.app_gen_failed || 'Failed to generate app');
    }
    setGenerating(false);
    setProgress(null);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openProjectInfo = async (proj: Project) => {
    setInfoProject(proj);
    setProjectInfoData(null);
    setLoadingInfo(true);
    try {
      const data = await (window as any).api.getProjectInfo(proj.path);
      setProjectInfoData(data);
    } catch (e) {
      console.error(e);
    }
    setLoadingInfo(false);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)', fontWeight: 800 }}>
            <Folder size={24} color="var(--primary)" />
            {t.projects}
          </h1>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{t.projects_desc}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={async () => {
            const res = await (window as any).api.exportRecipe();
            if (res.success) {
              await (window as any).api.showAlert(t.export_recipe_success?.replace('{path}', res.filePath));
            } else if (!res.canceled) {
              await (window as any).api.showAlert(t.export_recipe_failed?.replace('{error}', res.error));
            }
          }} title={t.export_recipe_desc || "Export current stack (Recipe)"}>
            <Upload size={16} />
            {t.export_recipe || "Export Recipe"}
          </button>
          <button className="btn-secondary" onClick={async () => {
            const res = await (window as any).api.importRecipe();
            if (res.success) {
              let statusText = '';
              for (const r of res.results) {
                statusText += `- ${r.toolId} (${r.version}): ${r.status}\n`;
              }
              let msg = t.import_recipe_success
                ? t.import_recipe_success.replace('{name}', res.recipeName).replace('{status}', statusText)
                : `Recipe '${res.recipeName}' berhasil diimpor!\n\nStatus Modul:\n${statusText}\n*Catatan: Modul dengan status 'missing' harus didownload manual atau menggunakan Installer.`;
              await (window as any).api.showAlert(msg);
            } else if (!res.canceled) {
              await (window as any).api.showAlert(t.import_recipe_failed?.replace('{error}', res.error));
            }
          }} title={t.import_recipe_desc || "Import team's stack (Recipe)"}>
            <Download size={16} />
            {t.import_recipe || "Import Recipe"}
          </button>
          
          <div style={{ width: '1px', background: 'var(--glass-border)', margin: '0 0.25rem' }}></div>

          <button className="btn-secondary" onClick={() => setShowGenerator(!showGenerator)}>
            <PackagePlus size={16} />
            {t.app_generator}
          </button>
          <button className="btn-primary" onClick={syncProjects} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? "spin-animation" : ""} />
            {syncing ? t.syncing : t.sync}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>

      {showGenerator && (
        <div className="glass-panel slide-down" style={{ padding: '1.5rem', flexShrink: 0, borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>
              <PackagePlus size={20} color="var(--primary)" />
              {t.app_generator}
            </h3>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.app_gen_name}</label>
              <input 
                className="input-glass" 
                style={{ width: '100%', padding: '0.75rem' }}
                placeholder={t.app_gen_name_placeholder}
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                disabled={generating}
              />
            </div>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.app_gen_template}</label>
              <select 
                className="input-glass" 
                style={{ width: '100%', padding: '0.75rem', appearance: 'auto' }}
                value={newAppTemplate}
                onChange={(e) => setNewAppTemplate(e.target.value)}
                disabled={generating}
              >
                <option value="laravel">Laravel</option>
                <option value="wordpress">WordPress</option>
                <option value="codeigniter3">CodeIgniter 3</option>
                <option value="codeigniter4">CodeIgniter 4</option>
                <option value="express">Express.js</option>
                <option value="fastify">Fastify</option>
                <option value="koa">Koa.js</option>
                <option value="nestjs">NestJS</option>
              </select>
            </div>
            <button 
              className="btn-primary" 
              onClick={generateApp} 
              disabled={generating || !newAppName}
              style={{ flex: '0 0 auto', height: '42px', padding: '0 1.5rem' }}
            >
              {generating ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />}
              <span style={{ marginLeft: '0.5rem' }}>{generating ? t.app_gen_creating : t.app_gen_create}</span>
            </button>
          </div>

          {generating && progress && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                <span>{progress.step}</span>
                <span>{progress.progress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--surface-container)', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    background: 'var(--primary)', 
                    width: `${progress.progress}%`,
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
              
              {generatorLogs.length > 0 && (
                <div 
                  className="terminal-panel" 
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: '#1a1a2e',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#e0e0e0',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  {generatorLogs.map((log, i) => (
                    <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {projects.length > 0 && !loading && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-glass"
            placeholder={t.search_projects || "Cari proyek..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: 'var(--radius-lg)' }}
          />
        </div>
      )}

      <div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="spinner"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem' }}>
            <FolderOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>{t.empty_projects}</h3>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.empty_projects_sub}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 2rem' }}>
            <Search size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.search_no_results || "Tidak ada proyek yang sesuai dengan pencarian."}</p>
          </div>
        ) : (
          filteredProjects.map((proj, i) => (
            <div key={i} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                  <ProjectIcon projectName={proj.name} />
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }} title={`${proj.name}.test`}>
                      {proj.name}.test
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }} title={proj.path}>
                      {proj.path}
                    </p>
                  </div>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: 'var(--primary)' }} 
                    title={t.project_info_desc || "Info Detail Proyek (PHP, Framework, Dependensi)"}
                    onClick={() => openProjectInfo(proj)}
                  >
                    <Info size={18} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '1rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.5rem', opacity: servicesReady ? 1 : 0.5, cursor: servicesReady ? 'pointer' : 'not-allowed', color: servicesReady ? 'var(--status-running)' : 'var(--text-secondary)' }} 
                  title={servicesReady ? (t.open_in_browser || "Buka di Browser (Akses Lokal)") : (t.open_in_browser_disabled || "Harap aktifkan layanan (Nginx & PHP) terlebih dahulu di Dashboard.")} 
                  disabled={!servicesReady}
                  onClick={() => {
                    setPrepProject(proj);
                    setPrepLogs([]);
                  }}
                >
                  <ExternalLink size={16} />
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.5rem', color: 'var(--text-primary)' }} 
                  title={t.open_folder_desc || "Buka Folder Proyek di File Explorer"} 
                  onClick={() => (window as any).api.openDirectory(proj.path)}
                >
                  <FolderOpen size={16} />
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.5rem', color: 'var(--text-primary)' }} 
                  title={t.open_terminal_desc || "Buka Terminal di Folder Proyek"} 
                  onClick={() => (window as any).api.openProjectTerminal(proj.path)}
                >
                  <Terminal size={16} />
                </button>

                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.5rem', color: tunnelingProj === proj.name ? 'var(--status-running)' : 'var(--status-warning)' }} 
                  title={t.share_public_desc || "Share ke Publik (LocalTunnel)"} 
                  disabled={tunnelingProj === proj.name}
                  onClick={async () => {
                    setTunnelingProj(proj.name);
                    try {
                      const res = await (window as any).api.tunnelStart(proj.name, 80);
                      if (res.status === 'active' && res.publicUrl) {
                        setTunnelModal({ open: true, url: res.publicUrl, projectName: proj.name });
                      } else {
                        await (window as any).api.showAlert(t.tunnel_failed?.replace('{error}', res.error || t.unknown_error));
                      }
                    } catch (e: any) {
                      await (window as any).api.showAlert(t.error_msg?.replace('{error}', e.message));
                    } finally {
                      setTunnelingProj(null);
                    }
                  }}
                >
                  {tunnelingProj === proj.name ? <Loader2 size={16} className="spin" /> : <Share2 size={16} />}
                </button>
                <div style={{ flex: 1 }}></div>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} 
                  title={t.config_project_desc || "Konfigurasi Proyek (.env, PHP, SSL, Hapus)"}
                  onClick={() => setConfigProject(proj)}
                >
                  <Settings2 size={14} style={{ color: 'var(--brand-blue)' }} />
                  {t.config || "Config"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {configProject && (
        <ProjectConfigModal 
          projectName={configProject.name} 
          projectPath={configProject.path} 
          onClose={() => setConfigProject(null)}
          lang={lang}
        />
      )}

      {infoProject && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '90%', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Info size={24} style={{ color: 'var(--primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>{t.project_info || "Info Proyek:"} {infoProject.name}</h2>
              </div>
              <button className="btn-secondary" style={{ padding: '0.5rem', border: 'none' }} onClick={() => setInfoProject(null)}>
                <X size={20} />
              </button>
            </div>
            
            {loadingInfo ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="spin" size={32} style={{ color: 'var(--brand-blue)' }} />
              </div>
            ) : projectInfoData && Array.isArray(projectInfoData) ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {projectInfoData.map((info, idx) => (
                  <div key={idx} className="glass-card" style={{ padding: '1rem', background: 'var(--surface-container-low)', boxShadow: 'none' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontFamily: 'var(--font-body)' }}>{info.name}</div>
                    <div style={{ fontWeight: '500', fontFamily: 'var(--font-body)', color: 'var(--on-surface)' }}>{info.version}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.project_info_failed}</p>
            )}
          </div>
        </div>
      )}
      {prepProject && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ maxWidth: '600px', width: '90%', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Rocket size={24} style={{ color: 'var(--primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>{t.prep_project || "Mempersiapkan Proyek..."}</h2>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.5rem', border: 'none' }} 
                disabled={isPrepping}
                onClick={() => setPrepProject(null)}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontFamily: 'var(--font-body)' }}>
              {t.prep_project_desc?.replace('{name}', prepProject.name) || `Memeriksa dependensi proyek (${prepProject.name}) sebelum dibuka di browser...`}
            </p>

            <div className="terminal-panel" style={{
              height: '200px',
              overflowY: 'auto',
              background: '#1a1a2e',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: '#10b981',
              marginBottom: '1.5rem',
              whiteSpace: 'pre-wrap'
            }}>
              {prepLogs.length === 0 ? (t.prep_waiting || "Menunggu...") : prepLogs.join('')}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                className="btn-secondary" 
                disabled={isPrepping}
                onClick={() => {
                  setPrepProject(null);
                  (window as any).api.openExternalUrl(`http://${prepProject.name}.test`);
                }}
              >
                {t.prep_skip || "Lewati & Buka Browser"}
              </button>
              <button 
                className="btn-primary" 
                disabled={isPrepping}
                onClick={async () => {
                  setIsPrepping(true);
                  setPrepLogs([]);
                  
                  // Start preparation
                  const success = await (window as any).api.prepareProjectDeps(prepProject.path);
                  
                  if (success) {
                    setPrepProject(null);
                    (window as any).api.openExternalUrl(`http://${prepProject.name}.test`);
                  } else {
                    setPrepLogs(prev => [...prev, t.prep_error || '\n\n' + (t.unknown_error || 'Error occurred. Please check the logs above.')]);
                  }
                  setIsPrepping(false);
                }}
              >
                {isPrepping ? <><Loader2 size={16} className="spin" /> {t.prep_processing || "Memproses..."}</> : (t.prep_run || "Jalankan Persiapan")}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {tunnelModal?.open && (
        <div className="modal-overlay" onClick={() => setTunnelModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{t.tunnel_active || "Tunnel Aktif 🚀"}</h3>
              <button className="btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setTunnelModal(null)}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }} dangerouslySetInnerHTML={{ __html: t.tunnel_desc?.replace('{name}', `<strong>${tunnelModal.projectName}</strong>`) || `Proyek <strong>${tunnelModal.projectName}</strong> sekarang bisa diakses secara publik. Scan QR Code di bawah dengan HP Anda.` }} />

            <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem' }}>
              <QRCodeSVG value={tunnelModal.url} size={200} />
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              {tunnelModal.url}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={() => {
                  navigator.clipboard.writeText(tunnelModal.url);
                  (window as any).api.showAlert(t.tunnel_copied || 'URL disalin ke clipboard!');
                }}
              >
                <Check size={16} /> {t.tunnel_copy || "Salin URL"}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setTunnelModal(null)}
              >
                {t.close || "Tutup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};