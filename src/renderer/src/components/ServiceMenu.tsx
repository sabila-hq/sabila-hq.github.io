import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Settings, ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react';

interface ServiceMenuProps {
  serviceId: string;
  activeVersion?: string;
  onRefresh: () => void;
}

export function ServiceMenu({ serviceId, activeVersion, onRefresh }: ServiceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [extensions, setExtensions] = useState<{ name: string, enabled: boolean }[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<React.CSSProperties>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const isRightSide = rect.left > window.innerWidth / 2;
      
      let posStyle: React.CSSProperties = {};
      posStyle.top = rect.bottom + 4;
      
      if (isRightSide) {
         posStyle.right = window.innerWidth - rect.right;
      } else {
         posStyle.left = rect.left;
      }
      setDropdownPos(posStyle);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideMenu && isOutsideDropdown) {
        setIsOpen(false);
        setExpandedSection(null);
      }
    }

    function handleScroll(e: Event) {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
      setExpandedSection(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
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
    }
    setIsOpen(next);
    setExpandedSection(null);
    if (next) {
      // @ts-ignore
      const vers = await window.api.getServiceVersions(serviceId);
      setVersions(vers);
      if (serviceId === 'php') {
        // @ts-ignore
        const exts = await window.api.getPhpExtensions();
        setExtensions(exts);
      }
    }
  };

  const handleSetVersion = async (version: string) => {
    // @ts-ignore
    await window.api.setServiceVersion(serviceId, version);
    setIsOpen(false);
    setExpandedSection(null);
    onRefresh();
  };

  const handleToggleExt = async (extName: string, enable: boolean) => {
    // @ts-ignore
    await window.api.togglePhpExtension(extName, enable);
    // @ts-ignore
    const exts = await window.api.getPhpExtensions();
    setExtensions(exts);
  };

  const handleOpenFile = (filename: string) => {
    const basePath = `C:\\sabila\\bin\\${serviceId}`;
    const targetPath = activeVersion ? `${basePath}\\${activeVersion}\\${filename}` : `${basePath}\\${filename}`;
    // @ts-ignore
    window.api.openFile(targetPath);
    setIsOpen(false);
  };

  const handleOpenDir = (dirName: string) => {
    const basePath = `C:\\sabila\\bin\\${serviceId}`;
    const targetPath = activeVersion ? `${basePath}\\${activeVersion}\\${dirName}` : `${basePath}\\${dirName}`;
    // @ts-ignore
    window.api.openDirectory(targetPath);
    setIsOpen(false);
  };

  const downloadLinks: Record<string, string> = {
    'nginx': 'http://nginx.org/en/download.html',
    'apache': 'https://www.apachelounge.com/download/',
    'php': 'https://downloads.php.net/~windows/releases/archives/',
    'mysql': 'https://dev.mysql.com/downloads/mysql/'
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
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      <button
        className="btn-secondary"
        onClick={openMenu}
        style={{ padding: '0.45rem 0.7rem', fontSize: '0.82rem' }}
      >
        <Settings size={14} /> Opsi
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{
          position: 'fixed', 
          ...dropdownPos,
          minWidth: '260px', background: 'var(--bg-primary)',
          border: '1px solid var(--glass-border)', borderRadius: '10px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: '0.4rem', zIndex: 99999
        }}>
          {/* Header */}
          <div style={{ padding: '0.4rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {serviceId === 'nginx' ? '🚀' : serviceId === 'apache' ? '🏠' : serviceId === 'php' ? '🐘' : serviceId === 'mysql' ? '🐬' : '⚙️'}
            </span>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{serviceId.toUpperCase()} Settings</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Configure environment</div>
            </div>
          </div>

          {/* Version Section - click to expand */}
          <button 
            style={sectionHeaderStyle}
            onClick={() => toggleSection('version')}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>📦 Version [{activeVersion || 'Default'}]</span>
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
                <div style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tidak ada versi ditemukan</div>
              ) : versions.map(v => (
                <button key={v} onClick={() => handleSetVersion(v)}
                  style={{ ...menuItemStyle, fontSize: '0.82rem' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{v === activeVersion ? '✓ ' : '   '}{v}</span>
                </button>
              ))}
              
              {/* Download another version */}
              <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.3rem 0' }}></div>
              <button 
                style={{ ...menuItemStyle, color: 'var(--brand-blue)', fontSize: '0.82rem' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  window.open(downloadLinks[serviceId] || 'https://google.com', '_blank');
                  setIsOpen(false);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Download size={13} /> Download versi lain
                </span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}

          {/* PHP Extensions Section - click to expand */}
          {serviceId === 'php' && (
            <>
              <button 
                style={sectionHeaderStyle}
                onClick={() => toggleSection('ext')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>🧩 Extensions</span>
                {expandedSection === 'ext' ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
              </button>

              {expandedSection === 'ext' && (
                <div style={{ 
                  padding: '0.25rem 0 0.25rem 0.5rem',
                  maxHeight: '200px', overflowY: 'auto',
                  borderLeft: '2px solid var(--brand-purple)',
                  marginLeft: '0.85rem', marginBottom: '0.25rem'
                }}>
                  {extensions.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No extensions found</div>
                  ) : extensions.map(ext => (
                    <button key={ext.name}
                      onClick={() => handleToggleExt(ext.name, !ext.enabled)}
                      style={{ ...menuItemStyle, fontSize: '0.82rem' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: ext.enabled ? 'var(--status-running)' : 'var(--text-secondary)' }}>
                        {ext.enabled ? '✓' : '  '} {ext.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Separator */}
          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.3rem 0' }}></div>

          {/* Quick Config Shortcuts */}
          {serviceId === 'php' && (
            <>
              <button style={menuItemStyle} onClick={() => handleOpenFile('php.ini')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>📄 php.ini</span>
              </button>
              <button style={menuItemStyle} onClick={() => handleOpenDir('ext')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>📁 dir:ext</span>
              </button>
            </>
          )}
          {serviceId === 'nginx' && (
            <button style={menuItemStyle} onClick={() => handleOpenFile('conf\\nginx.conf')}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>📄 nginx.conf</span>
            </button>
          )}
          {serviceId === 'apache' && (
            <button style={menuItemStyle} onClick={() => handleOpenFile('conf\\httpd.conf')}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>📄 httpd.conf</span>
            </button>
          )}
          {serviceId === 'mysql' && (
            <button style={menuItemStyle} onClick={() => handleOpenFile('my.ini')}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>📄 my.ini</span>
            </button>
          )}
        </div>
      , document.body)}
    </div>
  );
}
