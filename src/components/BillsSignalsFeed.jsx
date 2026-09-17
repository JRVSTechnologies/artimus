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

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '800px' }}>
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
          <div className="alert-box alert-error" style={{ minWidth: '800px' }}>
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
          <div style={{
            background: '#060913',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.05)',
            overflowX: 'auto'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '13px', 
              textAlign: 'left',
              minWidth: '1000px'
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-subtle)'
                }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Signal</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Open (Low/High)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>SL</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 1</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 2</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 3</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 4</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 5</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, idx) => {
                  const direction = (msg.direction || 'UNKNOWN').toUpperCase();
                  const symbol = (msg.symbol || '').toUpperCase();
                  const isBuy = direction === 'BUY';
                  
                  let openValue = '-';
                  if (msg.entry_low && msg.entry_high) openValue = `${msg.entry_low} - ${msg.entry_high}`;
                  else if (msg.entry_low || msg.entry_high) openValue = `${msg.entry_low || msg.entry_high}`;

                  const dateObj = new Date(msg.signal_date || Date.now());
                  // e.g., 09/17/2026
                  const dateStr = dateObj.toLocaleDateString();
                  // e.g., 14:30:00
                  const timeStr = dateObj.toLocaleTimeString();

                  return (
                    <tr 
                      key={msg.id || Math.random().toString()} 
                      style={{ 
                        borderBottom: idx === messages.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{dateStr}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-subtle)' }}>{timeStr}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: isBuy ? '#34D399' : '#F87171' }}>
                        {direction} {symbol}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#f1f5f9' }}>{openValue}</td>
                      <td style={{ padding: '12px 16px', color: '#F87171' }}>{msg.sl || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{msg.tp1 || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{msg.tp2 || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{msg.tp3 || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{msg.tp4 || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{msg.tp5 || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
