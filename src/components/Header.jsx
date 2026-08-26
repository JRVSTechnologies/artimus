import React from 'react';
import { Zap, Settings, Menu } from 'lucide-react';

export default function Header({ onOpenSettings, onToggleSidebar }) {
  return (
    <header className="header-nav">
      <div className="logo-group">
        <button 
          className="btn btn-secondary" 
          onClick={onToggleSidebar} 
          style={{ padding: '10px', marginRight: '8px' }}
          title="Open Menu"
        >
          <Menu size={20} />
        </button>
        <div className="logo-badge">
          <Zap size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', lineHeight: '1.2' }}>
            Artimus <span className="gradient-text">Serverless</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
            Netlify Data & Signal Processing Hub
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="status-chip hide-mobile">
          <div className="pulse-dot"></div>
          Netlify Functions Active
        </div>

        <button className="btn btn-secondary" onClick={onOpenSettings} title="Configure Bot & Environment">
          <Settings size={16} />
          <span className="hide-mobile">Settings</span>
        </button>
      </div>
    </header>
  );
}
