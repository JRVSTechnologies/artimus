import React, { useState, useEffect, useMemo } from 'react';
import { computeSignalMetrics, aggregateSignals } from '../lib/metrics';

export default function SequentialTradeTimeline() {
  const [dbData, setDbData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('bills');
  const [timelineFilter, setTimelineFilter] = useState('All');
  const [exitModel, setExitModel] = useState('ladder');

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
            'Signal': row.signal || '',
            'Date': dateStr,
            'Direction': row.direction || '',
            'Entry High': row.entry_high || '',
            'Entry Low': row.entry_low || '',
            'Raw Signal Text': row.raw_signal_text || '',
            'S/L': row.sl || '',
            'Session': row.session || (provider === 'fx_clarity' && row.raw_signal_text ? (row.raw_signal_text.match(/POI ROUND \d/i) ? row.raw_signal_text.match(/POI ROUND \d/i)[0].toUpperCase() : 'Unknown') : ''),
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
  }, [provider]);

  const computedSignals = useMemo(() => dbData.map(computeSignalMetrics), [dbData]);
  const agg = useMemo(() => aggregateSignals(computedSignals, exitModel), [computedSignals, exitModel]);

  const timelineSignals = useMemo(() => {
    let sigs = [...(agg.sortedSignals || [])];
    if (timelineFilter === 'Wins') sigs = sigs.filter(s => s.realizedR[exitModel] > 0);
    else if (timelineFilter === 'Losses') sigs = sigs.filter(s => s.realizedR[exitModel] < 0);
    return sigs;
  }, [agg.sortedSignals, timelineFilter, exitModel]);

  if (loading) return <div className="p-8 text-gray-400">Loading timeline...</div>;
  if (error) return <div className="p-8 text-rose-400">Error: {error}</div>;

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header-premium flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1>Sequential Trade Timeline</h1>
          <p>Review the day-by-day chronological feed of your executed signals.</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2 bg-gray-800 p-1 rounded-full border border-gray-700 shadow-inner">
          <button
            onClick={() => setProvider('bills')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
              provider === 'bills' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            Bills Trading
          </button>
          <button
            onClick={() => setProvider('fx_clarity')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
              provider === 'fx_clarity' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
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
          <div className="timeline-filters">
            {['All', 'Wins', 'Losses'].map(filterOption => (
              <button
                key={filterOption}
                onClick={() => setTimelineFilter(filterOption)}
                className={`timeline-filter-btn ${timelineFilter === filterOption ? \`active-\${filterOption.toLowerCase()}\` : ''}`}
              >
                {filterOption}
              </button>
            ))}
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
                      <p className="timeline-value-success">
                        {s.TP1 ? `TP1: ${Number(s.TP1).toFixed(2)}` : 'N/A'}<br/>
                        {s.TP2 ? `TP2: ${Number(s.TP2).toFixed(2)}` : ''}<br/>
                        {s.TP3 ? `TP3: ${Number(s.TP3).toFixed(2)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
