import React, { useState, useEffect } from 'react';

interface MailSenderPageProps {
  lang: string;
  embedded?: boolean;
}

export const MailSenderPage: React.FC<MailSenderPageProps> = ({ lang, embedded }) => {
  const [settings, setSettings] = useState<any>({});
  
  useEffect(() => {
    // @ts-ignore
    window.api.getSettings().then(setSettings);
  }, []);

  return (
    <div style={{ padding: embedded ? '1.5rem' : '2rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', maxWidth: '600px' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--brand-blue)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📧</span> {lang === 'id' ? 'Mail Sender (Relay Gmail)' : 'Mail Sender (Relay Gmail)'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {lang === 'id' 
            ? 'Teruskan email yang ditangkap (oleh fungsi mail() / port 2525) ke akun Gmail asli Anda. Email akan benar-benar terkirim!' 
            : 'Relay caught emails (via mail() / port 2525) to your real Gmail account. Emails will be actually sent!'}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gmail Account Name:</label>
            <input 
              type="email" 
              className="input-glass" 
              name="gmailAccount"
              style={{ width: '100%' }}
              placeholder="example@gmail.com"
              value={settings.mailSender?.gmailAccount || ''} 
              onChange={(e) => {
                const newSettings = { ...settings, mailSender: { ...settings.mailSender, gmailAccount: e.target.value } };
                setSettings(newSettings);
              }}
              onBlur={() => {
                // @ts-ignore
                window.api.saveSettings(settings);
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gmail App Password:</label>
            <input 
              type="password" 
              className="input-glass" 
              name="gmailPassword"
              style={{ width: '100%' }}
              placeholder="abcd efgh ijkl mnop"
              value={settings.mailSender?.gmailPassword || ''} 
              onChange={(e) => {
                const newSettings = { ...settings, mailSender: { ...settings.mailSender, gmailPassword: e.target.value } };
                setSettings(newSettings);
              }}
              onBlur={() => {
                // @ts-ignore
                window.api.saveSettings(settings);
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {lang === 'id' ? 'Gunakan App Password dari pengaturan keamanan Google Anda, bukan password utama.' : 'Use an App Password from your Google security settings, not your main password.'}
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input 
              type="checkbox" 
              style={{ accentColor: 'var(--brand-blue)', width: '16px', height: '16px', cursor: 'pointer' }}
              checked={settings.mailSender?.enabled || false}
              onChange={(e) => {
                const newSettings = { ...settings, mailSender: { ...settings.mailSender, enabled: e.target.checked } };
                setSettings(newSettings);
                // @ts-ignore
                window.api.saveSettings(newSettings);
              }}
            />
            <label style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              {lang === 'id' ? 'Enabled (Aktifkan Pengiriman Email)' : 'Enabled (Activate Email Sending)'}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
