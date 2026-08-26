import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Activity, Clock, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSignals = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables. Check .env');
      setLoading(false);
      return;
    }

    setIsRefreshing(true);
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error: fetchErr } = await client
      .from('tv_alerts')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(50); // Get last 50 signals

    setIsRefreshing(false);
    setLoading(false);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      setError(fetchErr.message);
      return;
    }

    if (data) {
      setSignals(data);
    }
  };

  useEffect(() => {
    fetchSignals();
    
    // Optional: Set up real-time subscription
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const subscription = client
        .channel('public:tv_alerts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_alerts' }, payload => {
          setSignals(current => [payload.new, ...current.slice(0, 49)]);
        })
        .subscribe();

      return () => {
        client.removeChannel(subscription);
      };
    }
  }, []);

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity className="text-primary" /> Live Signal Feed
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '14px', marginTop: '4px' }}>
              Real-time feed of signals ingested from Telegram and Webhooks.
            </p>
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={fetchSignals} 
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
        ) : signals.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No signals found in the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {signals.map((signal) => (
              <div 
                key={signal.id || Math.random().toString()} 
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
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      background: signal.action === 'BUY' ? 'rgba(52, 211, 153, 0.15)' : signal.action === 'SELL' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: signal.action === 'BUY' ? '#34D399' : signal.action === 'SELL' ? '#F87171' : '#94A3B8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      {signal.action || 'UNKNOWN'}
                    </div>
                    
                    <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-main)' }}>
                      {signal.symbol || 'SYSTEM'}
                    </div>

                    {signal.price && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        @ {signal.price}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-subtle)', fontSize: '12px' }}>
                    <Clock size={14} />
                    {new Date(signal.received_at || signal.created_at).toLocaleString()}
                  </div>
                </div>

                {signal.message && (
                  <div style={{
                    background: '#060913',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '13px',
                    color: '#cbd5e1',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {signal.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
