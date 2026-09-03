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
        console.error("Error fetching signals:", err);
        setError(err.message || "Unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, [provider]);

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
        data: agg.sortedSignals.filter(s => s.Status === 'TP Hit').map(s => ({ x: s.risk_pts, y: s.realizedR[exitModel] })),
        backgroundColor: '#10b981'
      },
      {
        label: 'SL Hit',
        data: agg.sortedSignals.filter(s => s.Status === 'SL Hit').map(s => ({ x: s.risk_pts, y: s.realizedR[exitModel] })),
        backgroundColor: '#f43f5e'
      },
      {
        label: 'Breakeven',
        data: agg.sortedSignals.filter(s => s.Status === 'Breakeven').map(s => ({ x: s.risk_pts, y: s.realizedR[exitModel] })),
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
      x: { title: { display: true, text: 'SL Distance (Points)', color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: 'var(--border-card)' } }
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

      {/* Row 5.25: Day by Day Performance */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0, minWidth: 0, width: '100%' }}>
          <h3 className="chart-card-title">Day-by-Day Performance</h3>
          <div className="custom-scrollbar" style={{ height: '320px', overflowX: 'auto', overflowY: 'hidden', position: 'relative', width: '100%' }}>
            <div style={{ width: `${Math.max(100, (agg.dailyStats || []).length * 40)}px`, height: '280px', paddingRight: '20px' }}>
              <Bar data={dailyChartData} options={dailyOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 5.5: Month on Month Analysis */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: '24px' }}>
        <div className="chart-card-premium" style={{ marginBottom: 0 }}>
          <h3 className="chart-card-title">Month on Month Heatmap</h3>
          <div style={{ height: '300px', position: 'relative' }}>
            <Bar data={monthlyChartData} options={monthlyOptions} />
          </div>
        </div>
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
      </div>



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
                <th>Risk (Pts)</th>
                <th>Status</th>
                <th>Realized R</th>
              </tr>
            </thead>
            <tbody>
              {agg.sortedSignals.slice(-10).reverse().map((s, idx) => (
                <tr key={idx}>
                  <td>{s.Date}</td>
                  <td>{s.Session}</td>
                  <td className={s.Direction === 'Buy' ? 'text-green' : 'text-red'} style={{fontWeight: 700}}>{s.Direction}</td>
                  <td>{s.risk_pts.toFixed(1)}</td>
                  <td>
                    <span className={`status-badge ${s.Status === 'TP Hit' ? 'success' : s.Status === 'SL Hit' ? 'danger' : 'warning'}`}>
                      {s.Status}
                    </span>
                  </td>
                  <td className={s.realizedR[exitModel] > 0 ? 'text-green' : s.realizedR[exitModel] < 0 ? 'text-red' : ''} style={{fontWeight: 700}}>
                    {s.realizedR[exitModel].toFixed(2)}R
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



    </div>
  );
}
