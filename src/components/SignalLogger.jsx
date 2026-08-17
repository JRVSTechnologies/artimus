import React, { useState } from 'react';
import { Activity, Copy, Check, Terminal, Code2, Trash2 } from 'lucide-react';

export default function SignalLogger({ logs, onClearLogs }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');

  const curlExample = `curl -X POST https://your-site.netlify.app/.netlify/functions/process-signal \\
  -H "Content-Type: application/json" \\
  -d '{
    "ticker": "BTC/USD",
    "action": "BUY_SIGNAL",
    "price": "92450.00",
    "message": "Artimus automated serverless alert"
  }'`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', background: 'rgba(192, 132, 252, 0.15)', borderRadius: '10px', color: 'var(--color-accent)' }}>
            <Activity size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px' }}>Signal Stream & Webhooks</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>
              Monitor incoming data and inspect Netlify function endpoints
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn btn-secondary ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Terminal size={14} /> Activity ({logs.length})
          </button>
          <button 
            className={`btn btn-secondary ${activeTab === 'webhook' ? 'active' : ''}`}
            onClick={() => setActiveTab('webhook')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Code2 size={14} /> Webhook API
          </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Recent Signal Executions</span>
            {logs.length > 0 && (
              <button 
                onClick={onClearLogs}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={12} /> Clear Log
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              border: '1px dashed var(--border-card)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-subtle)'
            }}>
              <Activity size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ fontSize: '14px' }}>No signals logged yet.</p>
              <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                Click "Send Hello World" above to trigger your first serverless signal log.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {logs.map((log, index) => (
                <div 
                  key={index}
                  style={{
                    background: 'rgba(6, 9, 19, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: log.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: log.status === 'SUCCESS' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)'
                    }}>
                      {log.type} • {log.status}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{log.timestamp}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-main)' }}>
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Send external webhooks (TradingView, custom python scripts, cron jobs) to your Netlify serverless endpoint:
          </p>

          <div className="code-block">
            <button className="copy-badge" onClick={() => copyToClipboard(curlExample)}>
              {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy cURL'}
            </button>
            {curlExample}
          </div>
        </div>
      )}
    </div>
  );
}
