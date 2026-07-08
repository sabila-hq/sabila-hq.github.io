import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Settings2, Code, Globe, Lock, ShieldAlert, CheckCircle, AlertTriangle, Info, Key, Plus, Trash2 } from 'lucide-react';
import { translations } from '../translations';

interface ProjectConfigModalProps {
  projectPath: string;
  projectName: string;
  onClose: () => void;
  lang: string;
}

interface EnvVars {
  [key: string]: string;
}

export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({ projectPath, projectName, onClose, lang }) => {
  const t = (translations as any)[lang] || translations.id;
  const [activeTab, setActiveTab] = useState<'env' | 'htaccess' | 'ssl' | 'runtime' | 'delete' | 'security' | 'secrets'>('env');
  const [envContent, setEnvContent] = useState('');
  const [htaccessContent, setHtaccessContent] = useState('');
  const [envVars, setEnvVars] = useState<EnvVars>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState({ http: '', https: '' });
  const [sslLoading, setSslLoading] = useState(false);
  const [phpVersions, setPhpVersions] = useState<string[]>([]);
  const [selectedPhp, setSelectedPhp] = useState<string>('');
  const [nodeVersions, setNodeVersions] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [loadingPhp, setLoadingPhp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [securityResults, setSecurityResults] = useState<any[] | null>(null);
  const [scanningSecurity, setScanningSecurity] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');

  useEffect(() => {
    loadConfig();
    loadUrls();
    loadPhpVersions();
    loadNodeVersions();
    loadSecrets();
  }, [projectPath]);

  const loadSecrets = async () => {
    try {
      const data = await (window as any).api.getProjectSecrets(projectName);
      setSecrets(data || {});
    } catch (e) {
      console.error(e);
    }
  };

  const loadNodeVersions = async () => {
    try {
      const versions = await (window as any).api.getNodeVersions();
      setNodeVersions(versions);
      const current = await (window as any).api.getProjectNodeVersion(projectName);
      setSelectedNode(current || '');
    } catch (e) {
      console.error(e);
    }
  };

  const loadPhpVersions = async () => {
    try {
      const versions = await (window as any).api.getPhpVersions();
      setPhpVersions(versions);
      const current = await (window as any).api.getProjectPhpVersion(projectName);
      setSelectedPhp(current || '');
    } catch (e) {
      console.error(e);
    }
  };

  const loadUrls = async () => {
    try {
      const result = await (window as any).api.getProjectUrls(projectName);
      setUrls(result);
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await (window as any).api.projectEnvGet(projectPath);
      setEnvContent(data.env);
      setHtaccessContent(data.htaccess);
      parseEnv(data.env);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const parseEnv = (content: string) => {
    const lines = content.split('\n');
    const vars: EnvVars = {};
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        vars[match[1].trim()] = match[2].trim();
      }
    }
    setEnvVars(vars);
  };

  const updateEnvVar = (key: string, value: string) => {
    setEnvVars(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = async () => {
    setSaving(true);
    
    // Reconstruct env string
    let newEnvContent = envContent;
    if (activeTab === 'env') {
      const lines = envContent.split('\n');
      const updatedLines = [];
      const seenKeys = new Set<string>();
      
      for (const line of lines) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          seenKeys.add(key);
          updatedLines.push(`${key}=${envVars[key]}`);
        } else {
          updatedLines.push(line);
        }
      }
      
      // Add new keys if any (though UI currently only edits existing keys)
      for (const key in envVars) {
        if (!seenKeys.has(key)) {
          updatedLines.push(`${key}=${envVars[key]}`);
        }
      }
      newEnvContent = updatedLines.join('\n');
    }

    try {
      if (activeTab === 'env') {
        await (window as any).api.projectEnvSet(projectPath, 'env', newEnvContent);
        setEnvContent(newEnvContent);
      } else if (activeTab === 'htaccess') {
        await (window as any).api.projectEnvSet(projectPath, 'htaccess', htaccessContent);
      } else if (activeTab === 'runtime') {
        await (window as any).api.setProjectPhpVersion(projectName, selectedPhp);
        await (window as any).api.setProjectNodeVersion(projectName, selectedNode);
      } else if (activeTab === 'secrets') {
        await (window as any).api.setProjectSecrets(projectName, secrets);
      }
      // Show saved alert via API
      await (window as any).api.showAlert(t.save_success);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const enableSsl = async () => {
    setSslLoading(true);
    try {
      const res = await (window as any).api.projectEnableSsl(projectName);
      if (res.success) {
        await (window as any).api.showAlert(t.ssl_success);
      } else {
        await (window as any).api.showAlert(`${t.ssl_failed} ${res.error}`);
      }
    } catch (e) {
      console.error(e);
    }
    setSslLoading(false);
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      const res = await (window as any).api.deleteProject(projectName, projectPath);
      if (res.success) {
        await (window as any).api.showAlert(t.delete_success);
        onClose();
        // Since we don't have direct access to loadProjects from the parent here, 
        // the user will need to refresh the page or we could trigger a custom event.
        // A simple page reload is sufficient for now, or just closing the modal.
        window.location.reload(); 
      } else {
        await (window as any).api.showAlert(`${t.delete_failed} ${res.error}`);
      }
    } catch (e: any) {
      await (window as any).api.showAlert(`${t.delete_failed} ${e.message}`);
    }
    setDeleting(false);
  };

  const runSecurityScan = async () => {
    setScanningSecurity(true);
    setSecurityResults(null);
    try {
      const res = await (window as any).api.scanProjectSecurity(projectPath);
      if (res.success) {
        setSecurityResults(res.result.issues);
      } else {
        await (window as any).api.showAlert(`${t.scan_failed} ${res.error}`);
      }
    } catch (e: any) {
      console.error(e);
      await (window as any).api.showAlert(`${t.scan_failed} ${e.message}`);
    }
    setScanningSecurity(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '2rem'
    }}>
      <div style={{
        width: '100%', maxWidth: '1100px', height: '100%', maxHeight: '75vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'var(--bg-primary)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '24px',
        boxShadow: '0 24px 40px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--glass-border)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--outline-variant)' }}>
              <Settings2 size={20} className="icon-blue" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600 }}>{t.config_title}</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{projectName}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface-container)', border: '1px solid var(--outline-variant)',
            width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)'
          }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
            <X size={18} />
          </button>
        </div>

        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--glass-border)', 
          padding: '0.75rem 1.75rem',
          gap: '0.5rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          background: 'rgba(0,0,0,0.02)'
        }}>
          {[
            { id: 'env', icon: Settings2, label: 'Environment (.env)' },
            { id: 'htaccess', icon: Code, label: '.htaccess' },
            { id: 'ssl', icon: Lock, label: 'Domain & SSL' },
            { id: 'runtime', icon: Code, label: 'Runtime Config' },
            { id: 'secrets', icon: Key, label: 'Secret Manager' },
            { id: 'security', icon: Shield, label: 'Security Shield' }
          ].map(tab => (
            <button 
              key={tab.id}
              // @ts-ignore
              onClick={() => setActiveTab(tab.id)}
              style={{ 
                padding: '0.5rem 1rem', border: 'none', cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--primary-fixed)' : 'transparent',
                color: activeTab === tab.id ? 'var(--on-primary-fixed)' : 'var(--text-secondary)',
                borderRadius: '8px',
                fontWeight: activeTab === tab.id ? 600 : 500, 
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--surface-container)' }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent' }}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
          
          <button 
            onClick={() => setActiveTab('delete')}
            style={{ 
              padding: '0.5rem 1rem', border: '1px solid transparent', cursor: 'pointer',
              background: activeTab === 'delete' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              color: activeTab === 'delete' ? 'var(--status-error)' : 'var(--text-secondary)',
              borderRadius: '8px',
              fontWeight: activeTab === 'delete' ? 600 : 500, 
              display: 'flex', gap: '0.5rem', alignItems: 'center',
              marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { if (activeTab !== 'delete') { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; e.currentTarget.style.color = 'var(--status-error)' } }}
            onMouseLeave={(e) => { if (activeTab !== 'delete') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
          >
            <X size={16} /> {t.tab_delete}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {activeTab === 'env' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                  {Object.keys(envVars).length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Settings2 size={32} opacity={0.5} />
                      </div>
                      <p>{t.env_empty}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
                      {Object.keys(envVars).map(key => (
                        <div key={key} className="glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                          <label style={{ width: '220px', minWidth: '220px', fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={key}>
                            {key}
                          </label>
                          <input 
                            className="input-glass"
                            style={{ flex: 1, fontFamily: 'monospace', padding: '0.5rem 0.75rem' }}
                            value={envVars[key]}
                            onChange={(e) => updateEnvVar(key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'htaccess' && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <textarea 
                    className="input-glass"
                    style={{ flex: 1, fontFamily: 'monospace', resize: 'none', padding: '1.25rem', whiteSpace: 'pre', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)' }}
                    value={htaccessContent}
                    onChange={(e) => setHtaccessContent(e.target.value)}
                    placeholder="# Masukkan konfigurasi .htaccess disini..."
                  />
                </div>
              )}

              {activeTab === 'ssl' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Globe size={20} color="var(--brand-blue)" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>HTTP URL</h3>
                        <a href={urls.http} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{urls.http}</a>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={20} color="var(--status-running)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>HTTPS URL (SSL)</h3>
                        <a href={urls.https} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{urls.https}</a>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={enableSsl} 
                        disabled={sslLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        {sslLoading ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : <Shield size={16} />}
                        {t.ssl_enable}
                      </button>
                    </div>
                  </div>
                  <div className="alert alert-info" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <Shield size={20} color="var(--brand-blue)" />
                    <div>
                      <strong>{t.ssl_info_title}</strong> {t.ssl_info_desc}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'runtime' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>{t.runtime_title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                      {t.runtime_desc}
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t.php_version}</label>
                        <select
                          className="input-glass"
                          value={selectedPhp}
                          onChange={(e) => setSelectedPhp(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', appearance: 'auto' }}
                        >
                          <option value="">{t.php_default}</option>
                          {phpVersions.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t.node_version}</label>
                        <select
                          className="input-glass"
                          value={selectedNode}
                          onChange={(e) => setSelectedNode(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', appearance: 'auto' }}
                        >
                          <option value="">{t.node_default}</option>
                          {nodeVersions.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert alert-info" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <Settings2 size={20} color="var(--brand-blue)" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>{t.runtime_info}</strong> {t.runtime_info_desc}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'secrets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Key size={20} color="var(--brand-blue)" /> Secret Manager
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                          {t.secret_desc}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="KEY (contoh: STRIPE_SECRET_KEY)" 
                        className="input-glass" 
                        style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace' }}
                        value={newSecretKey}
                        onChange={e => setNewSecretKey(e.target.value)}
                      />
                      <input 
                        type="password" 
                        placeholder="VALUE (contoh: sk_test_...)" 
                        className="input-glass" 
                        style={{ flex: 2, padding: '0.5rem', fontFamily: 'monospace' }}
                        value={newSecretValue}
                        onChange={e => setNewSecretValue(e.target.value)}
                      />
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.5rem 1rem' }}
                        onClick={() => {
                          if (newSecretKey && newSecretValue) {
                            setSecrets(prev => ({ ...prev, [newSecretKey]: newSecretValue }));
                            setNewSecretKey('');
                            setNewSecretValue('');
                          }
                        }}
                      >
                        <Plus size={16} /> {t.add}
                      </button>
                    </div>

                    {Object.keys(secrets).length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        {t.secret_empty}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.entries(secrets).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{key}</span>
                              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {'*'.repeat(Math.min(val.length, 12))}
                              </span>
                            </div>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.3rem', color: '#ef4444' }}
                              onClick={() => {
                                const s = { ...secrets };
                                delete s[key];
                                setSecrets(s);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Shield size={20} color="var(--brand-blue)" /> {t.security_title}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                          {t.security_desc}
                        </p>
                      </div>
                      <button 
                        className="btn-primary" 
                        onClick={runSecurityScan} 
                        disabled={scanningSecurity}
                      >
                        {scanningSecurity ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : <Shield size={16} />}
                        <span style={{ marginLeft: '0.5rem' }}>{t.scan_start}</span>
                      </button>
                    </div>

                    {securityResults && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {securityResults.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle size={48} color="var(--status-running)" style={{ marginBottom: '1rem' }} />
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--status-running)' }}>{t.scan_safe}</h4>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t.scan_safe_desc}</p>
                          </div>
                        ) : (
                          securityResults.map((issue, idx) => (
                            <div key={idx} style={{ 
                              padding: '1.25rem', 
                              background: issue.severity === 'critical' ? 'rgba(239, 68, 68, 0.05)' : (issue.severity === 'high' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(59, 130, 246, 0.05)'), 
                              border: `1px solid ${issue.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : (issue.severity === 'high' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)')}`,
                              borderRadius: '12px',
                              display: 'flex',
                              gap: '1rem'
                            }}>
                              <div style={{ flexShrink: 0, marginTop: '0.2rem' }}>
                                {issue.severity === 'critical' ? (
                                  <ShieldAlert size={24} color="var(--status-error)" />
                                ) : issue.severity === 'high' ? (
                                  <AlertTriangle size={24} color="var(--status-warning)" />
                                ) : (
                                  <Info size={24} color="var(--brand-blue)" />
                                )}
                              </div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '1rem', color: issue.severity === 'critical' ? 'var(--status-error)' : (issue.severity === 'high' ? 'var(--status-warning)' : 'var(--text-primary)') }}>
                                    {issue.type}
                                  </h4>
                                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    {issue.severity}
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', lineHeight: '1.4' }}>
                                  {issue.description}
                                </p>
                                <div style={{ fontSize: '0.85rem', background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--brand-blue)' }}>
                                  <strong>{t.scan_suggestion}</strong> {issue.suggestion}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                  {t.scan_file} <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{issue.file}</code> {issue.line > 0 && `(Line: ${issue.line})`}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'delete' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--status-error)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: 'var(--status-error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Shield size={20} /> {t.delete_danger}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                      {t.delete_desc1} <code>{projectPath}</code>, {t.delete_desc2}
                      <br /><br />
                      {t.delete_desc3}
                    </p>
                    
                    <button 
                      className="btn-primary" 
                      onClick={deleteProject}
                      disabled={deleting}
                      style={{ 
                        background: 'var(--status-error)', 
                        color: 'white', 
                        width: '100%', 
                        padding: '1rem', 
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {deleting ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'white', borderTopColor: 'transparent' }}></div> : <X size={20} />}
                      {t.delete_confirm} "{projectName}" {t.delete_permanent}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {activeTab !== 'ssl' && activeTab !== 'delete' && activeTab !== 'security' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.25rem 1.75rem', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.02)' }}>
            <button className="btn-secondary" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={onClose} disabled={saving}>{t.btn_cancel}</button>
            <button className="btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px' }} onClick={saveConfig} disabled={saving || loading}>
              {saving ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : <Save size={16} style={{ marginRight: '0.5rem' }} />}
              {t.btn_save}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
