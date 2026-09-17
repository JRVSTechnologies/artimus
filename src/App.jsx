import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TelegramTestCard from './components/TelegramTestCard';
import SignalLogger from './components/SignalLogger';
import SettingsModal from './components/SettingsModal';
import PriceAnalysisDashboard from './components/PriceAnalysisDashboard';
import SignalFeed from './components/SignalFeed';
import TelegramLiveFeed from './components/TelegramLiveFeed';
import BillsSignalsFeed from './components/BillsSignalsFeed';
import FxClarityFeed from './components/FxClarityFeed';
import { Cpu, Send, ShieldCheck, Zap, Server, Globe } from 'lucide-react';
import WeeklyAnalysisJournal from './components/WeeklyAnalysisJournal';
import SignalStatisticsDashboard from './components/SignalStatisticsDashboard';
import SequentialTradeTimeline from './components/SequentialTradeTimeline';
import SubmitSignalForm from './components/SubmitSignalForm';
import EvaluationSimulator from './components/EvaluationSimulator';
import BotHealthStatus from './components/BotHealthStatus';
import { NhostClient, NhostReactProvider } from '@nhost/react';

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || 'local',
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
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'main';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentView(hash || 'main');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSetView = (view) => {
    window.location.hash = view;
  };

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
        onSetView={handleSetView} 
      />
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onToggleSidebar={() => setIsSidebarOpen(true)}
      />



      {/* Main Content Area */}
      {currentView === 'main' && (
        <div className="dashboard-grid">
          <TelegramTestCard botConfig={botConfig} onLogSignal={handleLogSignal} />
          <SignalLogger logs={logs} onClearLogs={handleClearLogs} />
        </div>
      )}
      
      {currentView === 'analysis' && <PriceAnalysisDashboard />}
      
      {currentView === 'statistics' && <SignalStatisticsDashboard />}

      {currentView === 'tradeTimeline' && <SequentialTradeTimeline />}
      
      {currentView === 'signal_feed' && <SignalFeed />}
      
      {currentView === 'telegram_feed' && <TelegramLiveFeed />}
      
      {currentView === 'bills_signals' && <BillsSignalsFeed />}

      {currentView === 'fx_clarity' && <FxClarityFeed />}
      
      {currentView === 'submit_signal' && <SubmitSignalForm />}

      {currentView === 'simulator' && <EvaluationSimulator />}
      
      {currentView === 'weekly_journal' && <WeeklyAnalysisJournal />}

      {currentView === 'bot_health' && <BotHealthStatus />}

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
