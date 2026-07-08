import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';

interface ServicePortsPageProps {
  lang: string;
  embedded?: boolean;
}

export const ServicePortsPage: React.FC<ServicePortsPageProps> = ({ lang, embedded }) => {
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, any>>({});
  const [ports, setPorts] = useState<Record<string, string>>({});
  const [sslPorts, setSslPorts] = useState<Record<string, string>>({});
  const [sslEnabledStates, setSslEnabledStates] = useState<Record<string, boolean>>({});
  const [dashboardItems, setDashboardItems] = useState<string[]>([]);

  useEffect(() => {
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
  }, []);

  return (
    <div style={{ padding: embedded ? '1.5rem' : '2rem' }}>
      <div id="service-ports-config" className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Database size={20} color="var(--status-running)" /> {lang === 'id' ? 'Konfigurasi Port Layanan' : 'Service Ports Configuration'}
        </h3>
        <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
          {Object.keys(serviceStatuses).filter(key => serviceStatuses[key].isInstalled && serviceStatuses[key].port).map(key => {
            const showSsl = key === 'apache' || key === 'nginx';
            const isEnabled = dashboardItems.includes(key);
            
            const handlePortSave = async (newPortStr: string) => {
              const newPort = parseInt(newPortStr);
              if (newPort && newPort !== serviceStatuses[key].port) {
                // @ts-ignore
                const res = await window.api.setServicePort(key, newPort);
                if (res.success) {
                  // @ts-ignore
                  window.api.getServices().then((st: any) => {
                    setServiceStatuses(st);
                    setPorts(prev => ({...prev, [key]: st[key].port.toString()}));
                  });
                } else {
                  // @ts-ignore
                  if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Gagal mengubah port: ${res.error}` : `Failed to change port: ${res.error}`);
                  else alert(lang === 'id' ? `Gagal mengubah port: ${res.error}` : `Failed to change port: ${res.error}`);
                  setPorts(prev => ({...prev, [key]: serviceStatuses[key].port.toString()}));
                }
              }
            };

            const handleSslSave = async (newSslEnabled: boolean, newSslPortStr: string) => {
              const newSslPort = parseInt(newSslPortStr);
              if (newSslPort && (newSslPort !== serviceStatuses[key].sslPort || newSslEnabled !== serviceStatuses[key].sslEnabled)) {
                // @ts-ignore
                const resSsl = await window.api.setServiceSsl(key, newSslEnabled, newSslPort);
                if (resSsl.success) {
                  // @ts-ignore
                  window.api.getServices().then((st: any) => {
                    setServiceStatuses(st);
                    setSslPorts(prev => ({...prev, [key]: st[key].sslPort.toString()}));
                    setSslEnabledStates(prev => ({...prev, [key]: st[key].sslEnabled}));
                  });
                } else {
                  // @ts-ignore
                  if (window.api.showAlert) window.api.showAlert(lang === 'id' ? `Gagal mengubah SSL: ${resSsl.error}` : `Failed to change SSL: ${resSsl.error}`);
                  else alert(lang === 'id' ? `Gagal mengubah SSL: ${resSsl.error}` : `Failed to change SSL: ${resSsl.error}`);
                  setSslPorts(prev => ({...prev, [key]: serviceStatuses[key].sslPort.toString()}));
                  setSslEnabledStates(prev => ({...prev, [key]: serviceStatuses[key].sslEnabled}));
                }
              }
            };

            const handleDashboardToggle = (checked: boolean) => {
              let newItems = [...dashboardItems];
              if (checked && !newItems.includes(key)) {
                newItems.push(key);
              } else if (!checked && newItems.includes(key)) {
                newItems = newItems.filter(id => id !== key);
              }
              setDashboardItems(newItems);
              // @ts-ignore
              window.api.setDashboardItems(newItems);
            };

            return (
              <div key={key} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                    <input 
                      type="checkbox" 
                      style={{ accentColor: 'var(--brand-blue)', width: '16px', height: '16px', cursor: 'pointer' }}
                      checked={isEnabled}
                      onChange={e => handleDashboardToggle(e.target.checked)}
                    />
                    <label style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>{serviceStatuses[key].name}:</label>
                  </div>
                  <input 
                    type="number" 
                    className="input-glass" 
                    style={{ width: '80px', padding: '0.4rem 0.8rem', opacity: isEnabled ? 1 : 0.5 }}
                    value={ports[key] || ''} 
                    disabled={!isEnabled}
                    onChange={e => setPorts({...ports, [key]: e.target.value})}
                    onBlur={e => handlePortSave(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handlePortSave(e.currentTarget.value) }}
                  />
                  
                  {showSsl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-color)', opacity: isEnabled ? 1 : 0.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>SSL:</span>
                      <input 
                        type="number" 
                        className="input-glass" 
                        style={{ width: '80px', padding: '0.4rem 0.8rem', opacity: sslEnabledStates[key] ? 1 : 0.5 }}
                        value={sslPorts[key] || ''}
                        disabled={!isEnabled || !sslEnabledStates[key]}
                        onChange={e => setSslPorts({...sslPorts, [key]: e.target.value})}
                        onBlur={e => handleSslSave(sslEnabledStates[key], e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSslSave(sslEnabledStates[key], e.currentTarget.value) }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', cursor: isEnabled ? 'pointer' : 'default' }}>
                        <input 
                          type="checkbox" 
                          style={{ accentColor: 'var(--brand-blue)', width: '16px', height: '16px', cursor: isEnabled ? 'pointer' : 'default' }}
                          checked={sslEnabledStates[key] || false}
                          disabled={!isEnabled}
                          onChange={e => {
                            const checked = e.target.checked;
                            setSslEnabledStates({...sslEnabledStates, [key]: checked});
                            handleSslSave(checked, sslPorts[key]);
                          }}
                        />
                        Enabled
                      </label>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {Object.keys(serviceStatuses).filter(key => serviceStatuses[key].isInstalled && serviceStatuses[key].port).length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>{lang === 'id' ? 'Tidak ada layanan yang menggunakan port.' : 'No services with port available.'}</p>
          )}
        </div>
      </div>
    </div>
  );
};
