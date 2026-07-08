import React, { useState, useEffect } from 'react';
import { Home, FolderGit2, Bot, Settings2, Wrench, Info, Database, Heart, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { translations } from '../translations';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lang = 'en' }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const t = translations[lang as keyof typeof translations] || translations.en;

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: Home },
    { id: 'projects', label: t.projects, icon: FolderGit2 },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'ai-chat', label: t.ai_assistant, icon: Bot },
    { id: 'tools', label: t.tools, icon: Wrench },
  ];

  const renderNavButton = (item: { id: string; label: string; icon: any }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        className={`nav-btn ${isActive ? 'active' : ''}`}
        onClick={() => setActiveTab(item.id)}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon size={18} color={isActive ? 'var(--primary)' : 'var(--secondary)'} strokeWidth={isActive ? 2.5 : 2} />
        {!isCollapsed && <span>{item.label}</span>}
      </button>
    );
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div style={{
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '0.75rem',
        padding: '0.5rem 0.5rem',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'var(--brand-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#ffffff',
          fontSize: '1.1rem',
          boxShadow: '0 4px 12px rgba(0, 97, 165, 0.25)',
          fontFamily: 'var(--font-heading)',
          flexShrink: 0,
        }}>S</div>
        {!isCollapsed && (
          <div>
            <h2 style={{
              fontSize: '1.1rem',
              margin: 0,
              lineHeight: 1.2,
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              color: 'var(--primary)',
              letterSpacing: '-0.01em',
            }}>Sabila</h2>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>{(t as any).local_env}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {navItems.map(renderNavButton)}
      </nav>

      {/* Footer Items */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        opacity: 0.9,
      }}>
        {renderNavButton({ id: 'settings', label: t.settings, icon: Settings2 })}
        {renderNavButton({ id: 'about', label: lang === 'id' ? 'Tentang' : 'About', icon: Info })}
        <button
          className="nav-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ marginTop: '0.5rem', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          title={isCollapsed ? (lang === 'id' ? 'Perluas Sidebar' : 'Expand Sidebar') : undefined}
        >
          {isCollapsed ? <PanelLeftOpen size={18} color="var(--secondary)" /> : <PanelLeftClose size={18} color="var(--secondary)" />}
          {!isCollapsed && <span>{lang === 'id' ? 'Sembunyikan' : 'Collapse Sidebar'}</span>}
        </button>
      </div>
    </div>
  );
};
