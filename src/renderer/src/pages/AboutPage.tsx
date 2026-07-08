import React, { useState, useEffect } from 'react';
import { Info, Shield, Github, Heart, ExternalLink, Monitor, HardDrive, Network, Terminal, Clipboard, FileText, Globe, Coffee } from 'lucide-react';
import { translations } from '../translations';

interface AboutPageProps {
  lang?: string;
}

export const AboutPage: React.FC<AboutPageProps> = ({ lang = 'id' }) => {
  const [aboutInfo, setAboutInfo] = useState<any>(null);

  const t = translations[lang as keyof typeof translations] || translations.en;

  useEffect(() => {
    // @ts-ignore
    window.api.getAboutInfo().then(setAboutInfo);
  }, []);

  if (!aboutInfo) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>;

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
    borderRadius: '12px', padding: '1.25rem'
  };

  const permIcons = [FileText, Network, Terminal, Monitor, Clipboard];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Info className="icon-blue" /> {t.about_title || 'Tentang Sabila'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>{t.about_desc || 'Informasi lengkap tentang aplikasi ini.'}</p>
      </div>

      {/* App Info */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>S</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{aboutInfo.appName}</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.about_version || 'Versi'} {aboutInfo.version}</span>
          </div>
        </div>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
          {aboutInfo.description}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Electron', value: aboutInfo.electron },
            { label: 'Chromium', value: aboutInfo.chrome },
            { label: 'Node.js', value: aboutInfo.node },
            { label: 'V8 Engine', value: aboutInfo.v8 },
            { label: 'Platform', value: aboutInfo.os },
            { label: t.about_license || 'Lisensi', value: aboutInfo.license },
          ].map((item, i) => (
            <div key={i} style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-accent)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
          <Shield size={18} className="icon-blue" /> {t.about_permissions || 'Izin Aplikasi'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {aboutInfo.permissions.map((perm: string, i: number) => {
            const Icon = permIcons[i] || Shield;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem', background: 'var(--bg-accent)', borderRadius: '8px' }}>
                <Icon size={16} color="var(--brand-blue)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{perm}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official & Donation */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
          <Heart size={18} className="icon-blue" color="#ef4444" /> {t.about_support || 'Dukung Sabila'}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {t.about_support_desc || 'Sabila akan selalu gratis. Namun, dukungan Anda sangat berarti untuk menutupi biaya server dan pengembangan lebih lanjut. Kunjungi situs resmi kami untuk berdonasi atau melihat dokumentasi lengkap.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            // @ts-ignore
            onClick={() => { if(window.api && window.api.openExternalUrl) window.api.openExternalUrl('https://trakteer.id/sabila-hq'); else window.open('https://trakteer.id/sabila-hq', '_blank'); }}
          >
            <Coffee size={16} /> {t.about_official_site || 'Traktir Kopi ☕'}
          </button>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--bg-accent)' }}
            // @ts-ignore
            onClick={() => { if(window.api && window.api.openExternalUrl) window.api.openExternalUrl('https://github.com/sabila-hq/sabila-hq.github.io'); else window.open('https://github.com/sabila-hq/sabila-hq.github.io', '_blank'); }}
          >
            <Github size={16} /> {t.about_github || 'GitHub Sabila HQ'}
          </button>
        </div>
      </div>

      {/* Credits */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Heart size={16} color="#ef4444" /> {t.about_credits || 'Dibuat dengan cinta untuk para pengembang pemula Indonesia'}
        </div>
      </div>
    </div>
  );
};
