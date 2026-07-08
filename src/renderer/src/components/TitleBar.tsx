import React from 'react';
import { Minus, Square, X, ArrowDownToLine } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const handleControl = (action: string) => {
    // @ts-ignore
    if (window.api && window.api.windowControl) {
      // @ts-ignore
      window.api.windowControl(action);
    }
  };

  return (
    <div className="titlebar" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: '36px',
      background: 'var(--surface-container-lowest)',
      borderBottom: '1px solid var(--outline-variant)',
      WebkitAppRegion: 'drag',
      userSelect: 'none',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    } as React.CSSProperties}>
      <div style={{
        paddingLeft: '16px',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--on-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'var(--font-heading)',
        letterSpacing: '-0.01em',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '5px',
          background: 'var(--brand-gradient)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <span style={{ color: '#fff', fontSize: '9px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>S</span>
        </div>
        <span>Sabila</span>
      </div>

      <div className="window-controls" style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="control-btn" onClick={() => handleControl('window-hide')} title="Sembunyikan ke Tray (Latar Belakang)" style={btnStyle}>
          <ArrowDownToLine size={14} />
        </button>
        <button className="control-btn" onClick={() => handleControl('window-minimize')} title="Minimize" style={btnStyle}>
          <Minus size={14} />
        </button>
        <button className="control-btn" onClick={() => handleControl('window-maximize')} title="Maximize" style={btnStyle}>
          <Square size={12} />
        </button>
        <button className="control-btn close-btn" onClick={() => handleControl('window-close')} title="Close" style={{...btnStyle, ...closeStyle}}>
          <X size={14} />
        </button>
      </div>

      <style>{`
        .control-btn {
          background: transparent;
          border: none;
          color: var(--on-surface-variant);
          width: 46px;
          height: 100%;
          display: flex;
          justifyContent: center;
          alignItems: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .control-btn:hover {
          background: var(--surface-container);
          color: var(--on-surface);
        }
        .close-btn:hover {
          background: #e81123 !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
};

const btnStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 0
};

const closeStyle = {};
