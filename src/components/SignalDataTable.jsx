import React, { useState, useEffect, useMemo } from 'react';
import { computeSignalMetrics } from '../lib/metrics';

export default function SignalDataTable() {
  const [dbData, setDbData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('bills');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [riskMin, setRiskMin] = useState('');
  const [riskMax, setRiskMax] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination & Editing
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSignal, setEditingSignal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editStatusMsg, setEditStatusMsg] = useState({ type: '', text: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  const exitModel = 'ladder'; // default exit model for viewing R

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
              timeZone: 'Asia/Jakarta', 
              month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
            }) + ' (GMT+7)';
          }
          return {
            'id': row.id || row.signal || '',
            'Signal': row.signal || '',
            'Date': dateStr,
            'signal_date': row.signal_date, // keep original for filtering
            'Direction': row.direction || '',
            'Entry High': row.entry_high || '',
            'Entry Low': row.entry_low || '',
            'Model': row.model || '',
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
        console.error("Error fetching signals:", err);
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

  const computedSignals = useMemo(() => {
    return dbData.map(computeSignalMetrics);
  }, [dbData]);

  const filteredSignals = useMemo(() => {
    let result = computedSignals;

    if (fromDate) {
      result = result.filter(s => {
        if (!s.signal_date) return false;
        return new Date(s.signal_date) >= new Date(fromDate);
      });
    }
    if (toDate) {
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      
      result = result.filter(s => {
        if (!s.signal_date) return false;
        return new Date(s.signal_date) <= toDateEnd;
      });
    }
    if (sessionFilter !== 'All') {
      result = result.filter(s => s.Session === sessionFilter);
    }
    if (directionFilter !== 'All') {
      result = result.filter(s => s.Direction === directionFilter);
    }
    if (statusFilter !== 'All') {
      result = result.filter(s => s.Status === statusFilter);
    }
    if (riskMin !== '') {
      result = result.filter(s => (s.risk_pts * 10) >= parseFloat(riskMin));
    }
    if (riskMax !== '') {
      result = result.filter(s => (s.risk_pts * 10) <= parseFloat(riskMax));
    }

    // Sort descending by date
    return result.sort((a, b) => new Date(b.signal_date) - new Date(a.signal_date));
  }, [computedSignals, fromDate, toDate, sessionFilter, directionFilter, statusFilter, riskMin, riskMax]);

  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, sessionFilter, directionFilter, statusFilter, riskMin, riskMax, provider]);

  const allSessions = ['All', ...new Set(computedSignals.map(s => s.Session).filter(Boolean))];
  const allDirections = ['All', 'Buy', 'Sell'];
  const allStatuses = ['All', 'TP Hit', 'SL Hit', 'Breakeven', 'Open'];

  if (loading) {
    return (
      <div className="analysis-dashboard">
        <div className="dashboard-header-premium">
          <h1>Loading Data Table...</h1>
          <p>Fetching latest signals from the database</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-dashboard">
        <div className="dashboard-header-premium">
          <h1 className="text-red">Error loading data</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredSignals.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentSignals = filteredSignals.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header-premium">
        <div className="header-row">
          <div>
            <h1>Signals Data Table</h1>
            <p>Advanced filtering and data view for all signals.</p>
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
      </div>

      <div className="filters-premium" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="filter-group" style={{ flex: '2 1 250px' }}>
          <label>Date Range</label>
          <div className="filter-select" style={{ display: 'flex', alignItems: 'center', padding: '0', overflow: 'hidden' }}>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)} 
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '14px', colorScheme: 'dark' }}
            />
            <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)} 
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '14px', colorScheme: 'dark' }}
            />
          </div>
        </div>
        <div className="filter-group" style={{ flex: '1 1 150px' }}>
          <label>Session</label>
          <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="filter-select" style={{ width: '100%' }}>
            {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ flex: '1 1 150px' }}>
          <label>Direction</label>
          <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className="filter-select" style={{ width: '100%' }}>
            {allDirections.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ flex: '1 1 150px' }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select" style={{ width: '100%' }}>
            {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ flex: '2 1 200px' }}>
          <label>Risk Range (Pips)</label>
          <div className="filter-select" style={{ display: 'flex', alignItems: 'center', padding: '0', overflow: 'hidden' }}>
            <input 
              type="number" 
              placeholder="Min" 
              value={riskMin} 
              onChange={(e) => setRiskMin(e.target.value)} 
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
            />
            <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            <input 
              type="number" 
              placeholder="Max" 
              value={riskMax} 
              onChange={(e) => setRiskMax(e.target.value)} 
              style={{ flex: 1, minWidth: 0, padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>
      </div>

      <div className="chart-card-premium" style={{ marginTop: '24px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-premium">
            <thead>
              <tr>
                <th>Date</th>
                <th>Session</th>
                <th>Direction</th>
                <th>Risk (Pips)</th>
                <th>Status</th>
                <th>Realized R</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSignals.length > 0 ? currentSignals.map((s, idx) => (
                <tr key={idx}>
                  <td>{s.Date}</td>
                  <td>{s.Session}</td>
                  <td className={s.Direction === 'Buy' ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{s.Direction}</td>
                  <td>{(s.risk_pts * 10).toFixed(1)}</td>
                  <td>
                    <span className={`status-badge ${s.Status === 'TP Hit' ? 'success' : s.Status === 'SL Hit' ? 'danger' : 'warning'}`}>
                      {s.Status}
                    </span>
                  </td>
                  <td className={s.realizedR && s.realizedR[exitModel] > 0 ? 'text-green' : s.realizedR && s.realizedR[exitModel] < 0 ? 'text-red' : ''} style={{fontWeight: 700}}>
                    {s.realizedR ? s.realizedR[exitModel].toFixed(2) : '0.00'}R
                  </td>
                  <td>
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
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No signals found matching the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '0 8px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredSignals.length)} - {Math.min(currentPage * itemsPerPage, filteredSignals.length)} of {filteredSignals.length} signals
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)', color: currentPage === 1 ? '#64748b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '13px', color: '#94a3b8', margin: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ background: currentPage === totalPages || totalPages === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)', color: currentPage === totalPages || totalPages === 0 ? '#64748b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
              >
                Next
              </button>
            </div>
          </div>
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
