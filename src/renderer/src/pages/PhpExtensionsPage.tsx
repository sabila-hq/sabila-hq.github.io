import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { ToggleRight, ToggleLeft, RefreshCw, Settings2, Search, Zap } from 'lucide-react';

interface PhpExtension {
  name: string;
  enabled: boolean;
}

const extensionDescriptions: Record<string, string> = {
  'bz2': 'Kompresi file bzip2',
  'curl': 'Koneksi HTTP/API eksternal',
  'ffi': 'Memanggil kode C dari PHP (Foreign Function Interface)',
  'ftp': 'Akses ke server FTP',
  'fileinfo': 'Deteksi tipe MIME dan encoding file',
  'gd': 'Manipulasi gambar (dibutuhkan banyak CMS)',
  'gd2': 'Ekstensi tambahan PHP (Manipulasi gambar GD)',
  'gettext': 'Dukungan translasi multi-bahasa',
  'gmp': 'Perhitungan angka sangat besar',
  'intl': 'Internasionalisasi (wajib untuk CodeIgniter 4)',
  'imap': 'Membaca kotak masuk email (IMAP/POP3)',
  'ldap': 'Koneksi ke Active Directory/LDAP',
  'mbstring': 'Mendukung karakter teks non-latin (wajib Laravel)',
  'exif': 'Membaca metadata/info foto digital',
  'mysqli': 'Driver utama database MySQL',
  'openssl': 'Fungsi enkripsi dan akses HTTPS',
  'pdo_mysql': 'Driver PDO untuk MySQL (wajib untuk Laravel)',
  'pdo_pgsql': 'Driver PDO untuk PostgreSQL',
  'pdo_sqlite': 'Driver PDO untuk SQLite',
  'pgsql': 'Koneksi database PostgreSQL',
  'soap': 'Komunikasi web service SOAP',
  'sockets': 'Komunikasi jaringan tingkat rendah',
  'sodium': 'Kriptografi keamanan tinggi modern',
  'sqlite3': 'Akses database SQLite',
  'tidy': 'Merapikan struktur file HTML/XML',
  'xsl': 'Transformasi dokumen XML (XSLT)',
  'zip': 'Mengekstrak dan membuat file .zip'
};

export const PhpExtensionsPage: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [extensions, setExtensions] = useState<PhpExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadExtensions = async () => {
    setLoading(true);
    try {
      const exts = await (window as any).api.getPhpExtensions();
      setExtensions(exts || []);
    } catch (e) {
      console.error('Failed to load extensions', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const toggleExtension = async (name: string, enable: boolean) => {
    const success = await (window as any).api.togglePhpExtension(name, enable);
    if (success) {
      setExtensions(extensions.map(e => e.name === name ? { ...e, enabled: enable } : e));
    }
  };

  const enablePopular = async () => {
    const POPULAR = ['curl', 'fileinfo', 'gd', 'mbstring', 'mysqli', 'openssl', 'pdo_mysql', 'pdo_sqlite', 'sodium', 'sqlite3', 'zip', 'intl', 'exif'];
    setLoading(true);
    let anyChanged = false;
    for (const ext of POPULAR) {
      const extObj = extensions.find(e => e.name === ext);
      if (extObj && !extObj.enabled) {
        await (window as any).api.togglePhpExtension(ext, true);
        anyChanged = true;
      }
    }
    if (anyChanged) {
      await loadExtensions();
    } else {
      setLoading(false);
    }
  };

  const filteredExtensions = extensions.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`page-content animate-fade-in ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>PHP Extensions</h1>
            <p className="subtitle">Manage PHP extensions in php.ini</p>
          </div>
        </div>
      )}

      <div className="card glass-effect" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings2 className="icon-blue" />
            <h2>PHP Extensions</h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Cari ekstensi..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-glass"
                style={{ padding: '0.4rem 0.5rem 0.4rem 2.25rem', width: '220px', fontSize: '0.85rem' }}
              />
            </div>
            <button className="btn btn-primary" onClick={enablePopular} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} title="Aktifkan Ekstensi Populer">
              <Zap size={14} /> Aktifkan Populer
            </button>
            <button className="btn btn-secondary btn-icon" onClick={loadExtensions} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        <div className="card-body" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div className="empty-state">
              <p>Tidak ada ekstensi PHP yang ditemukan.</p>
            </div>
          ) : (
            <div className="extensions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {filteredExtensions.map(ext => {
                const desc = extensionDescriptions[ext.name] || 'Ekstensi tambahan PHP';
                return (
                  <div key={ext.name} className="extension-card" style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '1rem', background: 'var(--bg-secondary)', 
                    borderRadius: '0.5rem', border: '1px solid var(--border-light)' 
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden', flex: 1, paddingRight: '1rem' }}>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{ext.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }} title={desc}>
                        {desc}
                      </span>
                    </div>
                    <button 
                      className="btn-icon" 
                      onClick={() => toggleExtension(ext.name, !ext.enabled)}
                      style={{ color: ext.enabled ? 'var(--status-running)' : 'var(--text-secondary)', transition: 'color 0.2s' }}
                      title={ext.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {ext.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
