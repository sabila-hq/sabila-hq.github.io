import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Settings, ChevronDown, ChevronUp, Folder, Plus, Minus, FileText } from 'lucide-react';
import { translations } from '../translations';

interface ToolMenuProps {
  toolId: string;
  activeVersion?: string;
  isDashboardItem?: boolean;
  onToggleDashboard?: () => void;
  onOpenFolder?: () => void;
  onRefresh: () => void;
  onAddVersion?: () => void;
  lang?: string;
}

export function ToolMenu({ toolId, activeVersion, isDashboardItem, onToggleDashboard, onOpenFolder, onRefresh, onAddVersion , lang = 'en'}: ToolMenuProps) {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, bottom: 0, left: 0, alignRight: false, alignTop: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const alignRight = rect.left > window.innerWidth / 2;
      const spaceBelow = window.innerHeight - rect.bottom;
      const alignTop = spaceBelow < 260; // Approximate dropdown height
      
      setDropdownPos({
        top: rect.bottom + 8,
        bottom: window.innerHeight - rect.top + 8,
        left: alignRight ? rect.right : rect.left,
        alignRight,
        alignTop
      });
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking the button
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking inside the portal dropdown
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
      setExpandedSection(null);
    }

    function handleScroll(e: Event) {
      // If we are scrolling inside the dropdown itself, ignore it
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return;
      }
      // If the user scrolls the page, close the dropdown to prevent floating confusion
      setIsOpen(false);
      setExpandedSection(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    // Use capture phase to intercept scroll events from any scrollable container
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', () => { setIsOpen(false); setExpandedSection(null); });
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', () => { setIsOpen(false); setExpandedSection(null); });
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  const openMenu = async () => {
    const next = !isOpen;
    if (next) {
      updatePosition();
      // @ts-ignore
      const vers = await window.api.getToolVersions(toolId);
      setVersions(vers);
    }
    setIsOpen(next);
    setExpandedSection(null);
  };

  const handleSetVersion = async (version: string) => {
    // @ts-ignore
    await window.api.setToolVersion(toolId, version);
    setIsOpen(false);
    setExpandedSection(null);
    onRefresh();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', textAlign: 'left', padding: '0.55rem 0.85rem',
    border: 'none', background: 'transparent',
    color: 'var(--text-primary)', cursor: 'pointer',
    fontSize: '0.85rem', transition: 'background 0.15s ease',
    borderRadius: '6px', gap: '0.5rem', whiteSpace: 'nowrap'
  };

  const sectionHeaderStyle: React.CSSProperties = {
    ...menuItemStyle,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1, height: '100%' }}>
      <button
        ref={buttonRef}
        className="btn-secondary"
        onClick={openMenu}
        style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', 
          textAlign: 'center', lineHeight: '1.2', width: '100%'
        }}
        title={t.toolmenu_options_title || "Opsi Lanjutan"}
      >
        <Settings size={14} style={{ marginBottom: '2px' }} /> {t.toolmenu_options || "Opsi"}
      </button>

      {isOpen && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed', 
          ...(dropdownPos.alignTop ? { bottom: `${dropdownPos.bottom}px` } : { top: `${dropdownPos.top}px` }), 
          ...(dropdownPos.alignRight ? { right: `${window.innerWidth - dropdownPos.left}px` } : { left: `${dropdownPos.left}px` }),
          minWidth: '220px', background: 'var(--bg-primary)',
          border: '1px solid var(--glass-border)', borderRadius: '12px',
          boxShadow: '0 24px 40px rgba(0,0,0,0.25)', padding: '0.5rem', zIndex: 99999,
          backdropFilter: 'blur(12px)'
        }}>
          {onToggleDashboard && (
            <button 
              style={menuItemStyle}
              onClick={() => { onToggleDashboard(); setIsOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{isDashboardItem ? <Minus size={14}/> : <Plus size={14}/>} {isDashboardItem ? (t.toolmenu_remove_dash || 'Hapus dari Dashboard') : (t.toolmenu_add_dash || 'Tambah ke Dashboard')}</span>
            </button>
          )}

          {onOpenFolder && (
            <button 
              style={menuItemStyle}
              onClick={() => { onOpenFolder(); setIsOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span><Folder size={14}/> {t.toolmenu_open_dir || 'Buka Direktori'}</span>
            </button>
          )}

          {toolId === 'php' && (
            <button 
              style={menuItemStyle}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'tools' } }));
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('switch-tool-tab', { detail: { tab: 'php' } }));
                }, 50);
                setIsOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span><Settings size={14}/> {t.toolmenu_php_config || 'PHP Config'}</span>
            </button>
          )}

          {['php', 'apache', 'mysql', 'nginx'].includes(toolId) && (
            <button 
              style={menuItemStyle}
              onClick={() => { 
                // @ts-ignore
                window.api.openConfigFile(toolId);
                setIsOpen(false); 
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span><FileText size={14}/> {t.toolmenu_edit_config || 'Edit Config (.ini/.conf)'}</span>
            </button>
          )}

          <div style={{ margin: '6px 0', borderBottom: '1px solid var(--glass-border)' }} />
          
          {/* Version Section */}
          {['git', 'composer', 'phpmyadmin'].includes(toolId) ? (
            <button 
              style={sectionHeaderStyle}
              onClick={() => { onAddVersion && onAddVersion(); setIsOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>⬆️ {t.toolmenu_update_version || 'Update Versi'}</span>
            </button>
          ) : (
            <>
              <button 
                style={sectionHeaderStyle}
                onClick={() => toggleSection('version')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>📦 {t.toolmenu_select_version || 'Pilih Versi'}</span>
                {expandedSection === 'version' ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
              </button>
              {expandedSection === 'version' && (
                <div style={{ 
                  padding: '0.25rem 0 0.25rem 0.5rem',
                  maxHeight: '200px', overflowY: 'auto',
                  borderLeft: '2px solid var(--brand-blue)',
                  marginLeft: '0.85rem', marginBottom: '0.25rem'
                }}>
                  {versions.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tidak ada versi lain</div>
                  ) : versions.map(v => (
                    <button key={v} onClick={() => handleSetVersion(v)}
                      style={{ ...menuItemStyle, fontSize: '0.82rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: v === activeVersion ? 'var(--brand-blue)' : 'transparent', fontWeight: 900 }}>✓</span> 
                        <span style={{ fontWeight: v === activeVersion ? 600 : 400 }}>{v}</span>
                      </span>
                    </button>
                  ))}
                  <div style={{ padding: '0 0.85rem', marginTop: '0.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
                    <button 
                      onClick={() => { onAddVersion && onAddVersion(); setIsOpen(false); }}
                      style={{
                        background: 'var(--brand-blue)',
                        color: 'white',
                        border: 'none',
                        padding: '0.4rem',
                        width: '100%',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    > + {t.toolmenu_add_version || 'Tambah Versi'} </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      , document.body)}
    </div>
  );
}
