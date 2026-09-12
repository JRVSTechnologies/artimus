import React, { useState, useEffect } from 'react';
import { Server, Activity, CheckCircle, AlertTriangle, Clock, Cpu, HardDrive } from 'lucide-react';

export default function BotHealthStatus() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated(new Date());
    }, 5000); // Mock refresh every 5s
    return () => clearInterval(timer);
  }, []);

  const bots = [
    {
      id: 'artimus',
      name: 'Artimus Bot',
      purpose: 'Core signal processing, telemetry orchestration, and webhook management hub.',
      skillset: ['Signal Parsing', 'Webhook Routing', 'Task Orchestration'],
      status: 'Online',
      uptime: '99.98%',
      memory: '142 MB',
      cpu: '2.4%',
      ping: '45ms',
      errors: 0,
      lastSync: lastUpdated.toLocaleTimeString(),
      color: '#38BDF8'
    },
    {
      id: 'mcn_markets',
      name: 'MCN Markets Bot',
      purpose: 'Monitors real-time market data, executes price analysis, and manages market alerts.',
      skillset: ['Price Tracking', 'Algorithmic Evaluation', 'Statistical Analysis'],
      status: 'Online',
      uptime: '99.95%',
      memory: '210 MB',
      cpu: '5.1%',
      ping: '62ms',
      errors: 1,
      lastSync: lastUpdated.toLocaleTimeString(),
      color: '#10B981'
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
        {bots.map((bot) => (
          <div key={bot.id} className="chart-card-premium" style={{ borderTop: `4px solid ${bot.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `rgba(${bot.color === '#38BDF8' ? '56, 189, 248' : '16, 185, 129'}, 0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: bot.color }}>
                  <Server size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{bot.name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <div className="pulse-dot" style={{ backgroundColor: bot.status === 'Online' ? '#10B981' : '#F43F5E', boxShadow: 'none', animation: 'none' }}></div>
                    {bot.status} • Last Sync: {bot.lastSync}
                  </div>
                </div>
              </div>
              <div className={`status-badge ${bot.status === 'Online' ? 'success' : 'danger'}`}>
                {bot.status === 'Online' ? 'Operational' : 'Issue Detected'}
              </div>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Primary Purpose</div>
                <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>{bot.purpose}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>Core Skillset</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {bot.skillset.map((skill, idx) => (
                    <span key={idx} style={{ padding: '4px 10px', background: `rgba(${bot.color === '#38BDF8' ? '56, 189, 248' : '16, 185, 129'}, 0.1)`, color: bot.color, fontSize: '12px', borderRadius: '999px', border: `1px solid rgba(${bot.color === '#38BDF8' ? '56, 189, 248' : '16, 185, 129'}, 0.2)` }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', width: '32px', height: '32px' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>Uptime</div>
                  <div className="stat-card-value" style={{ fontSize: '18px' }}>{bot.uptime}</div>
                </div>
              </div>

              <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', width: '32px', height: '32px' }}>
                  <Activity size={16} />
                </div>
                <div>
                  <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>Latency (Ping)</div>
                  <div className="stat-card-value" style={{ fontSize: '18px' }}>{bot.ping}</div>
                </div>
              </div>

              <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="stat-icon" style={{ background: 'rgba(192, 132, 252, 0.1)', color: '#C084FC', width: '32px', height: '32px' }}>
                  <Cpu size={16} />
                </div>
                <div>
                  <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>CPU Usage</div>
                  <div className="stat-card-value" style={{ fontSize: '18px' }}>{bot.cpu}</div>
                </div>
              </div>

              <div className="stat-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', width: '32px', height: '32px' }}>
                  <HardDrive size={16} />
                </div>
                <div>
                  <div className="stat-card-title" style={{ marginBottom: '2px', fontSize: '11px' }}>Memory Usage</div>
                  <div className="stat-card-value" style={{ fontSize: '18px' }}>{bot.memory}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: bot.errors > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {bot.errors > 0 ? (
                <>
                  <AlertTriangle size={20} className="text-orange" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{bot.errors} Minor Warning(s)</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Check logs for recent non-critical exceptions.</div>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle size={20} className="text-green" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>System Healthy</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>No recent errors or warnings detected.</div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
