import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const DEFAULT_SYMBOL = 'XAUUSD';
const CORRELATION_SYMBOLS = ['DXY', 'XAGUSD'];

// ── Market Structure Analysis (reusable) ──────────────────────────────────────
function analyzeMarketStructure(symData) {
  const getHigh = d => d.bar_high ?? d.high ?? d.price ?? d.bar_close;
  const getLow = d => d.bar_low ?? d.low ?? d.price ?? d.bar_close;
  const getClose = d => d.bar_close ?? d.price;

  let currentTrend = 'Neutral';
  let bosCount = 0;
  let lastHH = null, lastHL = null, lastLH = null, lastLL = null;

  const bullishBOS = new Array(symData.length).fill(null);
  const bearishBOS = new Array(symData.length).fill(null);
  const bullishCHoCH = new Array(symData.length).fill(null);
  const bearishCHoCH = new Array(symData.length).fill(null);

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
          lastLH = h2;
        }
      }
      if (isSwingLow) {
        if (currentTrend === 'Bullish' || currentTrend === 'Neutral') {
          lastHL = l2;
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
      if (lastHH !== null && close > lastHH) {
        lastHH = high;
        bosCount++;
        bullishBOS[i] = close;
      } else if (lastHL !== null && close < lastHL) {
        currentTrend = 'Bearish';
        bosCount = 0;
        lastLH = high;
        lastLL = low;
        bearishCHoCH[i] = close;
      }
    } else if (currentTrend === 'Bearish') {
      if (lastLL !== null && close < lastLL) {
        lastLL = low;
        bosCount++;
        bearishBOS[i] = close;
      } else if (lastLH !== null && close > lastLH) {
        currentTrend = 'Bullish';
        bosCount = 0;
        lastHH = high;
        lastHL = low;
        bullishCHoCH[i] = close;
      }
    } else if (currentTrend === 'Neutral') {
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

  let confirmedTrend = 'Neutral';
  if (currentTrend === 'Bullish' && bosCount >= 2) confirmedTrend = 'Strong Bullish';
  else if (currentTrend === 'Bullish' && bosCount < 2) confirmedTrend = 'Weak Bullish';
  else if (currentTrend === 'Bearish' && bosCount >= 2) confirmedTrend = 'Strong Bearish';
  else if (currentTrend === 'Bearish' && bosCount < 2) confirmedTrend = 'Weak Bearish';

  const probability = currentTrend !== 'Neutral' ? Math.min(50 + (bosCount * 10), 90) : 50;

  return {
    trend: currentTrend,
    confirmedTrend,
    bosCount,
    probability,
    bullishBOS,
    bearishBOS,
    bullishCHoCH,
    bearishCHoCH,
  };
}

// ── Helper: filter & sort 15m data for a symbol ──────────────────────────────
function get15mData(alertsData, symbol) {
  return alertsData
    .filter(d => d.symbol === symbol && (d.interval === '15' || d.interval === '15m') && (d.price !== null || d.bar_close !== null))
    .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
}

// ── Correlation helpers ──────────────────────────────────────────────────────
function getCorrelationStatus(primaryTrend, corrTrend, expectedRelation) {
  // expectedRelation: 'inverse' for DXY (gold is inversely correlated to dollar)
  //                   'positive' for XAGUSD (silver tends to correlate with gold)
  if (corrTrend === 'Neutral' || corrTrend === 'No Data') return { status: 'Neutral', label: 'No Signal', color: '#a4a3ab' };

  const primaryBullish = primaryTrend.includes('Bullish');
  const primaryBearish = primaryTrend.includes('Bearish');
  const corrBullish = corrTrend.includes('Bullish');
  const corrBearish = corrTrend.includes('Bearish');

  if (primaryTrend === 'Neutral') return { status: 'Neutral', label: 'Primary Neutral', color: '#a4a3ab' };

  if (expectedRelation === 'inverse') {
    // Gold bullish + DXY bearish = Confirming | Gold bullish + DXY bullish = Diverging
    if ((primaryBullish && corrBearish) || (primaryBearish && corrBullish)) {
      return { status: 'Confirming', label: '✓ Confirming', color: '#34D399' };
    } else {
      return { status: 'Diverging', label: '⚠ Diverging', color: '#F59E0B' };
    }
  } else {
    // Gold bullish + Silver bullish = Confirming
    if ((primaryBullish && corrBullish) || (primaryBearish && corrBearish)) {
      return { status: 'Confirming', label: '✓ Confirming', color: '#34D399' };
    } else {
      return { status: 'Diverging', label: '⚠ Diverging', color: '#F59E0B' };
    }
  }
}

// ── Correlation Card Component ───────────────────────────────────────────────
function CorrelationCard({ symbol, trend, probability, correlation, expectedRelation }) {
  const isBullish = trend.includes('Bullish');
  const isBearish = trend.includes('Bearish');
  const trendColor = isBullish ? '#34D399' : isBearish ? '#F87171' : '#a4a3ab';
  const borderColor = correlation.status === 'Confirming' ? 'rgba(52, 211, 153, 0.3)' : correlation.status === 'Diverging' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.08)';
  const relationLabel = expectedRelation === 'inverse' ? 'Inverse' : 'Positive';

  return (
    <div style={{
      background: '#1c1e28',
      padding: '20px',
      borderRadius: '16px',
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: correlation.status === 'Confirming'
          ? 'linear-gradient(90deg, transparent, #34D399, transparent)'
          : correlation.status === 'Diverging'
          ? 'linear-gradient(90deg, transparent, #F59E0B, transparent)'
          : 'transparent',
        opacity: 0.6,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#f1f0ee',
          }}>{symbol}</span>
          <span style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.06)',
            color: '#a4a3ab',
            fontWeight: '500',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>{relationLabel} Corr.</span>
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: correlation.color,
          padding: '4px 10px',
          borderRadius: '8px',
          background: correlation.status === 'Confirming' ? 'rgba(52, 211, 153, 0.1)' : correlation.status === 'Diverging' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        }}>
          {correlation.label}
        </span>
      </div>

      {/* Trend info */}
      <div>
        <div style={{ fontSize: '12px', color: '#a4a3ab', marginBottom: '4px' }}>Market Structure (15m)</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: trendColor }}>{trend}</div>
      </div>

      {/* Probability bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a4a3ab', marginBottom: '4px' }}>
          <span>Trend Strength</span>
          <span>{probability}%</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${probability}%`,
            borderRadius: '2px',
            background: isBullish
              ? 'linear-gradient(90deg, #059669, #34D399)'
              : isBearish
              ? 'linear-gradient(90deg, #DC2626, #F87171)'
              : 'linear-gradient(90deg, #475569, #94a3b8)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main Dashboard Component
// ══════════════════════════════════════════════════════════════════════════════
export default function PriceAnalysisDashboard() {
  const [alertsData, setAlertsData] = useState([]);
  const [uniqueSymbols, setUniqueSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [error, setError] = useState('');
  const [trendBias, setTrendBias] = useState('Neutral');
  const [biasProb, setBiasProb] = useState(50);
  
  const priceChartRef = useRef(null);
  const volumeChartRef = useRef(null);
  const correlationChartRef = useRef(null);
  const priceChartInst = useRef(null);
  const volumeChartInst = useRef(null);
  const correlationChartInst = useRef(null);

  // ── Correlation analysis (memoized) ─────────────────────────────────────
  const correlationResults = useMemo(() => {
    if (alertsData.length === 0) return {};

    const results = {};
    for (const sym of CORRELATION_SYMBOLS) {
      const symData = get15mData(alertsData, sym);
      if (symData.length === 0) {
        results[sym] = { confirmedTrend: 'No Data', probability: 50, dataPoints: [], labels: [] };
      } else {
        const analysis = analyzeMarketStructure(symData);
        const labels = symData.map(d => {
          const date = new Date(d.bar_time || d.received_at);
          return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        });
        const dataPoints = symData.map(d => d.price || d.bar_close);
        results[sym] = { ...analysis, dataPoints, labels };
      }
    }
    return results;
  }, [alertsData]);

  // ── Data Fetch ──────────────────────────────────────────────────────────
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
        // Default to XAUUSD if available, otherwise first symbol
        if (syms.includes(DEFAULT_SYMBOL)) {
          setSelectedSymbol(DEFAULT_SYMBOL);
        } else if (syms.length > 0) {
          setSelectedSymbol(syms[0]);
        }
      }
    }
    fetchData();
  }, []);

  // ── Render Volume Chart ────────────────────────────────────────────────
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

  // ── Render Price Chart ─────────────────────────────────────────────────
  useEffect(() => {
    if (alertsData.length === 0 || !priceChartRef.current || !selectedSymbol) return;

    const symData = get15mData(alertsData, selectedSymbol);

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
    const analysis = analyzeMarketStructure(symData);

    setTrendBias(analysis.confirmedTrend);
    setBiasProb(analysis.probability);

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
            data: analysis.bullishBOS,
            backgroundColor: '#3b82f6',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bearish BOS',
            data: analysis.bearishBOS,
            backgroundColor: '#ef4444',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bullish CHoCH',
            data: analysis.bullishCHoCH,
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
            data: analysis.bearishCHoCH,
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

  // ── Render Correlation Chart ───────────────────────────────────────────
  useEffect(() => {
    if (alertsData.length === 0 || !correlationChartRef.current) return;

    const ctx = correlationChartRef.current.getContext('2d');
    if (correlationChartInst.current) correlationChartInst.current.destroy();

    // Build normalized datasets: normalize each series to % change from first point
    const datasets = [];
    const colorMap = {
      [selectedSymbol]: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
      'DXY': { border: '#818CF8', bg: 'rgba(129, 140, 248, 0.15)' },
      'XAGUSD': { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
    };

    // Primary symbol data
    const primaryData = get15mData(alertsData, selectedSymbol);
    let maxLabels = [];

    if (primaryData.length > 0) {
      const prices = primaryData.map(d => d.price || d.bar_close);
      const basePrice = prices[0];
      const normalized = prices.map(p => ((p - basePrice) / basePrice * 100).toFixed(3));
      const labels = primaryData.map(d => {
        const date = new Date(d.bar_time || d.received_at);
        return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      });
      if (labels.length > maxLabels.length) maxLabels = labels;

      datasets.push({
        label: selectedSymbol,
        data: normalized,
        borderColor: colorMap[selectedSymbol]?.border || '#10b981',
        backgroundColor: colorMap[selectedSymbol]?.bg || 'rgba(16,185,129,0.15)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: false,
      });
    }

    // Correlation symbols
    for (const sym of CORRELATION_SYMBOLS) {
      const corrResult = correlationResults[sym];
      if (!corrResult || corrResult.confirmedTrend === 'No Data' || corrResult.dataPoints.length === 0) continue;

      const prices = corrResult.dataPoints;
      const basePrice = prices[0];
      const normalized = prices.map(p => ((p - basePrice) / basePrice * 100).toFixed(3));
      if (corrResult.labels.length > maxLabels.length) maxLabels = corrResult.labels;

      datasets.push({
        label: sym,
        data: normalized,
        borderColor: colorMap[sym]?.border || '#94a3b8',
        backgroundColor: colorMap[sym]?.bg || 'rgba(148,163,184,0.15)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: false,
        borderDash: sym === 'DXY' ? [6, 3] : [],
      });
    }

    correlationChartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: maxLabels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: '% Change', color: '#a4a3ab', font: { size: 11 } },
          },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }
        },
        plugins: {
          legend: { display: true, labels: { color: '#e2e8f0', usePointStyle: true, pointStyle: 'line' } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y}%`
            }
          }
        }
      }
    });

    return () => {
      if (correlationChartInst.current) correlationChartInst.current.destroy();
    };
  }, [alertsData, selectedSymbol, correlationResults]);

  // ── Compute correlation statuses ────────────────────────────────────────
  const dxyCorrelation = useMemo(() => {
    const dxyResult = correlationResults['DXY'];
    if (!dxyResult) return { status: 'Neutral', label: 'No Signal', color: '#a4a3ab' };
    return getCorrelationStatus(trendBias, dxyResult.confirmedTrend, 'inverse');
  }, [trendBias, correlationResults]);

  const xagCorrelation = useMemo(() => {
    const xagResult = correlationResults['XAGUSD'];
    if (!xagResult) return { status: 'Neutral', label: 'No Signal', color: '#a4a3ab' };
    return getCorrelationStatus(trendBias, xagResult.confirmedTrend, 'positive');
  }, [trendBias, correlationResults]);

  // Overall confluence score
  const confluenceScore = useMemo(() => {
    let score = 0;
    let total = 0;
    if (dxyCorrelation.status === 'Confirming') { score++; total++; }
    else if (dxyCorrelation.status === 'Diverging') { total++; }
    if (xagCorrelation.status === 'Confirming') { score++; total++; }
    else if (xagCorrelation.status === 'Diverging') { total++; }
    if (total === 0) return { label: 'No Data', pct: 0, color: '#a4a3ab' };
    const pct = Math.round((score / total) * 100);
    return {
      label: pct >= 75 ? 'Strong Confluence' : pct >= 50 ? 'Moderate Confluence' : 'Weak Confluence',
      pct,
      color: pct >= 75 ? '#34D399' : pct >= 50 ? '#F59E0B' : '#F87171',
    };
  }, [dxyCorrelation, xagCorrelation]);

  // ── Error state ─────────────────────────────────────────────────────────
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
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: `1px solid ${trendBias.includes('Bullish') ? 'rgba(16, 185, 129, 0.4)' : trendBias.includes('Bearish') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)'}` }}>
          <div style={{ fontSize: '13px', color: '#a4a3ab', marginBottom: '8px' }}>Market Structure (15m)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: trendBias.includes('Bullish') ? '#34D399' : trendBias.includes('Bearish') ? '#F87171' : '#f1f0ee' }}>
            {trendBias}
          </div>
          <div style={{ fontSize: '12px', color: '#a4a3ab', marginTop: '4px' }}>
            {trendBias !== 'No 15m Data' && trendBias !== 'Neutral' ? `Probability: ${biasProb}%` : 'Awaiting data...'}
          </div>
        </div>
        {/* Confluence KPI */}
        <div style={{
          background: '#1c1e28',
          padding: '20px',
          borderRadius: '16px',
          border: `1px solid ${confluenceScore.pct >= 75 ? 'rgba(52, 211, 153, 0.3)' : confluenceScore.pct >= 50 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          <div style={{ fontSize: '13px', color: '#a4a3ab', marginBottom: '8px' }}>Trend Confluence</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: confluenceScore.color }}>{confluenceScore.pct}%</div>
          <div style={{ fontSize: '12px', color: '#a4a3ab', marginTop: '4px' }}>{confluenceScore.label}</div>
        </div>
      </div>

      {/* Charts Row 1: Price Action + Volume */}
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

      {/* ── Trend Correlation Section ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(28, 30, 40, 0.95), rgba(20, 22, 32, 0.95))',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f1f0ee', margin: 0 }}>
              Trend Correlation Analysis
            </h3>
            <p style={{ fontSize: '12px', color: '#a4a3ab', margin: '4px 0 0' }}>
              {selectedSymbol} vs DXY (inverse) & XAGUSD (positive) — 15m Market Structure
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '12px',
            background: `${confluenceScore.color}15`,
            border: `1px solid ${confluenceScore.color}30`,
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: confluenceScore.color,
              boxShadow: `0 0 6px ${confluenceScore.color}`,
            }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: confluenceScore.color }}>
              {confluenceScore.label}
            </span>
          </div>
        </div>

        {/* Correlation Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <CorrelationCard
            symbol="DXY"
            trend={correlationResults['DXY']?.confirmedTrend || 'No Data'}
            probability={correlationResults['DXY']?.probability || 50}
            correlation={dxyCorrelation}
            expectedRelation="inverse"
          />
          <CorrelationCard
            symbol="XAGUSD"
            trend={correlationResults['XAGUSD']?.confirmedTrend || 'No Data'}
            probability={correlationResults['XAGUSD']?.probability || 50}
            correlation={xagCorrelation}
            expectedRelation="positive"
          />
        </div>

        {/* Normalized Overlay Chart */}
        <div style={{
          background: '#141620',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#a4a3ab', fontWeight: '500' }}>
            Normalized Price Overlay (% Change from Period Start)
          </h4>
          <div style={{ position: 'relative', height: '280px' }}>
            <canvas ref={correlationChartRef}></canvas>
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
