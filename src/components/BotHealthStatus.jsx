import React, { useState, useEffect } from 'react';
import { Server, Activity, CheckCircle, AlertTriangle, Clock, Cpu, HardDrive, Pause, Play, Copy, RefreshCw } from 'lucide-react';
import { useNhostClient } from '@nhost/react';

export default function BotHealthStatus() {
  const nhost = useNhostClient();
  const [telemetry, setTelemetry] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [feedLogs, setFeedLogs] = useState([]);
  const [hoveredBot, setHoveredBot] = useState(null);
  const [downtimeLogs, setDowntimeLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('botDowntimeLogs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const prevStatusRef = React.useRef({});

  useEffect(() => {
    const processTelemetryArray = (data) => {
      let hasStatusChange = false;
      const statusChanges = [];

      setTelemetry(prevMap => {
        const newTelemetryMap = { ...prevMap };
        data.forEach(item => {
          let isOnline = item.status === 'Online';
          if (item.last_active_at) {
             const diff = Math.floor((Date.now() - new Date(item.last_active_at).getTime()) / 1000);
             if (diff > 120) {
                 isOnline = false;
             }
          }
          const prevOnline = prevStatusRef.current[item.bot_id];
          if (prevOnline !== undefined && prevOnline !== isOnline) {
              statusChanges.push({ bot_id: item.bot_id, event: isOnline ? 'came online' : 'went offline', time: new Date().toLocaleString() });
              hasStatusChange = true;
          }
          prevStatusRef.current[item.bot_id] = isOnline;
          newTelemetryMap[item.bot_id] = item;
        });

        if (hasStatusChange) {
          setDowntimeLogs(prevLogs => {
              const updatedLogs = [...statusChanges.reverse(), ...prevLogs].slice(0, 100);
              localStorage.setItem('botDowntimeLogs', JSON.stringify(updatedLogs));
              return updatedLogs;
          });
        }
        return newTelemetryMap;
      });

      setFeedLogs(prev => {
        let updatedLogs = [...prev];
        data.forEach(item => {
          const lastLog = updatedLogs.find(l => l.bot_id === item.bot_id);
          if (!lastLog || lastLog.currently_thinking !== item.currently_thinking) {
            updatedLogs = [{ ...item, timestamp: new Date().toLocaleTimeString() }, ...updatedLogs].slice(0, 50);
          }
        });
        return updatedLogs;
      });
    };

    let pollInterval;

    const fetchTelemetry = async () => {
      try {
        const query = `
          query GetBotTelemetry {
            bot_telemetry {
              bot_id
              status
              currently_thinking
              last_task
              task_status
              last_active_at
            }
          }
        `;
        const { data, error } = await nhost.graphql.request(query);
        if (error) {
          console.error('Nhost GraphQL Error:', error);
          return;
        }
        if (data && data.bot_telemetry) {
          processTelemetryArray(data.bot_telemetry);
        }
      } catch (err) {
        console.error('Failed to fetch bot telemetry:', err);
      }
    };

    if (!isPaused) {
      fetchTelemetry();
      pollInterval = setInterval(() => {
        fetchTelemetry();
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isPaused, nhost]);

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
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="status-chip" 
            style={{ 
              background: isPaused ? 'rgba(244, 63, 94, 0.1)' : 'rgba(56, 189, 248, 0.1)', 
              color: isPaused ? '#F43F5E' : '#38BDF8', 
              borderColor: isPaused ? 'rgba(244, 63, 94, 0.25)' : 'rgba(56, 189, 248, 0.25)',
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              fontWeight: '600',
              fontFamily: 'inherit'
            }}
          >
            {isPaused ? <Pause size={16} /> : <Activity size={16} className="spin-slow" />}
            <span>{isPaused ? 'Monitoring Paused' : 'Live Telemetry Active'}</span>
          </button>
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
                <div 
                  className={`status-badge ${isOnline ? 'success' : 'danger'}`} 
                  style={{ position: 'relative', cursor: isOnline ? 'default' : 'help' }} 
                  onMouseEnter={() => !isOnline && setHoveredBot(bot.id)} 
                  onMouseLeave={() => setHoveredBot(null)}
                >
                  {isOnline ? 'Operational' : 'Issue Detected'}
                  {!isOnline && hoveredBot === bot.id && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        backgroundColor: '#1E293B',
                        border: '1px solid #475569',
                        padding: '12px',
                        borderRadius: '8px',
                        zIndex: 10,
                        width: '240px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        color: '#F8FAFC',
                        fontSize: '13px',
                        fontWeight: 'normal',
                        textTransform: 'none',
                        textAlign: 'left'
                    }}>
                        <div style={{ color: '#F43F5E', fontWeight: 'bold', marginBottom: '4px' }}>Offline / Unresponsive</div>
                        <div>Bot has been unresponsive for {formatIdleTime(t.last_active_at)}.</div>
                        {t.task_status === 'error' && <div style={{ marginTop: '4px', color: '#F43F5E' }}>Error: {t.currently_thinking}</div>}
                        {t.last_task && <div style={{ marginTop: '4px', color: '#94A3B8' }}>Last task: {t.last_task}</div>}
                    </div>
                  )}
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
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Downtime & Status Log</h3>
        </div>
        
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {downtimeLogs.length === 0 ? (
             <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No downtime recorded</div>
          ) : downtimeLogs.map((log, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${log.event === 'came online' ? '#10B981' : '#F43F5E'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '140px' }}>{log.time}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', minWidth: '120px' }}>{log.bot_id}</span>
                <span style={{ fontSize: '13px', color: log.event === 'came online' ? '#10B981' : '#F43F5E' }}>{log.event}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-card-premium" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Global Telemetry Feed</h3>

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
