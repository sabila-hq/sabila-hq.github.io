import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Download, Folder, Palette, Rocket, Info, ExternalLink, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Selamat Datang', icon: Info },
  { id: 2, title: 'Folder Utama', icon: Folder },
  { id: 3, title: 'Komponen', icon: Download },
  { id: 4, title: 'Preferensi', icon: Palette },
  { id: 5, title: 'Selesai!', icon: Rocket },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [nodeInfo, setNodeInfo] = useState<{ installed: boolean; nodeVersion?: string; npmVersion?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [mainFolder, setMainFolder] = useState('C:\\sabila');
  const [selectedLang, setSelectedLang] = useState('id');
  const [selectedTheme, setSelectedTheme] = useState('dark');

  useEffect(() => {
    checkNode();
  }, []);

  const checkNode = async () => {
    setChecking(true);
    // @ts-ignore
    const result = await window.api.checkNodeInstalled();
    setNodeInfo(result);
    setChecking(false);
  };

  const openUrl = (url: string) => {
    // @ts-ignore
    window.api.openExternalUrl(url);
  };

  const handleComplete = async () => {
    // @ts-ignore
    await window.api.saveSettings({ language: selectedLang, theme: selectedTheme });
    // @ts-ignore
    await window.api.setSetupComplete();
    onComplete();
  };

  const canProceedStep1 = nodeInfo?.installed === true;

  const components = [
    { name: 'Nginx 1.31.2', category: 'Web Server', url: 'https://nginx.org/download/nginx-1.31.2.zip', icon: '🌐' },
    { name: 'VC++ Redistributable (x64)', category: 'Dependency', url: 'https://aka.ms/vc14/vc_redist.x64.exe', icon: '⚙️' },
    { name: 'Apache 2.4.57', category: 'Web Server', url: 'https://www.apachelounge.com/download/VS16/binaries/httpd-2.4.57-win64-VS16.zip', icon: '🪶' },
    { name: 'PHP 8.3.32', category: 'Runtime', url: 'https://downloads.php.net/~windows/releases/archives/php-8.3.32-Win32-vs16-x64.zip', icon: '🐘' },
    { name: 'MySQL 8.0.46', category: 'Database', url: 'https://dev.mysql.com/downloads/file/?id=551515', icon: '🗄️' },
    { name: 'phpMyAdmin 5.2.3', category: 'Tool', url: 'https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-all-languages.zip', icon: '📊' },
    { name: 'Notepad++', category: 'Editor', url: 'https://notepad-plus-plus.org/downloads/', icon: '📝' },
    { name: 'Git', category: 'Version Control', url: 'https://git-scm.com/download/win', icon: '🔀' },
    { name: 'Composer', category: 'Package Manager', url: 'https://getcomposer.org/download/', icon: '🎵' },
  ];

  const containerStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: '#0f0f1a',
    display: 'flex', flexDirection: 'column',
    zIndex: 9999, fontFamily: "'Inter', 'Segoe UI', sans-serif",
    overflow: 'hidden'
  };

  const headerStyle: React.CSSProperties = {
    padding: '1.5rem 2rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    ...({ WebkitAppRegion: 'drag' } as any)
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1, padding: '2rem', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '1.5rem'
  };

  const footerStyle: React.CSSProperties = {
    padding: '1rem 2rem', borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0
  };

  const btnPrimary: React.CSSProperties = {
    padding: '0.6rem 1.5rem', border: 'none', borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    opacity: 1, transition: 'opacity 0.2s'
  };

  const btnSecondary: React.CSSProperties = {
    padding: '0.6rem 1.5rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
    background: 'transparent', color: '#ccc',
    fontSize: '0.9rem', cursor: 'pointer'
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '1.25rem'
  };

  const downloadBtnStyle: React.CSSProperties = {
    padding: '0.4rem 0.8rem', border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: '6px', background: 'rgba(59,130,246,0.1)',
    color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    transition: 'background 0.15s', flexShrink: 0
  };

  return (
    <div style={containerStyle}>
      {/* Header with step indicators */}
      <div style={headerStyle}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>L</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Setup Sabila</h1>
          <span style={{ fontSize: '0.78rem', color: '#888' }}>Tahap {step} dari 5</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{
              width: step === s.id ? '32px' : '8px', height: '8px',
              borderRadius: '4px',
              background: s.id < step ? '#22c55e' : s.id === step ? '#3b82f6' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>
      </div>

      {/* STEP 1: About & Node Check */}
      {step === 1 && (
        <>
          <div style={bodyStyle}>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👋</div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Selamat Datang di Sabila!</h2>
              <p style={{ color: '#aaa', margin: '0.5rem 0 0', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                Lingkungan pengembangan web lokal yang dirancang khusus untuk kamu yang baru pertama kali belajar membuat website. Mari kita siapkan semuanya! 🚀
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔍</span> Pemeriksaan Sistem
              </h3>
              {checking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#aaa' }}>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Memeriksa Node.js...</span>
                </div>
              ) : nodeInfo?.installed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#22c55e' }}>
                    <CheckCircle size={20} />
                    <span style={{ fontWeight: 600 }}>Node.js terdeteksi!</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div><span style={{ color: '#888', fontSize: '0.8rem' }}>Node</span><div style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>{nodeInfo.nodeVersion}</div></div>
                    <div><span style={{ color: '#888', fontSize: '0.8rem' }}>NPM</span><div style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>{nodeInfo.npmVersion}</div></div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b' }}>
                    <AlertTriangle size={20} />
                    <span style={{ fontWeight: 600 }}>Node.js belum terinstal</span>
                  </div>
                  <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem' }}>Node.js diperlukan untuk menjalankan beberapa fitur. Silakan instal terlebih dahulu:</p>
                  <button style={{ ...downloadBtnStyle, padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => openUrl('https://nodejs.org/dist/v24.18.0/node-v24.18.0-x64.msi')}>
                    <Download size={15} /> Download Node.js v24.18.0 (MSI Installer)
                    <ExternalLink size={12} />
                  </button>
                  <button style={{ ...btnSecondary, fontSize: '0.82rem', padding: '0.4rem 0.8rem', width: 'fit-content' }} onClick={checkNode}>
                    🔄 Periksa Ulang
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={footerStyle}>
            <button style={{ ...btnPrimary, opacity: canProceedStep1 ? 1 : 0.4, pointerEvents: canProceedStep1 ? 'auto' : 'none' }} onClick={() => setStep(2)}>
              Lanjutkan <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* STEP 2: Main Folder */}
      {step === 2 && (
        <>
          <div style={bodyStyle}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Tentukan Folder Utama</h2>
              <p style={{ color: '#aaa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Semua komponen server akan disimpan di folder ini.</p>
            </div>

            <div style={cardStyle}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc', fontSize: '0.85rem', fontWeight: 600 }}>📍 Lokasi Folder Utama</label>
              <input
                type="text"
                value={mainFolder}
                onChange={(e) => setMainFolder(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <p style={{ margin: '0.75rem 0 0', color: '#888', fontSize: '0.78rem', lineHeight: 1.5 }}>
                Struktur folder: <code style={{ color: '#60a5fa' }}>{mainFolder}\bin</code> (server), <code style={{ color: '#60a5fa' }}>{mainFolder}\www</code> (proyek), <code style={{ color: '#60a5fa' }}>{mainFolder}\data</code> (database)
              </p>
            </div>
          </div>
          <div style={footerStyle}>
            <button style={btnSecondary} onClick={() => setStep(1)}>Kembali</button>
            <button style={btnPrimary} onClick={() => setStep(3)}>Lanjutkan <ChevronRight size={16} /></button>
          </div>
        </>
      )}

      {/* STEP 3: Components */}
      {step === 3 && (
        <>
          <div style={bodyStyle}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Unduh Komponen</h2>
              <p style={{ color: '#aaa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Klik tombol download untuk mengunduh masing-masing komponen. Setelah selesai, ekstrak ke <code style={{ color: '#60a5fa' }}>{mainFolder}\bin</code></p>
            </div>

            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {components.map((c, i) => (
                <div key={i} style={{ ...cardStyle, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span style={{ fontSize: '1.3rem', width: '32px', textAlign: 'center' }}>{c.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: '#888', fontSize: '0.75rem' }}>{c.category}</div>
                  </div>
                  <button style={downloadBtnStyle} onClick={() => openUrl(c.url)}>
                    <Download size={13} /> Download <ExternalLink size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div style={footerStyle}>
            <button style={btnSecondary} onClick={() => setStep(2)}>Kembali</button>
            <button style={btnPrimary} onClick={() => setStep(4)}>Lanjutkan <ChevronRight size={16} /></button>
          </div>
        </>
      )}

      {/* STEP 4: Preferences */}
      {step === 4 && (
        <>
          <div style={bodyStyle}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎨</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Preferensi</h2>
              <p style={{ color: '#aaa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Sesuaikan tampilan dan bahasa sesuai selera kamu.</p>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#fff' }}>🌐 Bahasa</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[{ id: 'id', label: '🇮🇩 Bahasa Indonesia' }, { id: 'en', label: '🇺🇸 English' }].map(l => (
                  <button key={l.id} onClick={() => setSelectedLang(l.id)} style={{
                    flex: 1, padding: '0.75rem', border: selectedLang === l.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', background: selectedLang === l.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                    color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: selectedLang === l.id ? 600 : 400
                  }}>{l.label}</button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#fff' }}>🎨 Tema</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[{ id: 'dark', label: '🌙 Mode Gelap', desc: 'Nyaman untuk mata' }, { id: 'light', label: '☀️ Mode Terang', desc: 'Cerah dan bersih' }].map(t => (
                  <button key={t.id} onClick={() => setSelectedTheme(t.id)} style={{
                    flex: 1, padding: '0.75rem', border: selectedTheme === t.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', background: selectedTheme === t.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                    color: '#fff', cursor: 'pointer', textAlign: 'left'
                  }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: selectedTheme === t.id ? 600 : 400 }}>{t.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#fff' }}>🤖 SABIL.AI (Opsional)</h3>
              <p style={{ margin: 0, color: '#888', fontSize: '0.82rem', lineHeight: 1.5 }}>
                Kamu bisa mengatur API Key untuk AI Assistant nanti di halaman Pengaturan. Fitur ini opsional dan bisa dilewati.
              </p>
            </div>
          </div>
          <div style={footerStyle}>
            <button style={btnSecondary} onClick={() => setStep(3)}>Kembali</button>
            <button style={btnPrimary} onClick={() => setStep(5)}>Lanjutkan <ChevronRight size={16} /></button>
          </div>
        </>
      )}

      {/* STEP 5: Complete */}
      {step === 5 && (
        <>
          <div style={{ ...bodyStyle, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#fff' }}>Selamat! Semua Siap!</h2>
            <p style={{ color: '#aaa', margin: '0.75rem 0 0', maxWidth: '480px', lineHeight: 1.7, fontSize: '0.95rem' }}>
              Sabila sudah siap digunakan. Jangan takut untuk bereksperimen — setiap developer hebat pernah memulai dari nol. Kamu pasti bisa! 💪
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button style={{ ...btnPrimary, padding: '0.75rem 2rem', fontSize: '1rem' }} onClick={handleComplete}>
                <Rocket size={18} /> Buka Sabila
              </button>
              <button style={{ ...btnSecondary, padding: '0.75rem 1.5rem' }} onClick={handleComplete}>
                Nanti Dulu
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
