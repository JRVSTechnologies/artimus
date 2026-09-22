import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function TelegramLiveFeed() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

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
      .order('received_at', { ascending: false })
      .limit(50); // Get last 50 telegram messages

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
    
    // Set up real-time subscription for Telegram messages
    let subscription;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      subscription = client
        .channel('public:tv_alerts:telegram')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_alerts', filter: 'interval=eq.TG_GROUP' }, payload => {
          setMessages(current => [payload.new, ...current.slice(0, 49)]);
        })
        .subscribe();
    }


    return () => {
      if (subscription && SUPABASE_URL && SUPABASE_ANON_KEY) {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        client.removeChannel(subscription);
      }
    };
  }, []);

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare className="text-primary" /> Telegram Live Feed
            </h2>
            <p style={{ color: 'var(--text-subtle)', fontSize: '14px', marginTop: '4px' }}>
              Real-time feed of raw messages from your Telegram VIP groups.
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
            Loading messages...
          </div>
        ) : messages.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No Telegram messages found in the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(() => {
              const uniqueGroups = ['All', ...new Set(messages.map(msg => {
                if (msg.message && msg.message.startsWith('[')) {
                  const endBracket = msg.message.indexOf(']\n');
                  if (endBracket !== -1) return msg.message.substring(1, endBracket);
                }
                return null;
              }).filter(Boolean))];

              const filteredMessages = activeFilter === 'All' ? messages : messages.filter(msg => {
                if (msg.message && msg.message.startsWith('[')) {
                  const endBracket = msg.message.indexOf(']\n');
                  if (endBracket !== -1) return msg.message.substring(1, endBracket) === activeFilter;
                }
                return false;
              });

              return (
                <>
                  {uniqueGroups.length > 1 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {uniqueGroups.map(group => (
                        <button
                          key={group}
                          onClick={() => setActiveFilter(group)}
                          style={{
                            background: activeFilter === group ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            color: activeFilter === group ? '#38BDF8' : 'var(--text-subtle)',
                            border: `1px solid ${activeFilter === group ? 'rgba(56, 189, 248, 0.3)' : 'transparent'}`,
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No messages match this filter.
                    </div>
                  ) : filteredMessages.map((msg) => {
              let chatTitle = 'Unknown Group';
              let displayMessage = msg.message || 'No content provided.';
              
              if (displayMessage.startsWith('[')) {
                const endBracket = displayMessage.indexOf(']\n');
                if (endBracket !== -1) {
                  chatTitle = displayMessage.substring(1, endBracket);
                  displayMessage = displayMessage.substring(endBracket + 2);
                }
              }

              return (
              <div 
                key={msg.id || Math.random().toString()} 
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
                    {chatTitle !== 'Unknown Group' && (
                      <div style={{
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94A3B8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '12px'
                      }}>
                        {chatTitle}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-subtle)', fontSize: '12px' }}>
                    <Clock size={14} />
                    {new Date(msg.received_at || msg.created_at).toLocaleString()}
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
                  {displayMessage}
                </div>
              </div>
            )})}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
