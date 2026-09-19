import React, { useState, useEffect } from 'react';
import { Server, Activity, CheckCircle, AlertTriangle, Clock, Cpu, HardDrive, Pause, Play, Copy, RefreshCw } from 'lucide-react';

export default function BotHealthStatus() {
  const [telemetry, setTelemetry] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [feedLogs, setFeedLogs] = useState([]);

  useEffect(() => {
    let timer;
    const fetchTelemetry = async () => {
      if (isPaused) return;
      try {
        const res = await fetch('/.netlify/functions/botTelemetry');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        
        const newTelemetryMap = {};
        if (Array.isArray(data)) {
          data.forEach(item => {
            newTelemetryMap[item.bot_id] = item;
            // Add to feed if it's a new state
            setFeedLogs(prev => {
              const lastLog = prev.find(l => l.bot_id === item.bot_id);
              if (!lastLog || lastLog.currently_thinking !== item.currently_thinking) {
                return [{ ...item, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 50);
              }
              return prev;
            });
          });
        }
        setTelemetry(newTelemetryMap);
      } catch (err) {
        console.error('Failed to fetch bot telemetry:', err);
      }
    };

    fetchTelemetry();
    timer = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Idle time clock tick
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatIdleTime = (lastActiveAt) => {
    if (!lastActiveAt) return 'Unknown';
    const diff = Math.floor((now - new Date(lastActiveAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s}s`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const bots = [
    {
      id: 'artimus',
      name: 'Artimus Bot',
      purpose: 'Core signal processing, telemetry orchestration, and webhook management hub.',
      skillset: ['Signal Parsing', 'Webhook Routing', 'Task Orchestration'],
      memory: '142 MB',
      cpu: '2.4%',
      ping: '45ms',
      color: '#38BDF8'
    },
    {
      id: 'telegram-bot',
      name: 'Telegram Listener Bot',
      purpose: 'Monitors real-time market data, executes price analysis, and manages market alerts.',
      skillset: ['Price Tracking', 'Algorithmic Evaluation', 'Statistical Analysis'],
      memory: '210 MB',
      cpu: '5.1%',
      ping: '62ms',
      color: '#10B981'
    },
    {
      id: 'userbot',
      name: 'Userbot Forwarder',
      purpose: 'Listens to raw telegram signals and forwards to webhooks.',
      skillset: ['Channel Monitoring', 'Fast Forwarding'],
      memory: '95 MB',
      cpu: '1.2%',
      ping: '30ms',
      color: '#C084FC'
    }
  ];

  return (
    <div className="bot-health-container" style={{ paddingBottom: '40px' }}>
      <div className="dashboard-header-premium">
        <div className="header-row">
          <div>
            <h1>Bot Health Status</h1>
            <p>Real-time monitoring and telemetry for deployed bots</p>
          </div>
          <div className="status-chip" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
            <Activity size={16} />
            <span>Live Telemetry Active</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {bots.map((bot) => {
          const t = telemetry[bot.id] || { status: 'Offline', currently_thinking: 'Awaiting next task...', task_status: 'success', last_task: 'None', last_active_at: null };
          let isOnline = t.status === 'Online';
          
          if (t.last_active_at) {
             const diff = Math.floor((Date.now() - new Date(t.last_active_at).getTime()) / 1000);
             if (diff > 120) {
                 isOnline = false; // Mark offline if no heartbeat in 2 minutes
             }
          }
          
          return (
            <div key={bot.id} className="chart-card-premium" style={{ borderTop: `4px solid ${bot.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `rgba(255, 255, 255, 0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: bot.color }}>
                    <Server size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{bot.name}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div className="pulse-dot" style={{ backgroundColor: isOnline ? '#10B981' : '#F43F5E', boxShadow: 'none', animation: 'none' }}></div>
                      {t.status}
                    </div>
                  </div>
                </div>
                <div className={`status-badge ${isOnline ? 'success' : 'danger'}`}>
                  {isOnline ? 'Operational' : 'Issue Detected'}
                </div>
              </div>

              <div className="stats-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '16px' }}>
                <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', width: '32px', height: '32px' }}>
                    <Clock size={16} />
                  </div>
                  <div>
                    <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>Idle Time</div>
                    <div className="stat-card-value" style={{ fontSize: '18px' }}>{formatIdleTime(t.last_active_at)}</div>
                  </div>
                </div>

                <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                  <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', width: '32px', height: '32px' }}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>Last Execution</div>
                    <div className="stat-card-value" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={t.last_task}>
                      {t.last_task}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className={isPaused ? '' : 'spin-slow'} /> 
                    Currently Thinking
                  </div>
                </div>
                
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '13px', 
                  color: t.task_status === 'error' ? '#F43F5E' : '#38BDF8',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '6px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {t.currently_thinking}
                </div>
              </div>

            </div>
          );
        })}
      </div>
      
      <div className="chart-card-premium" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Global Telemetry Feed</h3>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
        
        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }} aria-live="polite">
          {feedLogs.length === 0 ? (
             <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent telemetry events</div>
          ) : feedLogs.map((log, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${log.task_status === 'error' ? '#F43F5E' : log.task_status === 'success' ? '#10B981' : '#38BDF8'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '80px' }}>{log.timestamp}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', minWidth: '120px' }}>{log.bot_id}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>{log.currently_thinking}</span>
              </div>
              <button onClick={() => copyToClipboard(log.currently_thinking)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <Copy size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
