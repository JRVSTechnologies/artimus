import React from 'react';
import { Zap, Settings, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Header({ onOpenSettings }) {
  return (
    <header className="header-nav">
      <div className="logo-group">
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
        <div className="status-chip">
          <div className="pulse-dot"></div>
          Netlify Functions Active
        </div>

        <button className="btn btn-secondary" onClick={onOpenSettings} title="Configure Bot & Environment">
          <Settings size={16} />
          Settings
        </button>
      </div>
    </header>
  );
}
