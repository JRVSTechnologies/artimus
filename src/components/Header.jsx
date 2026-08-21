import React from 'react';
import { Zap, Settings, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Header({ onOpenSettings, currentView, onSetView }) {
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
        <button 
          className="btn" 
          onClick={() => onSetView('main')} 
          style={{ 
            fontWeight: '600', 
            background: currentView === 'main' ? '#38BDF8' : 'rgba(255,255,255,0.05)', 
            color: currentView === 'main' ? '#000' : '#f1f0ee',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          Main Hub
        </button>
        <button 
          className="btn" 
          onClick={() => onSetView('analysis')} 
          style={{ 
            fontWeight: '600', 
            background: currentView === 'analysis' ? '#10b981' : 'rgba(255,255,255,0.05)', 
            color: currentView === 'analysis' ? '#000' : '#f1f0ee',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          Price Analysis
        </button>
        <button 
          className="btn" 
          onClick={() => onSetView('weekly_journal')} 
          style={{ 
            fontWeight: '600', 
            background: currentView === 'weekly_journal' ? '#8b5cf6' : 'rgba(255,255,255,0.05)', 
            color: currentView === 'weekly_journal' ? '#000' : '#f1f0ee',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          Weekly Journal
        </button>

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
