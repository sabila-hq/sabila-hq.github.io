import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, Database, Layout, FolderOpen } from 'lucide-react';
import { translations } from '../translations';

interface SettingsProps {
  onSettingsChange?: (settings: any) => void;
  lang?: string;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsChange, lang = 'en' }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;

  const [settings, setSettings] = useState<any>({
    aiProvider: 'deepseek',
    aiBaseUrl: 'https://api.deepseek.com/v1',
    aiApiKey: '',
    aiModel: 'deepseek-chat',
    language: 'id',
    docRootName: 'www',
    theme: 'dark'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isRenamingDocRoot, setIsRenamingDocRoot] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, any>>({});
  const [ports, setPorts] = useState<Record<string, string>>({});
  const [sslPorts, setSslPorts] = useState<Record<string, string>>({});
  const [sslEnabledStates, setSslEnabledStates] = useState<Record<string, boolean>>({});
  const [dashboardItems, setDashboardItems] = useState<string[]>([]);

  useEffect(() => {
    // @ts-ignore
    window.api.getSettings().then((data) => {
      if (data) {
        setSettings((prev: any) => ({ ...prev, ...data }));
      }
    });

    // @ts-ignore
    window.api.getDashboardItems().then((items: string[]) => {
      setDashboardItems(items);
    });

    // @ts-ignore
    window.api.getServices().then((statuses: any) => {
      setServiceStatuses(statuses);
      const newPorts: Record<string, string> = {};
      const newSslPorts: Record<string, string> = {};
      const newSslEnabled: Record<string, boolean> = {};
      Object.keys(statuses).forEach(key => {
        if (statuses[key].port) newPorts[key] = statuses[key].port.toString();
        if (statuses[key].sslPort) newSslPorts[key] = statuses[key].sslPort.toString();
        if (statuses[key].sslEnabled !== undefined) newSslEnabled[key] = statuses[key].sslEnabled;
      });
      setPorts(newPorts);
      setSslPorts(newSslPorts);
      setSslEnabledStates(newSslEnabled);
    });

    const handleScrollToSection = (e: any) => {
      if (e.detail?.id) {
        const el = document.getElementById(e.detail.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    window.addEventListener('scroll-to-section', handleScrollToSection);

    return () => {
      window.removeEventListener('scroll-to-section', handleScrollToSection);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newSettings = { ...settings, [name]: value };
    setSettings(newSettings);

    // Auto-apply UI changes immediately for real-time effect
    if (name === 'theme' || name === 'language') {
      if (onSettingsChange) {
        onSettingsChange(newSettings);
      }
      // @ts-ignore
      window.api.saveSettings(newSettings);
    }
  };

  const handleDocRootChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    const oldName = settings.docRootName;
    if (newName === oldName) return;

    setIsRenamingDocRoot(true);
    const newSettings = { ...settings, docRootName: newName };
    setSettings(newSettings);

    try {
      // @ts-ignore
      const res = await window.api.renameDocRoot(newName);
      if (res.success) {
        // @ts-ignore
        await window.api.saveSettings(newSettings);
        if (onSettingsChange) onSettingsChange(newSettings);
        // @ts-ignore
        if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Berhasil mengganti nama folder menjadi ${newName}` : `Successfully renamed folder to ${newName}`);
      } else {
        // Revert UI on failure
        setSettings({ ...settings, docRootName: oldName });
        // @ts-ignore
        if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Gagal mengganti nama folder: ${res.error}` : `Failed to rename folder: ${res.error}`);
      }
    } catch (error: any) {
      setSettings({ ...settings, docRootName: oldName });
      // @ts-ignore
      if (window.api.showAlert) window.api.showAlert(`Error: ${error.message}`);
    }
    setIsRenamingDocRoot(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // @ts-ignore
    await window.api.saveSettings(settings);
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
    // @ts-ignore
    if (window.api.showAlert) window.api.showAlert(lang === 'id' ? 'Pengaturan berhasil disimpan!' : 'Settings saved successfully!');
    else alert(lang === 'id' ? 'Pengaturan berhasil disimpan!' : 'Settings saved successfully!');
    setTimeout(() => setIsSaving(false), 1500);
  };

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const handleTestConnection = async () => {
    if (!settings.aiBaseUrl || !settings.aiApiKey) {
      // @ts-ignore
      if (window.api.showAlert) window.api.showAlert(lang === 'id' ? 'Base URL dan API Key harus diisi' : 'Base URL and API Key are required');
      else alert(lang === 'id' ? 'Base URL dan API Key harus diisi' : 'Base URL and API Key are required');
      return;
    }
    setConnectionStatus('testing');
    try {
      // @ts-ignore
      const res = await window.api.testAiConnection(settings.aiBaseUrl, settings.aiApiKey);
      if (res.ok) {
        setConnectionStatus('success');
        // @ts-ignore
        if (window.api.showAlert) window.api.showAlert(lang === 'id' ? 'Koneksi Berhasil: API Key valid dan terhubung ke server.' : 'Connection Successful: API Key is valid and connected to server.');
      } else {
        setConnectionStatus('failed');
        // @ts-ignore
        if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Koneksi Gagal: Server mengembalikan status ${res.status}. Pastikan API Key valid.` : `Connection Failed: Server returned status ${res.status}. Make sure API Key is valid.`);
      }
    } catch (e: any) {
      setConnectionStatus('failed');
      // @ts-ignore
      if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Koneksi Error: ${e.message}` : `Connection Error: ${e.message}`);
    }
    setTimeout(() => setConnectionStatus('idle'), 4000);
  };

  return (
    <div className="page-container scrollable" style={{ padding: '0 0.5rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--on-surface)', fontWeight: 800 }}>⚙️ {t.settings}</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{t.settings_desc}</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={handleSave} 
          disabled={isSaving}
          style={{ minWidth: '150px', justifyContent: 'center' }}
        >
          {isSaving ? <ShieldCheck size={16} /> : <Save size={16} />} 
          {isSaving ? t.saved : t.save}
        </button>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        
        {/* AI Configuration */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>
            <ShieldCheck size={20} color="var(--primary)" /> {t.ai_provider_config}
          </h3>
          
          <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.provider}</label>
              <select 
                className="input-glass" 
                name="aiProvider"
                value={settings.aiProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  let newBaseUrl = settings.aiBaseUrl;
                  let newModel = settings.aiModel;
                  if (val === 'openai') { newBaseUrl = 'https://api.openai.com/v1'; newModel = 'gpt-4o-mini'; }
                  if (val === 'deepseek') { newBaseUrl = 'https://api.deepseek.com/v1'; newModel = 'deepseek-chat'; }
                  if (val === 'gemini') { newBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; newModel = 'gemini-2.5-flash'; }
                  if (val === 'groq') { newBaseUrl = 'https://api.groq.com/openai/v1'; newModel = 'llama-3.3-70b-versatile'; }
                  if (val === 'openrouter') { newBaseUrl = 'https://openrouter.ai/api/v1'; newModel = 'anthropic/claude-3-haiku'; }
                  if (val === 'sumopod') { newBaseUrl = 'https://ai.sumopod.com/v1'; newModel = 'gpt-4o-mini'; }
                  if (val === 'moonshot') { newBaseUrl = 'https://api.moonshot.cn/v1'; newModel = 'moonshot-v1-8k'; }
                  if (val === 'qwen') { newBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'; newModel = 'qwen-plus'; }
                  if (val === 'anthropic') { newBaseUrl = 'https://api.anthropic.com/v1'; newModel = 'claude-3-5-sonnet-20241022'; }
                  
                  const newSettings = { ...settings, aiProvider: val, aiBaseUrl: newBaseUrl, aiModel: newModel };
                  setSettings(newSettings);
                }}
                style={{ appearance: 'auto', background: 'var(--surface-container-low)', fontFamily: 'var(--font-body)' }}
              >
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Gemini (OpenAI Compatible)</option>
                <option value="groq">Groq Console</option>
                <option value="openrouter">OpenRouter</option>
                <option value="sumopod">Sumopod</option>
                <option value="moonshot">Kimi (Moonshot)</option>
                <option value="qwen">Qwen (DashScope)</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="custom">Custom Endpoint</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.base_url}</label>
              <input type="text" name="aiBaseUrl" className="input-glass" value={settings.aiBaseUrl} onChange={handleChange} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.api_key}</label>
              <input type="password" name="aiApiKey" className="input-glass" placeholder="sk-..." value={settings.aiApiKey} onChange={handleChange} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontFamily: 'var(--font-body)' }}>{t.api_key_desc}</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.default_model}</label>
              <input type="text" name="aiModel" className="input-glass" value={settings.aiModel} onChange={handleChange} />
            </div>
            
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className="btn-secondary" onClick={handleTestConnection} disabled={connectionStatus === 'testing'}>
                {connectionStatus === 'testing' ? (lang === 'id' ? 'Menguji...' : 'Testing...') : t.test_connection}
              </button>
              {connectionStatus === 'success' && <span style={{ color: 'var(--status-running)', fontSize: '0.85rem' }}>✔️ {lang === 'id' ? 'Koneksi Berhasil' : 'Connection Successful'}</span>}
              {connectionStatus === 'failed' && <span style={{ color: 'var(--status-stopped)', fontSize: '0.85rem' }}>❌ {lang === 'id' ? 'Koneksi Gagal' : 'Connection Failed'}</span>}
            </div>
          </div>
        </div>

        {/* General Preferences */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>
            <Layout size={20} color="var(--primary)" /> {t.general_prefs}
          </h3>
          
          <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.language}</label>
              <select name="language" className="input-glass" style={{ appearance: 'auto', background: 'var(--surface-container-low)', fontFamily: 'var(--font-body)' }} value={settings.language} onChange={handleChange}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
                <option value="su">Basa Sunda</option>
                <option value="jv">Basa Jawa</option>
                <option value="ar">العربية (Arabic)</option>
                <option value="zh">中文 (Mandarin)</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.theme}</label>
              <select name="theme" className="input-glass" style={{ appearance: 'auto', background: 'var(--surface-container-low)', fontFamily: 'var(--font-body)' }} value={settings.theme} onChange={handleChange}>
                <option value="dark">{t.dark_mode}</option>
                <option value="light">{t.light_mode}</option>
              </select>
            </div>

          </div>
        </div>

        {/* Document Root Management */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>
            <FolderOpen size={20} color="var(--primary)" /> {t.doc_root_management}
          </h3>
          
          <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.doc_root_name}</label>
              <select 
                name="docRootName" 
                className="input-glass" 
                style={{ appearance: 'auto', background: 'var(--surface-container-low)', fontFamily: 'var(--font-body)', opacity: isRenamingDocRoot ? 0.5 : 1 }} 
                value={settings.docRootName} 
                onChange={handleDocRootChange}
                disabled={isRenamingDocRoot}
              >
                <option value="www">www (Default Laragon)</option>
                <option value="htdocs">htdocs (Default XAMPP)</option>
              </select>
              {isRenamingDocRoot && (
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)' }}>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                  Sedang memproses... (Menghentikan services & merename folder)
                </div>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
