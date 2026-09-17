import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function BillsSignalsFeed() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMessages = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables. Check .env');
      setLoading(false);
      return;
    }

    setIsRefreshing(true);
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error: fetchErr } = await client
      .from('bills_signals')
      .select('*')
      .order('signal_date', { ascending: false })
      .limit(50);

    setIsRefreshing(false);
    setLoading(false);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      setError(fetchErr.message);
      return;
    }

    if (data) {
      setMessages(data);
    }
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
