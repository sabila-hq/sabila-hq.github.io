import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { Send, Plus, Trash2, Clock, Globe, Key, FileText, Database, Shield, Lock, Play, Copy, Check, WrapText } from 'lucide-react';

const syntaxHighlight = (json: string) => {
  if (typeof json != 'string') json = JSON.stringify(json, undefined, 2);
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
};

interface KeyValue {
  id: string;
  key: string;
  value: string;
  active: boolean;
}

interface ApiHistory {
  id: string;
  method: string;
  url: string;
  timestamp: number;
}

export const ApiTesterPage: React.FC<{ lang?: string }> = ({ lang = 'id' }) => {
  const t = translations[lang as keyof typeof translations] || translations['id'];
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body'>('params');
  
  // Request Data
  const [params, setParams] = useState<KeyValue[]>([{ id: Date.now().toString(), key: '', value: '', active: true }]);
  const [headers, setHeaders] = useState<KeyValue[]>([{ id: Date.now().toString(), key: '', value: '', active: true }]);
  
  // Auth
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic'>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicAuth, setBasicAuth] = useState({ username: '', password: '' });

  // Body
  const [bodyType, setBodyType] = useState<'json' | 'form-data' | 'urlencoded'>('json');
  const [bodyJson, setBodyJson] = useState('{\n  \n}');
  const [bodyFormData, setBodyFormData] = useState<KeyValue[]>([{ id: Date.now().toString(), key: '', value: '', active: true }]);
  const [bodyUrlEncoded, setBodyUrlEncoded] = useState<KeyValue[]>([{ id: Date.now().toString(), key: '', value: '', active: true }]);

  // Response Data
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);

  // History
  const [history, setHistory] = useState<ApiHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // @ts-ignore
    window.api.apiTesterGetHistory().then(setHistory);
  }, []);

  const saveHistory = (newHistory: ApiHistory[]) => {
    setHistory(newHistory);
    // @ts-ignore
    window.api.apiTesterSaveHistory(newHistory);
  };

  const handleSend = async () => {
    if (!url) return;
    setLoading(true);
    setResponse(null);

    // Build Request Config
    const config: any = { method, url, headers: {}, params: {} };

    // Process Params
    params.filter(p => p.active && p.key).forEach(p => {
      config.params[p.key] = p.value;
    });

    // Process Headers
    headers.filter(h => h.active && h.key).forEach(h => {
      config.headers[h.key] = h.value;
    });

    // Process Auth
    if (authType === 'bearer' && bearerToken) {
      config.auth = { type: 'bearer', token: bearerToken };
    } else if (authType === 'basic') {
      config.auth = { type: 'basic', username: basicAuth.username, password: basicAuth.password };
    }

    // Process Body
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      config.bodyType = bodyType;
      if (bodyType === 'json') {
        try {
          config.data = bodyJson ? JSON.parse(bodyJson) : undefined;
          config.headers['Content-Type'] = 'application/json';
        } catch (e) {
          alert(t.api_json_invalid);
          setLoading(false);
          return;
        }
      } else if (bodyType === 'form-data') {
        const formData: any = {};
        bodyFormData.filter(p => p.active && p.key).forEach(p => formData[p.key] = p.value);
        config.data = formData;
      } else if (bodyType === 'urlencoded') {
        const urlEncoded: any = {};
        bodyUrlEncoded.filter(p => p.active && p.key).forEach(p => urlEncoded[p.key] = p.value);
        config.data = urlEncoded;
      }
    }

    // Send Request via IPC
    // @ts-ignore
    const res = await window.api.apiTesterRequest(config);
    setResponse(res);
    setLoading(false);

    // Update History
    const newEntry = { id: Date.now().toString(), method, url, timestamp: Date.now() };
    const updatedHistory = [newEntry, ...history.filter(h => h.url !== url || h.method !== method)].slice(0, 50);
    saveHistory(updatedHistory);
  };

  const updateKv = (setter: any, list: KeyValue[], id: string, field: keyof KeyValue, val: any) => {
    setter(list.map(item => item.id === id ? { ...item, [field]: val } : item));
    // Add empty row if last is filled
    if (field === 'key' && list[list.length - 1].id === id && val !== '') {
      setter((prev: KeyValue[]) => [...prev, { id: Date.now().toString(), key: '', value: '', active: true }]);
    }
  };

  const removeKv = (setter: any, list: KeyValue[], id: string) => {
    if (list.length === 1) {
      setter([{ id: Date.now().toString(), key: '', value: '', active: true }]);
    } else {
      setter(list.filter(item => item.id !== id));
    }
  };

  const copyToClipboard = () => {
    if (!response || !response.data) return;
    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadHistory = (h: ApiHistory) => {
    setMethod(h.method);
    setUrl(h.url);
  };

  const deleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    saveHistory(history.filter(h => h.id !== id));
  };

  const renderKvEditor = (list: KeyValue[], setter: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {list.map(item => (
        <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input 
            type="checkbox" 
            checked={item.active} 
            onChange={(e) => updateKv(setter, list, item.id, 'active', e.target.checked)}
            style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <input
            type="text"
            className="input-glass"
            placeholder="Key"
            value={item.key}
            onChange={(e) => updateKv(setter, list, item.id, 'key', e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            className="input-glass"
            placeholder="Value"
            value={item.value}
            onChange={(e) => updateKv(setter, list, item.id, 'value', e.target.value)}
            style={{ flex: 2 }}
          />
          <button 
            className="btn-secondary" 
            onClick={() => removeKv(setter, list, item.id)}
            style={{ color: 'var(--error)', padding: '0.625rem' }}
            title="Hapus baris"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 90px)', gap: '16px', color: 'var(--text-primary)' }}>
      {/* Sidebar History */}
      {showHistory && (
        <div className="glass-card" style={{ width: '250px', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-container-low)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{t.api_history}</h3>
            <button className="btn-secondary" style={{ padding: '0.5rem', color: 'var(--error)' }} onClick={() => saveHistory([])} title={t.api_history_clear}>
              <Trash2 size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '0.9rem' }}>
                {t.api_history_empty}
              </div>
            ) : (
              history.map(h => (
                <div 
                  key={h.id} 
                  style={{ 
                    padding: '8px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--outline-variant)',
                    marginBottom: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--outline-variant)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  onClick={() => loadHistory(h)}
                >
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    color: h.method === 'GET' ? '#10b981' : h.method === 'POST' ? '#3b82f6' : h.method === 'DELETE' ? '#ef4444' : '#f59e0b',
                    width: '40px'
                  }}>
                    {h.method}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.url}
                  </span>
                  <button className="btn-secondary" style={{ padding: '4px', opacity: 0.6, border: 'none', background: 'transparent' }} onClick={(e) => deleteHistory(e, h.id)} title={t.api_delete}>
                    <Trash2 size={14} color="var(--error)" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        
        {/* Header / URL Bar */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={showHistory ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setShowHistory(!showHistory)}
            title={t.api_history}
            style={{ padding: '0.625rem' }}
          >
            <Clock size={18} />
          </button>

          <select 
            className="input-glass" 
            style={{ width: '130px', fontWeight: 'bold', cursor: 'pointer' }}
            value={method}
            onChange={e => setMethod(e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          
          <input
            type="text"
            className="input-glass"
            placeholder={t.api_url_placeholder}
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          
          <button 
            className="btn-primary" 
            onClick={handleSend} 
            disabled={!url || loading}
            style={{ minWidth: '120px' }}
          >
            {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : <Send size={18} />}
            {loading ? t.api_sending : t.api_send}
          </button>
        </div>

        {/* Workspace Split */}
        <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
          
          {/* Request Config */}
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)' }}>
              <button 
                className={activeTab === 'params' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setActiveTab('params')}
                style={{ padding: '12px 20px', borderRadius: 0, border: 'none', borderBottom: activeTab === 'params' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, background: 'transparent', color: activeTab === 'params' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: 'none' }}
              >Params</button>
              <button 
                className={activeTab === 'auth' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setActiveTab('auth')}
                style={{ padding: '12px 20px', borderRadius: 0, border: 'none', borderBottom: activeTab === 'auth' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, background: 'transparent', color: activeTab === 'auth' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: 'none' }}
              >Auth</button>
              <button 
                className={activeTab === 'headers' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setActiveTab('headers')}
                style={{ padding: '12px 20px', borderRadius: 0, border: 'none', borderBottom: activeTab === 'headers' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, background: 'transparent', color: activeTab === 'headers' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: 'none' }}
              >Headers</button>
              <button 
                className={activeTab === 'body' ? 'btn-primary' : 'btn-secondary'} 
                onClick={() => setActiveTab('body')}
                style={{ padding: '12px 20px', borderRadius: 0, border: 'none', borderBottom: activeTab === 'body' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600, background: 'transparent', color: activeTab === 'body' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: 'none' }}
              >Body</button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeTab === 'params' && (
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Shield size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
                    <span dangerouslySetInnerHTML={{ __html: t.api_param_desc }}></span>
                  </div>
                  {renderKvEditor(params, setParams)}
                </div>
              )}

              {activeTab === 'headers' && (
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Globe size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} /> <span dangerouslySetInnerHTML={{ __html: t.api_header_desc }}></span>
                  </div>
                  {renderKvEditor(headers, setHeaders)}
                </div>
              )}

              {activeTab === 'auth' && (
                <div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Lock size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} /> <span dangerouslySetInnerHTML={{ __html: t.api_auth_desc }}></span>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <select className="input-glass" value={authType} onChange={e => setAuthType(e.target.value as any)} style={{ width: '200px' }}>
                      <option value="none">No Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {authType === 'bearer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.api_token_label}</label>
                      <input 
                        type="text" 
                        className="input-glass" 
                        placeholder="ey..." 
                        value={bearerToken} 
                        onChange={e => setBearerToken(e.target.value)} 
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  )}

                  {authType === 'basic' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Username</label>
                        <input type="text" className="input-glass" value={basicAuth.username} onChange={e => setBasicAuth({...basicAuth, username: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Password</label>
                        <input type="password" className="input-glass" value={basicAuth.password} onChange={e => setBasicAuth({...basicAuth, password: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'body' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={bodyType === 'json'} onChange={() => setBodyType('json')} /> JSON
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={bodyType === 'form-data'} onChange={() => setBodyType('form-data')} /> {t.api_form_data}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={bodyType === 'urlencoded'} onChange={() => setBodyType('urlencoded')} /> URL-Encoded
                      </label>
                    </div>
                  </div>

                  {bodyType === 'json' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                       <textarea 
                        className="input-glass" 
                        style={{ flex: 1, fontFamily: 'var(--font-mono)', resize: 'none', lineHeight: '1.5' }}
                        value={bodyJson}
                        onChange={e => setBodyJson(e.target.value)}
                        placeholder="{ &#34;key&#34;: &#34;value&#34; }"
                      />
                    </div>
                  )}

                  {bodyType === 'form-data' && renderKvEditor(bodyFormData, setBodyFormData)}
                  {bodyType === 'urlencoded' && renderKvEditor(bodyUrlEncoded, setBodyUrlEncoded)}
                  
                  {['GET', 'HEAD'].includes(method) && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--error-container)', borderRadius: '8px', color: 'var(--on-error-container)', fontSize: '0.85rem' }}>
                      <Shield size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} /> {t.api_body_warning}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Response Viewer */}
          <div className="terminal-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="terminal-header">
              <div style={{ fontWeight: 600, color: 'var(--primary-fixed)' }}>Response</div>
              
              {response && (
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                  <span style={{ color: response.success && response.status < 400 ? 'var(--mint-status)' : 'var(--error)', fontWeight: 'bold' }}>
                    Status: {response.status || 'Error'} {response.statusText}
                  </span>
                  <span style={{ color: 'var(--secondary-fixed-dim)' }}>
                    {t.api_time}: {response.latency} ms
                  </span>
                  <span style={{ color: 'var(--secondary-fixed-dim)' }}>
                    {t.api_size}: {(response.size / 1024).toFixed(2)} KB
                  </span>
                </div>
              )}
            </div>

            <div className="terminal-body" style={{ flex: 1, position: 'relative' }}>
              {!response && !loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'var(--secondary-fixed-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <Globe size={48} style={{ opacity: 0.5 }} />
                  <p>{t.api_response_empty}</p>
                </div>
              )}

              {loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)' }}></div>
                </div>
              )}

              {response && (
                <>
                  <div style={{ position: 'absolute', top: '12px', right: '24px', zIndex: 10, display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', color: wordWrap ? 'var(--primary-fixed)' : '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setWordWrap(!wordWrap)}
                      title="Toggle Word Wrap"
                    >
                      <WrapText size={14} /> {wordWrap ? t.api_wrap_on : t.api_wrap_off}
                    </button>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={copyToClipboard}
                    >
                      {copied ? <Check size={14} color="var(--mint-status)" /> : <Copy size={14} />} {copied ? t.api_copied : t.api_copy}
                    </button>
                  </div>
                  {response.error ? (
                    <pre style={{ margin: 0, padding: '16px', paddingTop: '48px', paddingRight: '16px', whiteSpace: wordWrap ? 'pre-wrap' : 'pre', wordBreak: wordWrap ? 'break-word' : 'normal', color: 'var(--error)' }}>
                      Error: {response.error}
                    </pre>
                  ) : typeof response.data === 'string' ? (
                    <pre style={{ margin: 0, padding: '16px', paddingTop: '48px', paddingRight: '16px', whiteSpace: wordWrap ? 'pre-wrap' : 'pre', wordBreak: wordWrap ? 'break-word' : 'normal', color: 'var(--primary-fixed)' }}>
                      {response.data}
                    </pre>
                  ) : (
                    <pre 
                      style={{ margin: 0, padding: '16px', paddingTop: '48px', paddingRight: '16px', whiteSpace: wordWrap ? 'pre-wrap' : 'pre', wordBreak: wordWrap ? 'break-word' : 'normal', color: '#e5e7eb', fontFamily: 'var(--font-mono)' }}
                      dangerouslySetInnerHTML={{ __html: syntaxHighlight(JSON.stringify(response.data, null, 2)) }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
