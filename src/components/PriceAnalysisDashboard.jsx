import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function PriceAnalysisDashboard() {
  const [alertsData, setAlertsData] = useState([]);
  const [uniqueSymbols, setUniqueSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [error, setError] = useState('');
  const [trendBias, setTrendBias] = useState('Neutral');
  const [biasProb, setBiasProb] = useState(50);
  
  const priceChartRef = useRef(null);
  const volumeChartRef = useRef(null);
  const priceChartInst = useRef(null);
  const volumeChartInst = useRef(null);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables. Check .env');
      return;
    }
    
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    async function fetchData() {
      const { data, error } = await client
        .from('tv_alerts')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Fetch error:', error);
        setError(error.message);
        return;
      }

      if (data) {
        setAlertsData(data);
        const syms = [...new Set(data.map(d => d.symbol).filter(Boolean))];
        setUniqueSymbols(syms);
        if (syms.length > 0) setSelectedSymbol(syms[0]);
      }
    }
    fetchData();
  }, []);

  // Render Volume Chart
  useEffect(() => {
    if (alertsData.length === 0 || !volumeChartRef.current) return;

    const symbolCounts = alertsData.reduce((acc, curr) => {
      if (curr.symbol) acc[curr.symbol] = (acc[curr.symbol] || 0) + 1;
      return acc;
    }, {});

    const sortedSymbols = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const ctx = volumeChartRef.current.getContext('2d');
    if (volumeChartInst.current) volumeChartInst.current.destroy();

    volumeChartInst.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedSymbols.map(s => s[0]),
        datasets: [{
          label: 'Alerts',
          data: sortedSymbols.map(s => s[1]),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    return () => {
      if (volumeChartInst.current) volumeChartInst.current.destroy();
    };
  }, [alertsData]);

  // Render Price Chart
  useEffect(() => {
    if (alertsData.length === 0 || !priceChartRef.current || !selectedSymbol) return;

    const symData = alertsData
      .filter(d => d.symbol === selectedSymbol && (d.interval === '15' || d.interval === '15m') && (d.price !== null || d.bar_close !== null))
      .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));

    if (symData.length === 0) {
      if (priceChartInst.current) priceChartInst.current.destroy();
      setTrendBias('No 15m Data');
      return;
    }

    const labels = symData.map(d => {
      const date = new Date(d.bar_time || d.received_at);
      return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    const dataPoints = symData.map(d => d.price || d.bar_close);

    // Helper to extract values (fallback to price/bar_close if high/low missing)
    const getHigh = d => d.bar_high ?? d.high ?? d.price ?? d.bar_close;
    const getLow = d => d.bar_low ?? d.low ?? d.price ?? d.bar_close;
    const getClose = d => d.bar_close ?? d.price;

    let currentTrend = 'Neutral';
    let bosCount = 0;
    
    let lastHH = null;
    let lastHL = null;
    let lastLH = null;
    let lastLL = null;

    let bullishBOS = new Array(symData.length).fill(null);
    let bearishBOS = new Array(symData.length).fill(null);
    let bullishCHoCH = new Array(symData.length).fill(null);
    let bearishCHoCH = new Array(symData.length).fill(null);

    for (let i = 0; i < symData.length; i++) {
      // 1. Fractal Detection (Delayed by 2 candles)
      if (i >= 4) {
        const i2 = i - 2;
        const h0 = getHigh(symData[i - 4]), h1 = getHigh(symData[i - 3]), h2 = getHigh(symData[i2]), h3 = getHigh(symData[i - 1]), h4 = getHigh(symData[i]);
        const l0 = getLow(symData[i - 4]), l1 = getLow(symData[i - 3]), l2 = getLow(symData[i2]), l3 = getLow(symData[i - 1]), l4 = getLow(symData[i]);

        const isSwingHigh = (h2 > h0 && h2 > h1 && h2 > h3 && h2 > h4);
        const isSwingLow  = (l2 < l0 && l2 < l1 && l2 < l3 && l2 < l4);

        if (isSwingHigh) {
          if (currentTrend === 'Bullish' || currentTrend === 'Neutral') {
             lastHH = lastHH === null ? h2 : Math.max(lastHH, h2);
          }
          if (currentTrend === 'Bearish' || currentTrend === 'Neutral') {
             lastLH = h2; // Most recent swing high is the CHoCH level for downtrend
          }
        }
        if (isSwingLow) {
          if (currentTrend === 'Bullish' || currentTrend === 'Neutral') {
             lastHL = l2; // Most recent swing low is the CHoCH level for uptrend
          }
          if (currentTrend === 'Bearish' || currentTrend === 'Neutral') {
             lastLL = lastLL === null ? l2 : Math.min(lastLL, l2);
          }
        }
      }

      // 2. BOS & CHoCH Detection on Current Candle Close
      const currentCandle = symData[i];
      const close = getClose(currentCandle);
      const high = getHigh(currentCandle);
      const low = getLow(currentCandle);

      if (currentTrend === 'Bullish') {
         // Bullish BOS
         if (lastHH !== null && close > lastHH) {
            lastHH = high; // Update Last_HH to the new high
            bosCount++;
            bullishBOS[i] = close;
            console.log(`[${new Date(currentCandle.received_at).toISOString()}] 🟢 Bullish BOS Validated. BOS Count: ${bosCount}`);
         }
         // Bearish CHoCH
         else if (lastHL !== null && close < lastHL) {
            currentTrend = 'Bearish';
            bosCount = 0;
            lastLH = high;
            lastLL = low;
            bearishCHoCH[i] = close;
            console.log(`[${new Date(currentCandle.received_at).toISOString()}] 🔴 Bearish CHoCH Detected. Trend changed to Bearish.`);
         }
      } 
      else if (currentTrend === 'Bearish') {
         // Bearish BOS
         if (lastLL !== null && close < lastLL) {
            lastLL = low; // Update Last_LL to the new low
            bosCount++;
            bearishBOS[i] = close;
            console.log(`[${new Date(currentCandle.received_at).toISOString()}] 🔴 Bearish BOS Validated. BOS Count: ${bosCount}`);
         }
         // Bullish CHoCH
         else if (lastLH !== null && close > lastLH) {
            currentTrend = 'Bullish';
            bosCount = 0;
            lastHH = high;
            lastHL = low;
            bullishCHoCH[i] = close;
            console.log(`[${new Date(currentCandle.received_at).toISOString()}] 🟢 Bullish CHoCH Detected. Trend changed to Bullish.`);
         }
      }
      else if (currentTrend === 'Neutral') {
         // Initialization phase if structure breaks before a trend is established
         if (lastHH !== null && close > lastHH) {
            currentTrend = 'Bullish';
            bosCount = 1;
            lastHH = high;
            bullishBOS[i] = close;
         } else if (lastLL !== null && close < lastLL) {
            currentTrend = 'Bearish';
            bosCount = 1;
            lastLL = low;
            bearishBOS[i] = close;
         }
      }
    }

    // Determine final bias based on BOS count confirmation
    // "The algorithm should only validate a strong trend when BOS_Count >= 2."
    let confirmedTrend = 'Neutral';
    if (currentTrend === 'Bullish' && bosCount >= 2) confirmedTrend = 'Strong Bullish';
    else if (currentTrend === 'Bullish' && bosCount < 2) confirmedTrend = 'Weak Bullish';
    else if (currentTrend === 'Bearish' && bosCount >= 2) confirmedTrend = 'Strong Bearish';
    else if (currentTrend === 'Bearish' && bosCount < 2) confirmedTrend = 'Weak Bearish';

    setTrendBias(confirmedTrend);
    setBiasProb(currentTrend !== 'Neutral' ? Math.min(50 + (bosCount * 10), 90) : 50);

    const ctx = priceChartRef.current.getContext('2d');
    if (priceChartInst.current) priceChartInst.current.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    priceChartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${selectedSymbol} 15m Price`,
            data: dataPoints,
            borderColor: '#10b981',
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 1,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.2
          },
          {
            label: 'Bullish BOS',
            data: bullishBOS,
            backgroundColor: '#3b82f6',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bearish BOS',
            data: bearishBOS,
            backgroundColor: '#ef4444',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bullish CHoCH',
            data: bullishCHoCH,
            backgroundColor: '#10b981',
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 7,
            pointHoverRadius: 9,
            pointStyle: 'triangle',
            showLine: false
          },
          {
            label: 'Bearish CHoCH',
            data: bearishCHoCH,
            backgroundColor: '#ef4444',
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 7,
            pointHoverRadius: 9,
            pointStyle: 'triangle',
            rotation: 180,
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }
        },
        plugins: { legend: { display: true, labels: { color: '#e2e8f0' } } }
      }
    });

    return () => {
      if (priceChartInst.current) priceChartInst.current.destroy();
    };
  }, [alertsData, selectedSymbol]);

  if (error) {
    return (
      <div style={{ padding: '2rem', background: '#1c1e28', borderRadius: '12px', border: '1px solid #ef4444', color: '#ef4444' }}>
        <h3>Dashboard Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  const latestAlert = alertsData[0] || {};
  const latestPrice = latestAlert.price || latestAlert.bar_close || '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Price Analysis Dashboard</h2>
        <select 
          value={selectedSymbol} 
          onChange={(e) => setSelectedSymbol(e.target.value)}
          style={{ background: '#1c1e28', color: '#f1f0ee', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {uniqueSymbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', color: '#a4a3ab', marginBottom: '8px' }}>Total Alerts</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{alertsData.length}</div>
        </div>
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', color: '#a4a3ab', marginBottom: '8px' }}>Active Symbols</div>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>{uniqueSymbols.length}</div>
        </div>
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', color: '#a4a3ab', marginBottom: '8px' }}>Latest Alert Price</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#34D399' }}>{latestPrice !== '-' ? `$${latestPrice}` : '-'}</div>
          <div style={{ fontSize: '12px', color: '#a4a3ab', marginTop: '4px' }}>{latestAlert.symbol || 'Waiting...'}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#f1f0ee' }}>
            Price Action (15m) - {selectedSymbol} | Bias: {trendBias} {trendBias !== 'No 15m Data' ? `(${biasProb}% Prob)` : ''}
          </h3>
          <div style={{ position: 'relative', height: '300px' }}>
            <canvas ref={priceChartRef}></canvas>
          </div>
        </div>

        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#f1f0ee' }}>Alerts Volume by Symbol</h3>
          <div style={{ position: 'relative', height: '300px' }}>
            <canvas ref={volumeChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#f1f0ee' }}>Recent Signals</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a4a3ab' }}>Time</th>
              <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a4a3ab' }}>Symbol</th>
              <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a4a3ab' }}>Interval</th>
              <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a4a3ab' }}>Price</th>
              <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a4a3ab' }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {alertsData.slice(0, 10).map((alert, i) => (
              <tr key={i}>
                <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{new Date(alert.received_at).toLocaleString()}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '600' }}>{alert.symbol || '-'}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{alert.interval || '-'}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{alert.price || alert.bar_close ? `$${alert.price || alert.bar_close}` : '-'}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={alert.message}>{alert.message || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
