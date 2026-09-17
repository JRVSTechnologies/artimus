import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function FxClarityFeed() {
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

    // Fetch messages specifically from POI VIP FXCLARITY
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
    let isParsed = false;

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      
      if (upperLine.match(/^[A-Z]{6}\s*(📉|📈)/)) {
        symbol = upperLine.replace(/📉|📈/g, '').trim();
        isParsed = true;
      } else if (upperLine.includes('BUY LIMIT') || upperLine.includes('SELL LIMIT') || upperLine.includes('BUY ZONE') || upperLine.includes('SELL ZONE')) {
        if (upperLine.includes('BUY')) direction = 'BUY';
        if (upperLine.includes('SELL')) direction = 'SELL';
        
        const openMatch = upperLine.match(/(?:LIMIT|ZONE)\s+([\d\.-]+)/);
        if (openMatch) open = openMatch[1];
        isParsed = true;
      }
      
      if (upperLine.startsWith('OPEN :') || upperLine.startsWith('OPEN:')) {
        open = upperLine.replace(/OPEN\s*:/, '').trim();
        isParsed = true;
      }
      
      if (upperLine.startsWith('SL :') || upperLine.startsWith('SL:') || upperLine.startsWith('SL ')) {
        sl = upperLine.replace(/SL\s*:?/, '').replace(/🛑.*/, '').trim();
        isParsed = true;
      }
      
      if (upperLine.startsWith('TP')) {
        const tpVal = upperLine.replace(/TP\d*\s*:?/, '').trim();
        tps.push(tpVal);
        isParsed = true;
      }
    });

    return { direction, symbol, open, sl, tps, isParsed };
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
              Parsed signals from the POI VIP FXCLARITY Telegram feed.
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
                  
                  const dateObj = new Date(msg.received_at || msg.created_at);
                  const dateStr = dateObj.toLocaleDateString();
                  const timeStr = dateObj.toLocaleTimeString();

                  const isBuy = parsed.direction === 'BUY';
                  const signalColor = isBuy ? '#34D399' : (parsed.direction === 'SELL' ? '#F87171' : '#f1f5f9');

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
                      
                      {parsed.isParsed ? (
                        <>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: signalColor }}>
                            {parsed.direction} {parsed.symbol}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#f1f5f9' }}>{parsed.open}</td>
                          <td style={{ padding: '12px 16px', color: '#F87171' }}>{parsed.sl}</td>
                          <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[0] || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[1] || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#34D399' }}>{parsed.tps[2] || '-'}</td>
                        </>
                      ) : (
                        <td colSpan={6} style={{ padding: '12px 16px', color: 'var(--text-subtle)', whiteSpace: 'pre-wrap' }}>
                          <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '12px' }}>
                            {displayMessage}
                          </div>
                        </td>
                      )}
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
