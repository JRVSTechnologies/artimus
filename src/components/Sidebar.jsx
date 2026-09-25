import React from 'react';
import { X, LayoutDashboard, LineChart, BookOpen, Activity, BarChart3, Edit, Target, MessageSquare, Server } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, currentView, onSetView }) {
  const menuItems = [
    { id: 'main', label: 'Main Hub', icon: LayoutDashboard, color: 'var(--color-primary)' },
    { id: 'bot_health', label: 'Bot Health Status', icon: Server, color: 'var(--color-success)' },
    { id: 'signal_feed', label: 'Live Signal Feed', icon: Activity, color: 'var(--color-danger)' },
    { id: 'telegram_feed', label: 'Telegram Live Feed', icon: MessageSquare, color: 'var(--color-primary)' },
    { id: 'bills_signals', label: 'Bill\'s Signals', icon: MessageSquare, color: 'var(--color-primary)', subItem: true },
    { id: 'fx_clarity', label: 'POI VIP FXClarity', icon: MessageSquare, color: 'var(--color-primary)', subItem: true },
    { id: 'analysis', label: 'Price Analysis', icon: LineChart, color: 'var(--color-success)' },
    { id: 'statistics', label: 'Signal Statistics', icon: BarChart3, color: 'var(--color-warning)' },
    { id: 'signal_data_table', label: 'Signal Data Table', icon: BookOpen, color: 'var(--color-warning)', subItem: true },
    { id: 'tradeTimeline', label: 'Trade Timeline Feed', icon: Activity, color: 'var(--color-warning)', subItem: true },
    { id: 'simulator', label: 'Evaluation Simulator', icon: Target, color: 'var(--color-success)', subItem: true },
    { id: 'submit_signal', label: 'Submit New Signal', icon: Edit, color: 'var(--color-primary-hover)', subItem: true },
    { id: 'weekly_journal', label: 'Weekly Journal', icon: BookOpen, color: 'var(--color-accent)' },
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`sidebar-drawer ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="sidebar-content">
          <div className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`sidebar-link ${currentView === item.id ? 'active' : ''}`}
                onClick={() => {
                  onSetView(item.id);
                  onClose();
                }}
                style={{
                  '--active-color': item.color,
                  ...(item.subItem ? { 
                    marginLeft: '24px', 
                    paddingLeft: '12px', 
                    fontSize: '0.9em', 
                    borderLeft: '2px solid rgba(255,255,255,0.1)',
                    width: 'calc(100% - 24px)'
                  } : {})
                }}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
