import React, { useState, useEffect } from 'react';
import { useNhostClient } from '@nhost/react';
import { MessageSquare, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export default function BillsSignalsFeed() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const nhost = useNhostClient();

  const fetchMessages = async () => {
    setIsRefreshing(true);
    setError('');

    const query = `
      query GetBillsSignals {
        bills_signals(order_by: { signal_date: desc }, limit: 50) {
          id
          direction
          symbol
          entry_low
          entry_high
          sl
          tp1
          tp2
          tp3
          tp4
          tp5
          signal_date
        }
      }
    `;

    try {
      const { data, error: fetchErr } = await nhost.graphql.request(query);
      
      if (fetchErr) {
        console.error('Fetch error:', fetchErr);
        setError(Array.isArray(fetchErr) ? fetchErr[0].message : fetchErr.message || 'Unknown GraphQL error');
      } else if (data && data.bills_signals) {
        setMessages(data.bills_signals);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError(err.message);
    }

    setIsRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const formatSignalText = (msg) => {
    const direction = (msg.direction || 'UNKNOWN').toUpperCase();
    const symbol = (msg.symbol || '').toUpperCase();
    
    let text = `${direction} POSITION ${symbol} 🚨\n\n`;
    
    if (msg.entry_low && msg.entry_high) {
      text += `OPEN : ${msg.entry_low}-${msg.entry_high}\n`;
    } else if (msg.entry_low || msg.entry_high) {
      text += `OPEN : ${msg.entry_low || msg.entry_high}\n`;
    }
    
    if (msg.sl) text += `SL : ${msg.sl}\n`;
    if (msg.tp1) text += `TP1: ${msg.tp1}\n`;
    if (msg.tp2) text += `TP2: ${msg.tp2}\n`;
    if (msg.tp3) text += `TP3: ${msg.tp3}\n`;
    if (msg.tp4) text += `TP4: ${msg.tp4}\n`;
    if (msg.tp5) text += `TP5: ${msg.tp5}\n`;

    return text.trim();
  };

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare className="text-primary" /> Bill's Signals Feed
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '14px', marginTop: '4px' }}>
              Structured feed of signals from Bill's database.
            </p>
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={fetchMessages} 
            disabled={isRefreshing}
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            <span className="hide-mobile">Refresh</span>
          </button>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <AlertCircle size={20} />
            <div>
              <strong>Database Connection Error</strong>
              <div style={{ marginTop: '4px', fontSize: '13px' }}>{error}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading signals...
          </div>
        ) : messages.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No signals found in the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg) => (
              <div 
                key={msg.notion_id || msg.id || Math.random().toString()} 
                style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38BDF8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      Telegram
                    </div>
                    <div style={{
                      background: 'rgba(148, 163, 184, 0.15)',
                      color: '#94A3B8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '12px'
                    }}>
                      VIP group
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-subtle)', fontSize: '12px' }}>
                    <Clock size={14} />
                    {new Date(msg.signal_date || msg.created_at || Date.now()).toLocaleString()}
                  </div>
                </div>

                <div style={{
                  background: '#060913',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: '#f1f5f9',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {formatSignalText(msg)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
