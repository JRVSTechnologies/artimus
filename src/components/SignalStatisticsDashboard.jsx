import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, ScatterController } from 'chart.js';
import { Doughnut, Bar, Line, Scatter } from 'react-chartjs-2';
import { computeSignalMetrics, aggregateSignals } from '../lib/metrics';

// Register Chart.js components
ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, ScatterController
);

export default function SignalStatisticsDashboard() {
  const [dbData, setDbData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('bills');

  const [exitModel, setExitModel] = useState('ladder');
  const [selectedSession, setSelectedSession] = useState('All');
  const [selectedDirection, setSelectedDirection] = useState('All');
  const [performanceViewMode, setPerformanceViewMode] = useState('monthly');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingSignal, setEditingSignal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editStatusMsg, setEditStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        // Fetch from Netlify Serverless Function
        const response = await fetch(`/.netlify/functions/getSignals?provider=${provider}`);
        
        if (!response.ok) {
          throw new Error(`Server returned status: ${response.status}`);
        }
        
        const json = await response.json();
        
        if (json.error) {
          throw new Error(json.error);
        }
        
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

  const parsedData = dbData;

  // Compute metrics per signal
  const computedSignals = useMemo(() => {
    return parsedData.map(computeSignalMetrics);
  }, [parsedData]);

  // Apply filters
  const filteredSignals = useMemo(() => {
    return computedSignals.filter(s => {
      const matchSession = selectedSession === 'All' || s.Session === selectedSession;
      const matchDir = selectedDirection === 'All' || s.Direction === selectedDirection;
      return matchSession && matchDir;
    });
  }, [computedSignals, selectedSession, selectedDirection]);

  // Aggregate
  const agg = useMemo(() => {
    return aggregateSignals(filteredSignals, exitModel);
  }, [filteredSignals, exitModel]);

  const allSessions = ['All', ...new Set(computedSignals.map(s => s.Session).filter(Boolean))];
  const allDirections = ['All', 'Buy', 'Sell'];

  // Compute model stats for FX Clarity
  const modelStats = useMemo(() => {
    if (provider !== 'fx_clarity') return [];
    
    const stats = {};
    filteredSignals.forEach(s => {
      if (s.Model) {
        if (!stats[s.Model]) {
          stats[s.Model] = { model: s.Model, total: 0, wins: 0, losses: 0, realizedR: 0 };
        }
        stats[s.Model].total += 1;
        
        const r = s.realizedR[exitModel] || 0;
        stats[s.Model].realizedR += r;
        if (r > 0) stats[s.Model].wins += 1;
        if (r < 0) stats[s.Model].losses += 1;
      }
    });

    return Object.values(stats)
      .map(m => ({
        ...m,
        winRate: m.total > 0 ? (m.wins / m.total) * 100 : 0,
        expectancy: m.total > 0 ? m.realizedR / m.total : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSignals, exitModel, provider]);

  // --- Row 2: Equity Curve ---
  const equityChartData = {
    labels: agg.multiEquityCurve.map(s => s.index),
    datasets: [
      {
        label: 'Ladder (Default)',
        data: agg.multiEquityCurve.map(s => s.ladder),
        borderColor: '#38bdf8',
        backgroundColor: '#38bdf8',
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 0
      },
      {
        label: 'Conservative',
        data: agg.multiEquityCurve.map(s => s.conservative),
        borderColor: '#818cf8',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0
      },
      {
        label: 'Optimistic',
        data: agg.multiEquityCurve.map(s => s.optimistic),
        borderColor: '#34d399',
        borderWidth: 1,
        borderDash: [2, 2],
        pointRadius: 0
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (ctx) => {
            const dataIndex = ctx[0].dataIndex;
            const signal = agg.multiEquityCurve[dataIndex];
            return `${signal.name} | ${signal.date}`;
          },
          afterTitle: (ctx) => {
             const dataIndex = ctx[0].dataIndex;
             const signal = agg.multiEquityCurve[dataIndex];
             return `Session: ${signal.session} | Outcome: ${signal.outcome}`;
          },
          label: (ctx) => {
            let label = ctx.dataset.label || '';
            if (label) label += ': ';
            if (ctx.parsed.y !== null) label += ctx.parsed.y.toFixed(2) + 'R';
            return label;
          }
        }
      },
      legend: { position: 'top', labels: { color: '#f8fafc' } }
    },
    scales: {
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } },
      x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
    }
  };

  // --- Row 3: Outcomes Doughnut ---
  const outcomeChartData = {
    labels: ['TP Hit', 'SL Hit', 'Breakeven', 'Open'],
    datasets: [{
      data: [agg.outcomes.TP, agg.outcomes.SL, agg.outcomes.BE, agg.outcomes.Open],
      backgroundColor: ['#10b981', '#f43f5e', '#f59e0b', '#6b7280'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  // --- Row 3: Session Bar ---
  const sessionChartData = {
    labels: agg.sessionBreakdown.map(s => s.session),
    datasets: [{
      label: 'Expectancy (R)',
      data: agg.sessionBreakdown.map(s => s.expectancy.toFixed(2)),
      backgroundColor: '#8b5cf6'
    }]
  };

  // --- Row 5: Risk Anatomy Scatter ---
  const scatterData = {
    datasets: [
      {
        label: 'TP Hit',
        data: agg.sortedSignals.filter(s => s.Status === 'TP Hit').map(s => ({ x: (s.risk_pts * 10), y: s.realizedR[exitModel] })),
        backgroundColor: '#10b981'
      },
      {
        label: 'SL Hit',
        data: agg.sortedSignals.filter(s => s.Status === 'SL Hit').map(s => ({ x: (s.risk_pts * 10), y: s.realizedR[exitModel] })),
        backgroundColor: '#f43f5e'
      },
      {
        label: 'Breakeven',
        data: agg.sortedSignals.filter(s => s.Status === 'Breakeven').map(s => ({ x: (s.risk_pts * 10), y: s.realizedR[exitModel] })),
        backgroundColor: '#f59e0b'
      }
    ]
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#f8fafc' } }
    },
    scales: {
      y: { title: { display: true, text: 'Realized R', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } },
      x: { title: { display: true, text: 'SL Distance (Pips)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } }
    }
  };

  // --- Row 7: Rolling Performance ---
  const rollingChartData = {
    labels: agg.rollingPerformance.map(s => s.index),
    datasets: [
      {
        type: 'line',
        label: 'Rolling Expectancy (R)',
        data: agg.rollingPerformance.map(s => s.expectancy.toFixed(2)),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Rolling Win Rate (%)',
        data: agg.rollingPerformance.map(s => s.winRate.toFixed(1)),
        borderColor: '#38bdf8',
        backgroundColor: '#38bdf8',
        borderDash: [5, 5],
        yAxisID: 'y1'
      }
    ]
  };

  const rollingOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Expectancy (R)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } },
      y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Win Rate (%)', color: '#94a3b8' }, grid: { drawOnChartArea: false }, ticks: { color: '#94a3b8' } }
    }
  };

  // --- Monthly Heatmap ---
  const monthlyChartData = {
    labels: (agg.monthlyStats || []).map(m => m.monthYear),
    datasets: [{
      label: 'Realized R',
      data: (agg.monthlyStats || []).map(m => m.r.toFixed(2)),
      backgroundColor: (agg.monthlyStats || []).map(m => m.r >= 0 ? '#10b981' : '#f43f5e'),
      borderRadius: 4
    }]
  };
  const monthlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { title: { display: true, text: 'Net Realized R', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } },
      x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
    }
  };

  // --- Daily Heatmap ---
  const dailyChartData = {
    labels: (agg.dailyStats || []).map(d => d.dayStr.replace(/, \d{4}/, '')), // e.g. "Apr 15"
    datasets: [{
      label: 'Realized R',
      data: (agg.dailyStats || []).map(d => d.r.toFixed(2)),
      backgroundColor: (agg.dailyStats || []).map(d => d.r >= 0 ? '#10b981' : '#f43f5e'),
      borderRadius: 2
    }]
  };
  const dailyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const dataIndex = context.dataIndex;
            const stats = agg.dailyStats[dataIndex];
            return `Trades: ${stats.total} (W: ${stats.wins}, L: ${stats.losses})`;
          }
        }
      }
    },
    scales: {
      y: { title: { display: true, text: 'Net Realized R', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } },
      x: { ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }, grid: { display: false } }
    }
  };

  let mostProfitableMonth = { monthYear: '-', r: 0 };
  let worstMonth = { monthYear: '-', r: 0 };
  let bestMonth = { monthYear: '-', winRate: 0 };
  let mostLossesMonth = { monthYear: '-', losses: 0 };

  if (agg.monthlyStats && agg.monthlyStats.length > 0) {
    mostProfitableMonth = agg.monthlyStats.reduce((prev, curr) => (prev.r > curr.r) ? prev : curr);
    worstMonth = agg.monthlyStats.reduce((prev, curr) => (prev.r < curr.r) ? prev : curr);
    
    // Best month by win rate (minimum 5 trades)
    const validMonthsForWR = agg.monthlyStats.filter(m => m.total >= 5);
    if (validMonthsForWR.length > 0) {
      bestMonth = validMonthsForWR.reduce((prev, curr) => {
        const pWr = prev.total > 0 ? prev.wins / prev.total : 0;
        const cWr = curr.total > 0 ? curr.wins / curr.total : 0;
        return cWr > pWr ? curr : prev;
      });
      bestMonth.winRate = (bestMonth.wins / bestMonth.total) * 100;
    }

    mostLossesMonth = agg.monthlyStats.reduce((prev, curr) => (prev.losses > curr.losses) ? prev : curr);
  }

  // Heatmap helper
  // Create a 7x24 grid
  const heatmapGrid = Array(7).fill(0).map(() => Array(24).fill({ count: 0, r: 0 }));
  agg.sortedSignals.forEach(s => {
    if (s.wibDay !== undefined && s.wibHour !== undefined) {
      const cell = heatmapGrid[s.wibDay][s.wibHour];
      heatmapGrid[s.wibDay][s.wibHour] = {
        count: cell.count + 1,
        r: cell.r + (s.realizedR[exitModel] || 0)
      };
    }
  });

  const getHeatmapColor = (r, count) => {
    if (count === 0) return 'transparent';
    const exp = r / count;
    if (exp > 0.5) return 'rgba(16, 185, 129, 0.8)';
    if (exp > 0) return 'rgba(16, 185, 129, 0.4)';
    if (exp < -0.5) return 'rgba(244, 63, 94, 0.8)';
    if (exp < 0) return 'rgba(244, 63, 94, 0.4)';
    return 'rgba(245, 158, 11, 0.4)';
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="analysis-dashboard">
        <div className="dashboard-header-premium">
          <h1>Loading Dashboard Data...</h1>
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

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header-premium">
        <div className="header-row">
          <div>
            <h1>VIP Signal Analytics</h1>
            <p>Evaluate signal edge, session dependency, and execution models.</p>
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

      {/* Global Filter Bar */}
      <div className="filters-premium">
        <div className="filter-group">
          <label>Exit Model</label>
          <select value={exitModel} onChange={(e) => setExitModel(e.target.value)} className="filter-select">
            <option value="conservative">Conservative (TP1)</option>
            <option value="ladder">Ladder (50/25/25)</option>
            <option value="optimistic">Optimistic (Max TP)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Session</label>
          <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} className="filter-select">
            {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Direction</label>
          <select value={selectedDirection} onChange={(e) => setSelectedDirection(e.target.value)} className="filter-select">
            {allDirections.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Row 1: KPI Strip */}
      <div className="stats-row" style={{ marginBottom: '24px' }}>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Total Signals</div>
            <div className="stat-card-value">{agg.totalClosed} <span className="stat-card-sub">closed</span></div>
          </div>
        </div>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Win Rate</div>
            <div className="stat-card-value text-green">{agg.winRate.toFixed(1)}%</div>
            <div className="stat-card-sub">{agg.beRate.toFixed(1)}% BE</div>
          </div>
        </div>
        <div className="stat-card-premium highlight">
          <div>
            <div className="stat-card-title text-blue">Expectancy (R)</div>
            <div className={`stat-card-value ${agg.expectancy >= 0 ? 'text-green' : 'text-red'}`}>
              {agg.expectancy > 0 ? '+' : ''}{agg.expectancy.toFixed(2)}R
            </div>
          </div>
        </div>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Profit Factor</div>
            <div className="stat-card-value text-purple">{agg.profitFactor.toFixed(2)}</div>
          </div>
        </div>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Max Drawdown</div>
            <div className="stat-card-value text-red">-{agg.maxDD.toFixed(2)}R</div>
          </div>
        </div>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Current Streak</div>
            <div className={`stat-card-value ${agg.currentStreak > 0 ? 'text-green' : 'text-red'}`}>
              {agg.currentStreak > 0 ? 'W' : (agg.currentStreak < 0 ? 'L' : '')}{Math.abs(agg.currentStreak)}
            </div>
          </div>
        </div>
        <div className="stat-card-premium">
          <div>
            <div className="stat-card-title">Average SL Pips</div>
            <div className="stat-card-value text-blue">{agg.avgSLPips.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Row 2: Equity Curve */}
      <div className="chart-card-premium">
        <h3 className="chart-card-title">Cumulative R (Equity Curve)</h3>
        <div style={{ height: '350px', position: 'relative' }}>
          <Line data={equityChartData} options={lineOptions} />
        </div>
      </div>

      {/* Row 3: Breakdowns */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr 1fr', marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Outcomes</h3>
          <div style={{ height: '200px', position: 'relative' }}>
            <Doughnut data={outcomeChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: {color:'#f8fafc'} } } }} />
          </div>
        </div>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Expectancy by Session</h3>
          <div style={{ height: '200px', position: 'relative' }}>
            <Bar data={sessionChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.05)'} }, x: { ticks:{color:'#94a3b8'}, grid:{display:false} } } }} />
          </div>
        </div>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Direction Skew</h3>
          <div style={{ marginBottom: '16px' }}>
            <div className="stat-card-sub">Buy Signals ({agg.directionBreakdown.Buy.total})</div>
            <div className="stat-card-value text-green" style={{ fontSize: '20px' }}>
              {(agg.directionBreakdown.Buy.total > 0 ? (agg.directionBreakdown.Buy.r / agg.directionBreakdown.Buy.total) : 0).toFixed(2)}R Exp
            </div>
          </div>
          <div>
            <div className="stat-card-sub">Sell Signals ({agg.directionBreakdown.Sell.total})</div>
            <div className="stat-card-value text-red" style={{ fontSize: '20px' }}>
              {(agg.directionBreakdown.Sell.total > 0 ? (agg.directionBreakdown.Sell.r / agg.directionBreakdown.Sell.total) : 0).toFixed(2)}R Exp
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Timing Heatmap */}
      <div className="chart-card-premium" style={{ overflowX: 'auto' }}>
        <h3 className="chart-card-title">Timing Heatmap (WIB)</h3>
        <p className="stat-card-sub" style={{ marginBottom: '20px' }}>Hover to see signal count and average R. Green = Positive Expectancy, Red = Negative Expectancy.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(24, 1fr)', gap: '4px', minWidth: '800px' }}>
          <div></div>
          {[...Array(24)].map((_, i) => <div key={i} style={{ fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>{i}</div>)}
          
          {daysOfWeek.map((day, dIdx) => (
            <React.Fragment key={day}>
              <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600, alignSelf: 'center' }}>{day}</div>
              {heatmapGrid[dIdx].map((cell, hIdx) => (
                <div 
                  key={`${dIdx}-${hIdx}`} 
                  title={`Count: ${cell.count}\nExp: ${cell.count > 0 ? (cell.r/cell.count).toFixed(2) : 0}R`}
                  style={{ 
                    height: '28px', 
                    backgroundColor: getHeatmapColor(cell.r, cell.count),
                    borderRadius: '4px',
                    border: cell.count > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#fff',
                    transition: 'transform 0.2s',
                    cursor: cell.count > 0 ? 'pointer' : 'default'
                  }}
                  onMouseEnter={(e) => { if(cell.count > 0) e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {cell.count > 0 ? cell.count : ''}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Row 5: Risk Anatomy */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">SL Distance vs Outcome</h3>
          <div style={{ height: '300px', position: 'relative' }}>
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
        </div>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Realized R Distribution</h3>
          <div style={{ height: '300px', position: 'relative' }}>
            <Bar 
              data={{
                labels: ['< -1R', '-1R', '0R', '0-1R', '1-2R', '2-3R', '3R+'],
                datasets: [{
                  label: 'Frequency',
                  data: [
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] < -1).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] === -1).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] === 0).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] > 0 && s.realizedR[exitModel] <= 1).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] > 1 && s.realizedR[exitModel] <= 2).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] > 2 && s.realizedR[exitModel] <= 3).length,
                    agg.sortedSignals.filter(s => s.realizedR[exitModel] > 3).length,
                  ],
                  backgroundColor: '#38BDF8',
                  borderRadius: 4
                }]
              }} 
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.05)'} }, x: { ticks:{color:'#94a3b8'}, grid:{display:false} } } }} 
            />
          </div>
        </div>
      </div>

      {/* Performance Timeline Section */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: performanceViewMode === 'monthly' ? '2fr 1fr' : '1fr', marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0, minWidth: 0, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 className="chart-card-title" style={{ margin: 0 }}>Performance Timeline</h3>
            <div className="provider-toggle" style={{ transform: 'scale(0.85)', transformOrigin: 'right center', margin: 0 }}>
              <button
                onClick={() => setPerformanceViewMode('monthly')}
                className={performanceViewMode === 'monthly' ? 'active-bills' : ''}
              >
                Month by Month
              </button>
              <button
                onClick={() => setPerformanceViewMode('weekly')}
                className={performanceViewMode === 'weekly' ? 'active-bills' : ''}
              >
                Week by Week
              </button>
              <button
                onClick={() => setPerformanceViewMode('daily')}
                className={performanceViewMode === 'daily' ? 'active-bills' : ''}
              >
                Day by Day
              </button>
            </div>
          </div>

          <div className="custom-scrollbar" style={{ height: '360px', overflowX: 'auto', overflowY: 'hidden', position: 'relative', width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px' }}>
            {/* Custom Timeline Implementation */}
            {(() => {
               let timelineData = [];
               if (performanceViewMode === 'monthly') {
                 timelineData = (agg.monthlyStats || []).map(m => ({ label: m.monthYear, r: m.r }));
               } else if (performanceViewMode === 'weekly') {
                 timelineData = (agg.weeklyStats || []).map(w => ({ label: w.weekStr, r: w.r }));
               } else {
                 timelineData = (agg.dailyStats || []).map(d => ({ label: d.dayStr.replace(/, \d{4}/, ''), r: d.r }));
               }
               const maxAbsR = Math.max(...timelineData.map(d => Math.abs(d.r)), 1);
               
               return (
                 <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', padding: '0 40px', minWidth: 'min-content' }}>
                   {/* Center Line */}
                   <div style={{ position: 'absolute', top: '50%', left: '20px', right: '20px', height: '2px', backgroundColor: '#334155', zIndex: 0 }} />
                   
                   {timelineData.map((item, i) => {
                     const rValue = item.r;
                     const isPositive = rValue >= 0;
                     const heightRatio = Math.abs(rValue) / maxAbsR;
                     const stemHeight = Math.max(20, heightRatio * 110); // Max stem 110px

                     return (
                       <div key={i} style={{ position: 'relative', width: '100px', flexShrink: 0, height: '100%' }}>
                         {/* Date Label */}
                         <div style={{ 
                           position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                           marginTop: isPositive ? '24px' : '-24px', color: '#94a3b8', fontSize: '11px', textAlign: 'center', width: '90px', fontWeight: 500
                         }}>
                           {item.label}
                         </div>

                         {/* Axis Node */}
                         <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }} />

                         {/* Stem */}
                         <div style={{
                           position: 'absolute', left: '50%', width: '2px', backgroundColor: isPositive ? '#10b981' : '#f43f5e', transform: 'translateX(-50%)', zIndex: 1,
                           ...(isPositive ? { bottom: '50%', height: `${stemHeight}px` } : { top: '50%', height: `${stemHeight}px` })
                         }} />

                         {/* Diamond and Label Wrapper */}
                         <div style={{
                           position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                           ...(isPositive ? { bottom: `calc(50% + ${stemHeight}px)` } : { top: `calc(50% + ${stemHeight}px)` })
                         }}>
                           {isPositive ? (
                             <>
                               <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '6px', fontSize: '13px' }}>+{rValue.toFixed(2)}R</div>
                               <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', transform: 'rotate(45deg)', border: '2px solid var(--bg-dashboard)' }} />
                             </>
                           ) : (
                             <>
                               <div style={{ width: '12px', height: '12px', backgroundColor: '#f43f5e', transform: 'rotate(45deg)', border: '2px solid var(--bg-dashboard)' }} />
                               <div style={{ color: '#f43f5e', fontWeight: 'bold', marginTop: '6px', fontSize: '13px' }}>{rValue.toFixed(2)}R</div>
                             </>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               );
            })()}
          </div>
        </div>

        {/* Monthly Insights Panel - only show when in Monthly view */}
        {performanceViewMode === 'monthly' && (
          <div className="chart-card-premium" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="chart-card-title">Monthly Insights</h3>
            
            <div>
              <div className="stat-card-title" style={{ fontSize: '13px' }}>Most Profitable Month</div>
              <div className="stat-card-value text-green" style={{ fontSize: '18px' }}>{mostProfitableMonth.monthYear}</div>
              <div className="stat-card-sub" style={{ color: '#10b981' }}>+{mostProfitableMonth.r.toFixed(2)}R</div>
            </div>
            
            <div>
              <div className="stat-card-title" style={{ fontSize: '13px' }}>Worst Month</div>
              <div className="stat-card-value text-red" style={{ fontSize: '18px' }}>{worstMonth.monthYear}</div>
              <div className="stat-card-sub" style={{ color: '#f43f5e' }}>{worstMonth.r.toFixed(2)}R</div>
            </div>

            <div>
              <div className="stat-card-title" style={{ fontSize: '13px' }}>Best Win Rate (Min 5 trades)</div>
              <div className="stat-card-value text-blue" style={{ fontSize: '18px' }}>{bestMonth.monthYear}</div>
              <div className="stat-card-sub" style={{ color: '#38bdf8' }}>{bestMonth.winRate ? bestMonth.winRate.toFixed(1) : 0}% Win Rate</div>
            </div>

            <div>
              <div className="stat-card-title" style={{ fontSize: '13px' }}>Most Losses Month</div>
              <div className="stat-card-value text-purple" style={{ fontSize: '18px' }}>{mostLossesMonth.monthYear}</div>
              <div className="stat-card-sub" style={{ color: '#c084fc' }}>{mostLossesMonth.losses} SL Hits</div>
            </div>
          </div>
        )}
      </div>



      {/* Model Performance (FX Clarity Only) */}
      {provider === 'fx_clarity' && modelStats.length > 0 && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '24px' }}>
          <div className="chart-card-premium" style={{ marginBottom: 0 }}>
            <h3 className="chart-card-title">Model Performance Breakdown</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-premium" style={{ minWidth: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Signals Count</th>
                    <th>Win Rate</th>
                    <th>Expectancy (R)</th>
                    <th>Total Realized R</th>
                  </tr>
                </thead>
                <tbody>
                  {modelStats.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{fontWeight: 700}}>{m.model}</td>
                      <td>{m.total}</td>
                      <td className={m.winRate >= 50 ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{m.winRate.toFixed(1)}%</td>
                      <td className={m.expectancy >= 0 ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{(m.expectancy > 0 ? '+' : '')}{m.expectancy.toFixed(2)}R</td>
                      <td className={m.realizedR >= 0 ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{(m.realizedR > 0 ? '+' : '')}{m.realizedR.toFixed(2)}R</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Control Panel (Filters) */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr', marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">CFX Kill-Zone Comparison</h3>
          <table className="table-premium" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                <th>Metric</th>
                <th>All Signals</th>
                <th>Kill-Zone Only</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Count</td>
                <td>{agg.totalClosed}</td>
                <td className="text-blue" style={{fontWeight: 700}}>{agg.cfxStats.total}</td>
              </tr>
              <tr>
                <td>Win Rate</td>
                <td>{agg.winRate.toFixed(1)}%</td>
                <td className="text-blue" style={{fontWeight: 700}}>{agg.cfxStats.winRate.toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Expectancy</td>
                <td>{agg.expectancy.toFixed(2)}R</td>
                <td className={agg.cfxStats.expectancy > agg.expectancy ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{agg.cfxStats.expectancy.toFixed(2)}R</td>
              </tr>
              <tr>
                <td>Profit Factor</td>
                <td>{agg.profitFactor.toFixed(2)}</td>
                <td className="text-blue" style={{fontWeight: 700}}>{agg.cfxStats.profitFactor.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Max DD</td>
                <td>-{agg.maxDD.toFixed(2)}R</td>
                <td className="text-blue" style={{fontWeight: 700}}>-{agg.cfxStats.maxDD.toFixed(2)}R</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Rolling Performance (20-Signal)</h3>
          <div style={{ height: '220px', position: 'relative' }}>
            <Line data={rollingChartData} options={rollingOptions} />
          </div>
        </div>
      </div>

      {/* Row 8: Signals Table */}
      <div className="chart-card-premium">
        <h3 className="chart-card-title">Signals Data Table</h3>
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
              {agg.sortedSignals.slice(-10).reverse().map((s, idx) => (
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
                  <td className={s.realizedR[exitModel] > 0 ? 'text-green' : s.realizedR[exitModel] < 0 ? 'text-red' : ''} style={{fontWeight: 700}}>
                    {s.realizedR[exitModel].toFixed(2)}R
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
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-subtle)' }}>
            Showing last 10 closed signals
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
