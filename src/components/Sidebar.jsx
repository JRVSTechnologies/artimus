import React from 'react';
import { X, LayoutDashboard, LineChart, BookOpen, Activity, BarChart3, Edit, Target } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, currentView, onSetView }) {
  const menuItems = [
    { id: 'main', label: 'Main Hub', icon: LayoutDashboard, color: '#38BDF8' },
    { id: 'signal_feed', label: 'Live Signal Feed', icon: Activity, color: '#f43f5e' },
    { id: 'analysis', label: 'Price Analysis', icon: LineChart, color: '#10b981' },
    { id: 'statistics', label: 'Signal Statistics', icon: BarChart3, color: '#f59e0b' },
    { id: 'tradeTimeline', label: 'Trade Timeline Feed', icon: Activity, color: '#f59e0b', subItem: true },
    { id: 'simulator', label: 'Evaluation Simulator', icon: Target, color: '#10b981', subItem: true },
    { id: 'submit_signal', label: 'Submit New Signal', icon: Edit, color: '#0ea5e9', subItem: true },
    { id: 'weekly_journal', label: 'Weekly Journal', icon: BookOpen, color: '#8b5cf6' },
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
