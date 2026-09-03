import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TelegramTestCard from './components/TelegramTestCard';
import SignalLogger from './components/SignalLogger';
import SettingsModal from './components/SettingsModal';
import PriceAnalysisDashboard from './components/PriceAnalysisDashboard';
import SignalFeed from './components/SignalFeed';
import { Cpu, Send, ShieldCheck, Zap, Server, Globe } from 'lucide-react';
import WeeklyAnalysisJournal from './components/WeeklyAnalysisJournal';
import SignalStatisticsDashboard from './components/SignalStatisticsDashboard';
import SubmitSignalForm from './components/SubmitSignalForm';
import EvaluationSimulator from './components/EvaluationSimulator';
import { NhostClient, NhostReactProvider } from '@nhost/react';

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || '',
  region: import.meta.env.VITE_NHOST_REGION || ''
});

export default function App() {
  const [botConfig, setBotConfig] = useState(() => {
    const saved = localStorage.getItem('artimus_bot_config');
    return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
  });

  const [logs, setLogs] = useState(() => {
    const savedLogs = localStorage.getItem('artimus_logs');
    return savedLogs ? JSON.parse(savedLogs) : [];
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState('main');

  useEffect(() => {
    localStorage.setItem('artimus_bot_config', JSON.stringify(botConfig));
  }, [botConfig]);

  useEffect(() => {
    localStorage.setItem('artimus_logs', JSON.stringify(logs));
  }, [logs]);

  const handleSaveConfig = (newConfig) => {
    setBotConfig(newConfig);
  };

  const handleLogSignal = (newLog) => {
    setLogs((prev) => [newLog, ...prev.slice(0, 29)]);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <NhostReactProvider nhost={nhost}>
      <div className="app-container">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentView={currentView} 
        onSetView={setCurrentView} 
      />
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onToggleSidebar={() => setIsSidebarOpen(true)}
      />

      {/* Hero Quick Overview Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
            <Server size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Netlify Functions</div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>Active & Ready</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818CF8' }}>
            <Send size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Telegram Gateway</div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>
              {botConfig.botToken ? 'Configured' : 'Needs Token'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#C084FC' }}>
            <Cpu size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Total Dispatched</div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>{logs.length} Signals</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34D399' }}>
            <Globe size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Serverless Environment</div>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>NodeJS 18+</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {currentView === 'main' && (
        <div className="dashboard-grid">
          <TelegramTestCard botConfig={botConfig} onLogSignal={handleLogSignal} />
          <SignalLogger logs={logs} onClearLogs={handleClearLogs} />
        </div>
      )}
      
      {currentView === 'analysis' && <PriceAnalysisDashboard />}
      
      {currentView === 'statistics' && <SignalStatisticsDashboard />}
      
      {currentView === 'signal_feed' && <SignalFeed />}
      
      {currentView === 'submit_signal' && <SubmitSignalForm />}

      {currentView === 'simulator' && <EvaluationSimulator />}
      
      {currentView === 'weekly_journal' && <WeeklyAnalysisJournal />}

      {/* Footer info */}
      <footer style={{
        marginTop: '20px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-subtle)',
        borderTop: '1px solid var(--border-card)',
        paddingTop: '20px'
      }}>
        Project Artimus • Netlify Serverless Data & Signal Processing Hub • Developed for High Performance Webhooks
      </footer>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          botConfig={botConfig}
          onSaveConfig={handleSaveConfig}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      </div>
    </NhostReactProvider>
  );
}
