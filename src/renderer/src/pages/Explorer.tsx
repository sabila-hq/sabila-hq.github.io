import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, HardDrive, RefreshCw } from 'lucide-react';
import { translations } from '../translations';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '-';
  }
};

const TreeNode: React.FC<{ node: FileNode; level: number; loadPath: (p: string) => Promise<FileNode[]> }> = ({ node, level, loadPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleOpen = async () => {
    if (!node.isDirectory) {
      // Open file with system default
      // @ts-ignore
      window.api.openFile(node.path);
      return;
    }
    
    setIsOpen(!isOpen);
    if (!isOpen && children.length === 0) {
      setIsLoading(true);
      const data = await loadPath(node.path);
      setChildren(data);
      setIsLoading(false);
    }
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    padding: '0.4rem 0.5rem', paddingLeft: `${level * 1.25 + 0.5}rem`,
    cursor: 'pointer', borderRadius: '6px',
    transition: 'background 0.15s ease',
    fontSize: '0.85rem'
  };

  return (
    <div>
      <div
        style={rowStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={toggleOpen}
      >
        {/* Chevron */}
        <span style={{ width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
          {node.isDirectory ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        {/* Icon */}
        <span style={{ marginRight: '0.5rem', flexShrink: 0 }}>
          {node.isDirectory
            ? <Folder size={16} color={isOpen ? 'var(--brand-blue)' : 'var(--brand-purple)'} />
            : <File size={16} color="var(--text-secondary)" />
          }
        </span>
        {/* Name */}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
          {node.name}
        </span>
        {/* Size */}
        <span style={{ width: '90px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
          {formatSize(node.size)}
        </span>
        {/* Date */}
        <span style={{ width: '150px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
          {formatDate(node.modifiedAt)}
        </span>
      </div>

      {isOpen && (
        <div>
          {isLoading ? (
            <div style={{ paddingLeft: `${(level + 1) * 1.25 + 2}rem`, fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem' }}>
              Loading...
            </div>
          ) : children.length === 0 ? (
            <div style={{ paddingLeft: `${(level + 1) * 1.25 + 2}rem`, fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.3rem 0.5rem', fontStyle: 'italic' }}>
              Empty folder
            </div>
          ) : (
            children.map(child => (
              <TreeNode key={child.path} node={child} level={level + 1} loadPath={loadPath} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const Explorer: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const rootPath = 'C:\\sabila';
  const t = translations[lang as keyof typeof translations] || translations.en;

  const fetchDirectory = async (path: string) => {
    // @ts-ignore
    return await window.api.getDirTree(path);
  };

  const loadRoot = async () => {
    setIsLoading(true);
    const data = await fetchDirectory(rootPath);
    setNodes(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadRoot();
  }, []);

  return (
    <div className={embedded ? "" : "page-container"} style={embedded ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
      {!embedded && (
        <div className="page-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardDrive size={24} color="var(--brand-purple)" /> Explorer
            </h1>
            <p>{t.explorer_desc} ({rootPath})</p>
          </div>
          <button className="btn-secondary" onClick={loadRoot} style={{ flexShrink: 0, marginTop: '0.25rem' }}>
            <RefreshCw size={14} /> {t.refresh}
          </button>
        </div>
      )}

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: '0.5rem' }}>
        {/* Header Row */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '0.6rem 0.5rem',
          borderBottom: '1px solid var(--glass-border)',
          fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0
        }}>
          <span style={{ width: '18px' }}></span>
          <span style={{ width: '24px' }}></span>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ width: '90px', textAlign: 'right' }}>Size</span>
          <span style={{ width: '150px', textAlign: 'right' }}>Date Modified</span>
        </div>

        {/* Tree Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {t.scanning}
            </div>
          ) : nodes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {t.empty_dir}
            </div>
          ) : (
            nodes.map(node => (
              <TreeNode key={node.path} node={node} level={0} loadPath={fetchDirectory} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
