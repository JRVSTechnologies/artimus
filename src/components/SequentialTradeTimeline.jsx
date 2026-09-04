import React, { useState, useEffect, useMemo } from 'react';
import { computeSignalMetrics, aggregateSignals } from '../lib/metrics';

export default function SequentialTradeTimeline() {
  const [dbData, setDbData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('bills');
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [exitModel, setExitModel] = useState('ladder');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingSignal, setEditingSignal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editStatusMsg, setEditStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/.netlify/functions/getSignals?provider=${provider}`);
        if (!response.ok) throw new Error(`Server returned status: ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        
        const mappedData = (json.data || []).map(row => {
          let dateStr = '';
          if (row.signal_date) {
            dateStr = new Date(row.signal_date).toLocaleString('en-US', { 
              timeZone: 'Asia/Jakarta', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
            }) + ' (GMT+7)';
          }
          return {
            'id': row.id || row.signal || '',
            'Signal': row.signal || '',
            'Date': dateStr,
            'Direction': row.direction || '',
            'Entry High': row.entry_high || '',
            'Entry Low': row.entry_low || '',
            'Raw Signal Text': row.raw_signal_text || '',
            'S/L': row.sl || '',
            'Session': row.session || (provider === 'fx_clarity' && row.raw_signal_text ? ((row.raw_signal_text.match(/POI ROUND \d/i) ? row.raw_signal_text.match(/POI ROUND \d/i)[0].toUpperCase() : 'Unknown') + (row.model ? ` - ${row.model}` : '')) : ''),
            'Source': row.source || '',
            'Status': row.status || '',
            'Symbol': row.symbol || '',
            'TP1': row.tp1 || '',
            'TP2': row.tp2 || '',
            'TP3': row.tp3 || '',
            'TP4': row.tp4 || '',
            'TP5': row.tp5 || ''
          };
        });
        setDbData(mappedData.filter(row => row.Status && row.Date));
      } catch (err) {
        setError(err.message || "Unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, [provider, refreshKey]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEditStatusMsg({ type: '', text: '' });

    try {
      const payload = {
        ...editingSignal,
        provider,
        signal_date: new Date(editingSignal.signal_date).toISOString()
      };

      const response = await fetch('/.netlify/functions/updateSignal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update signal');

      setEditStatusMsg({ type: 'success', text: 'Signal updated successfully!' });
      setTimeout(() => {
        setEditingSignal(null);
        setRefreshKey(old => old + 1);
      }, 1500);
    } catch (err) {
      setEditStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const computedSignals = useMemo(() => dbData.map(computeSignalMetrics), [dbData]);
  const agg = useMemo(() => aggregateSignals(computedSignals, exitModel), [computedSignals, exitModel]);

  const timelineSignals = useMemo(() => {
    let sigs = [...(agg.sortedSignals || [])];
    if (timelineFilter === 'Wins') sigs = sigs.filter(s => s.realizedR[exitModel] > 0);
    else if (timelineFilter === 'Losses') sigs = sigs.filter(s => s.realizedR[exitModel] < 0);
    
    if (sortOrder === 'desc') {
      sigs.reverse();
    }
    
    return sigs;
  }, [agg.sortedSignals, timelineFilter, exitModel, sortOrder]);

  if (loading) return <div className="p-8 text-gray-400">Loading timeline...</div>;
  if (error) return <div className="p-8 text-rose-400">Error: {error}</div>;

  return (
    <div className="analysis-dashboard">
        <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Sequential Trade Timeline</h1>
            <p>Review the day-by-day chronological feed of your executed signals.</p>
          </div>
          <div className="provider-toggle">
            <button
              onClick={() => setProvider('bills')}
              className={provider === 'bills' ? 'active-bills' : ''}
            >
              Bills Trading
            </button>
            <button
              onClick={() => setProvider('fx_clarity')}
              className={provider === 'fx_clarity' ? 'active-fx' : ''}
            >
              FX Clarity
            </button>
          </div>
        </div>

      <div className="filters-premium" style={{ marginBottom: '24px' }}>
        <div className="filter-group">
          <label>Exit Model</label>
          <select value={exitModel} onChange={(e) => setExitModel(e.target.value)} className="filter-select">
            <option value="conservative">Conservative (TP1)</option>
            <option value="ladder">Ladder (50/25/25)</option>
            <option value="optimistic">Optimistic (Max TP)</option>
          </select>
        </div>
      </div>

      <div className="chart-card-premium" style={{ marginTop: '0' }}>
        <div className="timeline-header">
          <h3 className="chart-card-title m-0" style={{ fontSize: '24px', margin: 0 }}>Trade Feed</h3>
          <div className="timeline-filters" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['All', 'Wins', 'Losses'].map(filterOption => (
              <button
                key={filterOption}
                onClick={() => setTimelineFilter(filterOption)}
                className={`timeline-filter-btn ${timelineFilter === filterOption ? 'active-' + filterOption.toLowerCase() : ''}`}
              >
                {filterOption}
              </button>
            ))}
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-card)', margin: '0 4px' }} />
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="timeline-filter-btn"
            >
              Date {sortOrder === 'asc' ? 'Asc ↑' : 'Desc ↓'}
            </button>
          </div>
        </div>

        <div className="timeline-list">
          {timelineSignals.map((s, idx) => {
            const isWin = s.realizedR[exitModel] > 0;
            const isLoss = s.realizedR[exitModel] < 0;
            const entryText = s['Entry High'] !== s['Entry Low'] ? `${s['Entry Low']} - ${s['Entry High']}` : s['Entry Low'];
            
            return (
              <div key={idx} className="timeline-item">
                <div className={`timeline-dot ${isWin ? 'dot-win' : isLoss ? 'dot-loss' : 'dot-neutral'}`} />

                <div className="timeline-card">
                  <div className="timeline-card-header">
                    <div className="timeline-meta">
                      <span className="timeline-date">{s.Date}</span>
                      <span className="timeline-separator">•</span>
                      <span className="timeline-session">{s.Session || 'Unknown Session'}</span>
                    </div>
                    <div className="timeline-badges">
                      <span className={`status-badge ${s.Status === 'TP Hit' ? 'success' : s.Status === 'SL Hit' ? 'danger' : 'warning'}`}>
                        {s.Status}
                      </span>
                      <span className={`status-badge ${isWin ? 'success' : isLoss ? 'danger' : 'warning'}`}>
                        {s.realizedR[exitModel] > 0 ? '+' : ''}{s.realizedR[exitModel].toFixed(2)}R
                      </span>
                      <button 
                        onClick={() => setEditingSignal({
                          id: s.id,
                          symbol: s.Symbol || '',
                          direction: s.Direction || 'Buy',
                          entry_high: s['Entry High'] || '',
                          entry_low: s['Entry Low'] || '',
                          sl: s['S/L'] || '',
                          tp1: s.TP1 || '',
                          tp2: s.TP2 || '',
                          tp3: s.TP3 || '',
                          tp4: s.TP4 || '',
                          tp5: s.TP5 || '',
                          tp6: s.TP6 || '',
                          tp7: s.TP7 || '',
                          session: s.Session || 'London',
                          status: s.Status || 'Open',
                          source: s.Source || 'Manual Entry',
                          raw_signal_text: s['Raw Signal Text'] || '',
                          signal_date: s.Date ? new Date(s.Date.replace(' (GMT+7)', '').replace(' at ', ' ')).toISOString().slice(0, 16) : ''
                        })}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="timeline-grid">
                    <div className="timeline-col">
                      <p className="timeline-label">Trade</p>
                      <p className="timeline-value">
                        <span className={s.Direction === 'Buy' ? 'text-green' : 'text-red'}>{s.Direction}</span> {s.Symbol || 'XAUUSD'}
                      </p>
                    </div>
                    <div className="timeline-col">
                      <p className="timeline-label">Entry</p>
                      <p className="timeline-value-subtle">{entryText}</p>
                    </div>
                    <div className="timeline-col">
                      <p className="timeline-label">Stop Loss</p>
                      <p className="timeline-value-danger">{s['S/L']}</p>
                    </div>
                    <div className="timeline-col">
                      <p className="timeline-label">Targets</p>
                      <p className="timeline-value-success" style={{ lineHeight: '1.4' }}>
                        {s.TP1 ? <div>TP1: {Number(s.TP1).toFixed(2)}</div> : <div>N/A</div>}
                        {s.TP2 ? <div>TP2: {Number(s.TP2).toFixed(2)}</div> : null}
                        {s.TP3 ? <div>TP3: {Number(s.TP3).toFixed(2)}</div> : null}
                        {s.TP4 ? <div>TP4: {Number(s.TP4).toFixed(2)}</div> : null}
                        {s.TP5 ? <div>TP5: {Number(s.TP5).toFixed(2)}</div> : null}
                        {s.TP6 ? <div>TP6: {Number(s.TP6).toFixed(2)}</div> : null}
                        {s.TP7 ? <div>TP7: {Number(s.TP7).toFixed(2)}</div> : null}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editingSignal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
          <div className="chart-card-premium" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="chart-card-title m-0">Edit Signal</h3>
              <button onClick={() => setEditingSignal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            </div>
            
            {editStatusMsg.text && (
              <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '6px', backgroundColor: editStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', border: `1px solid ${editStatusMsg.type === 'success' ? '#10b981' : '#f43f5e'}`, color: editStatusMsg.type === 'success' ? '#10b981' : '#f43f5e' }}>
                <span style={{ fontWeight: 600 }}>{editStatusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Symbol</label>
                  <input type="text" value={editingSignal.symbol} onChange={(e) => setEditingSignal({...editingSignal, symbol: e.target.value})} required style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Direction</label>
                  <select value={editingSignal.direction} onChange={(e) => setEditingSignal({...editingSignal, direction: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}>
                    <option value="Buy" style={{ color: '#000' }}>Buy</option>
                    <option value="Sell" style={{ color: '#000' }}>Sell</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Signal Date & Time</label>
                  <input type="datetime-local" value={editingSignal.signal_date} onChange={(e) => setEditingSignal({...editingSignal, signal_date: e.target.value})} required style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff', colorScheme: 'dark' }} />
                </div>
              </div>

              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Entry High</label>
                  <input type="number" step="any" value={editingSignal.entry_high} onChange={(e) => setEditingSignal({...editingSignal, entry_high: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Entry Low</label>
                  <input type="number" step="any" value={editingSignal.entry_low} onChange={(e) => setEditingSignal({...editingSignal, entry_low: e.target.value})} required style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Stop Loss</label>
                  <input type="number" step="any" value={editingSignal.sl} onChange={(e) => setEditingSignal({...editingSignal, sl: e.target.value})} required style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                </div>
              </div>

              <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {['tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'tp6', 'tp7'].map((tp, idx) => (
                  <div key={tp} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>TP {idx + 1}</label>
                    <input type="number" step="any" value={editingSignal[tp]} onChange={(e) => setEditingSignal({...editingSignal, [tp]: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                  </div>
                ))}
              </div>

              <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Session</label>
                  <select value={editingSignal.session} onChange={(e) => setEditingSignal({...editingSignal, session: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}>
                    <option value="London Pre" style={{ color: '#000' }}>London Pre</option>
                    <option value="London" style={{ color: '#000' }}>London</option>
                    <option value="London-NY Overlap" style={{ color: '#000' }}>London-NY Overlap</option>
                    <option value="NY Open" style={{ color: '#000' }}>NY Open</option>
                    <option value="NY PM" style={{ color: '#000' }}>NY PM</option>
                    <option value="Asian" style={{ color: '#000' }}>Asian</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Status</label>
                  <select value={editingSignal.status} onChange={(e) => setEditingSignal({...editingSignal, status: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }}>
                    <option value="Open" style={{ color: '#000' }}>Open</option>
                    <option value="TP Hit" style={{ color: '#000' }}>TP Hit</option>
                    <option value="SL Hit" style={{ color: '#000' }}>SL Hit</option>
                    <option value="Breakeven" style={{ color: '#000' }}>Breakeven</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Source</label>
                  <input type="text" value={editingSignal.source} onChange={(e) => setEditingSignal({...editingSignal, source: e.target.value})} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff' }} />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-subtle)', fontWeight: 600 }}>Raw Signal Text (Optional)</label>
                <textarea value={editingSignal.raw_signal_text} onChange={(e) => setEditingSignal({...editingSignal, raw_signal_text: e.target.value})} rows={3} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff', resize: 'vertical' }} />
              </div>

              <button type="submit" disabled={isSubmitting} style={{ padding: '12px 24px', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: '10px' }}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
