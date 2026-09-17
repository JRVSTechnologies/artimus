import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, AlertCircle, RefreshCw, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function FxClarityFeed() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statuses, setStatuses] = useState({});
  
  useEffect(() => {
    const saved = localStorage.getItem('fxclarity_signal_statuses');
    if (saved) {
      try { setStatuses(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const updateStatus = (id, status) => {
    const newStatuses = { ...statuses };
    if (newStatuses[id] === status) {
      delete newStatuses[id]; // toggle off
    } else {
      newStatuses[id] = status;
    }
    setStatuses(newStatuses);
    localStorage.setItem('fxclarity_signal_statuses', JSON.stringify(newStatuses));
  };

  const fetchMessages = async () => {
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
      .eq('interval', 'TG_GROUP')
      .ilike('message', '[POI VIP FXCLARITY]%')
      .order('received_at', { ascending: false })
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
    
    let subscription;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      subscription = client
        .channel('public:tv_alerts:fxclarity')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_alerts', filter: 'interval=eq.TG_GROUP' }, payload => {
          if (payload.new.message && payload.new.message.startsWith('[POI VIP FXCLARITY]')) {
            setMessages(current => [payload.new, ...current.slice(0, 49)]);
          }
        })
        .subscribe();
    }

    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (subscription && SUPABASE_URL && SUPABASE_ANON_KEY) {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        client.removeChannel(subscription);
      }
    };
  }, []);

  const parseSignal = (rawText) => {
    let direction = '';
    let symbol = '';
    let open = '-';
    let sl = '-';
    let tps = [];

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      
      if (upperLine.match(/^[A-Z]{6}\s*(📉|📈)/)) {
        symbol = upperLine.replace(/📉|📈/g, '').trim();
      } else if (upperLine.includes('BUY LIMIT') || upperLine.includes('SELL LIMIT') || upperLine.includes('BUY ZONE') || upperLine.includes('SELL ZONE')) {
        if (upperLine.includes('BUY')) direction = 'BUY';
        if (upperLine.includes('SELL')) direction = 'SELL';
        
        const openMatch = upperLine.match(/(?:LIMIT|ZONE)\s+([\d\.-]+)/);
        if (openMatch) open = openMatch[1];
      }
      
      if (upperLine.startsWith('OPEN :') || upperLine.startsWith('OPEN:')) {
        open = upperLine.replace(/OPEN\s*:/, '').trim();
      }
      
      if (upperLine.startsWith('SL :') || upperLine.startsWith('SL:') || upperLine.startsWith('SL ')) {
        sl = upperLine.replace(/SL\s*:?/, '').replace(/🛑.*/, '').trim();
      }
      
      if (upperLine.startsWith('TP')) {
        const tpVal = upperLine.replace(/TP\d*\s*:?/, '').trim();
        tps.push(tpVal);
      }
    });

    return { direction, symbol, open, sl, tps };
  };

  const getRowStyle = (msgId, isLast) => {
    const status = statuses[msgId];
    let base = { 
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
      transition: 'all 0.2s ease',
      borderLeft: '4px solid transparent'
    };
    if (status === 'WIN') return { ...base, background: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10B981' };
    if (status === 'BE') return { ...base, background: 'rgba(100, 116, 139, 0.15)', borderLeft: '4px solid #94A3B8' };
    if (status === 'LOSS') return { ...base, background: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #EF4444' };
    return base;
  };

  const getBtnStyle = (type, currentStatus) => {
    const isActive = type === currentStatus;
    let color = '#94A3B8';
    if (type === 'WIN') color = '#10B981';
    if (type === 'BE') color = '#94A3B8';
    if (type === 'LOSS') color = '#EF4444';
    
    return {
      background: isActive ? color : 'transparent',
      color: isActive ? '#fff' : color,
      border: `1px solid ${color}`,
      borderRadius: '4px',
      padding: '4px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: isActive ? 1 : 0.6
    };
  };

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '800px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare className="text-primary" /> POI VIP FXClarity
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '14px', marginTop: '4px' }}>
              Parsed signals from the POI VIP FXCLARITY Telegram feed. Click the status icons to track outcomes.
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
            No signals found in the Telegram feed for POI VIP FXCLARITY.
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
              minWidth: '1050px'
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-subtle)'
                }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600', width: '80px' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Signal</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Open (Low/High)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>SL</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 1</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 2</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>TP 3</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, idx) => {
                  let displayMessage = msg.message || '';
                  if (displayMessage.startsWith('[')) {
                    const endBracket = displayMessage.indexOf(']\n');
                    if (endBracket !== -1) {
                      displayMessage = displayMessage.substring(endBracket + 2);
                    }
                  }

                  const parsed = parseSignal(displayMessage);
                  if (!parsed.direction) return null; // filter out free text
                  
                  const dateObj = new Date(msg.received_at || msg.created_at);
                  const dateStr = dateObj.toLocaleDateString();
                  const timeStr = dateObj.toLocaleTimeString();

                  const isBuy = parsed.direction === 'BUY';
                  const signalColor = isBuy ? '#34D399' : (parsed.direction === 'SELL' ? '#F87171' : '#f1f5f9');
                  const currentStatus = statuses[msg.id];

                  return (
                    <tr 
                      key={msg.id} 
                      style={getRowStyle(msg.id, idx === messages.length - 1)}
                      onMouseEnter={(e) => {
                        if (!currentStatus) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      }}
                      onMouseLeave={(e) => {
                        if (!currentStatus) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => updateStatus(msg.id, 'WIN')} style={getBtnStyle('WIN', currentStatus)} title="Mark as Win">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => updateStatus(msg.id, 'BE')} style={getBtnStyle('BE', currentStatus)} title="Mark as Breakeven">
                            <MinusCircle size={14} />
                          </button>
                          <button onClick={() => updateStatus(msg.id, 'LOSS')} style={getBtnStyle('LOSS', currentStatus)} title="Mark as Loss">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{dateStr}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-subtle)' }}>{timeStr}</td>
                      
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: signalColor }}>
                        {parsed.direction} {parsed.symbol}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#f1f5f9' }}>{parsed.open}</td>
                      <td style={{ padding: '12px 16px', color: '#F87171' }}>{parsed.sl}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[0] || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[1] || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[2] || '-'}</td>
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
