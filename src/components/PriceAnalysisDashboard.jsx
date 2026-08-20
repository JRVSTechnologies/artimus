import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Chart, registerables } from 'chart.js';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  Layers, 
  Zap, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  Compass, 
  RefreshCw, 
  BarChart2, 
  Eye,
  Sliders,
  Calendar,
  Filter
} from 'lucide-react';

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

// Timespan Window Options
export const TIMESPAN_OPTIONS = [
  { id: '1h', label: '1H', description: 'Last 1 Hour', durationMs: 1 * 60 * 60 * 1000 },
  { id: '4h', label: '4H', description: 'Last 4 Hours', durationMs: 4 * 60 * 60 * 1000 },
  { id: '12h', label: '12H', description: 'Last 12 Hours', durationMs: 12 * 60 * 60 * 1000 },
  { id: '24h', label: '24H', description: 'Last 24 Hours', durationMs: 24 * 60 * 60 * 1000 },
  { id: '3d', label: '3D', description: 'Last 3 Days', durationMs: 3 * 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7D', description: 'Last 7 Days', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30D', description: 'Last 30 Days', durationMs: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', description: 'All History', durationMs: null }
];

// ── Market Structure Analysis Engine ──────────────────────────────────────────
function analyzeMarketStructure(symData) {
  if (!symData || symData.length === 0) {
    return {
      trend: 'Neutral',
      confirmedTrend: 'No Data',
      bosCount: 0,
      probability: 50,
      bullishBOS: [],
      bearishBOS: [],
      bullishCHoCH: [],
      bearishCHoCH: [],
      swingHighs: [],
      swingLows: []
    };
  }

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
  const swingHighs = [];
  const swingLows = [];

  for (let i = 0; i < symData.length; i++) {
    // 1. Fractal Detection (Delayed by 2 candles)
    if (i >= 4) {
      const i2 = i - 2;
      const h0 = getHigh(symData[i - 4]), h1 = getHigh(symData[i - 3]), h2 = getHigh(symData[i2]), h3 = getHigh(symData[i - 1]), h4 = getHigh(symData[i]);
      const l0 = getLow(symData[i - 4]), l1 = getLow(symData[i - 3]), l2 = getLow(symData[i2]), l3 = getLow(symData[i - 1]), l4 = getLow(symData[i]);

      const isSwingHigh = (h2 > h0 && h2 > h1 && h2 > h3 && h2 > h4);
      const isSwingLow  = (l2 < l0 && l2 < l1 && l2 < l3 && l2 < l4);

      if (isSwingHigh) {
        swingHighs.push({ index: i2, price: h2, time: symData[i2].bar_time || symData[i2].received_at });
        if (currentTrend === 'Bullish' || currentTrend === 'Neutral') {
          lastHH = lastHH === null ? h2 : Math.max(lastHH, h2);
        }
        if (currentTrend === 'Bearish' || currentTrend === 'Neutral') {
          lastLH = h2;
        }
      }
      if (isSwingLow) {
        swingLows.push({ index: i2, price: l2, time: symData[i2].bar_time || symData[i2].received_at });
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

  const probability = currentTrend !== 'Neutral' ? Math.min(50 + (bosCount * 10), 92) : 50;

  return {
    trend: currentTrend,
    confirmedTrend,
    bosCount,
    probability,
    bullishBOS,
    bearishBOS,
    bullishCHoCH,
    bearishCHoCH,
    swingHighs,
    swingLows
  };
}

// ── Multi-Timeframe / Multi-Period Engine ──────────────────────────────────────
function analyzeMultiTimeframe(alertsData, symbol) {
  const intervals = [
    { label: '5m', filter: d => d.interval === '5' || d.interval === '5m', sampleStep: 1 },
    { label: '15m', filter: d => d.interval === '15' || d.interval === '15m', sampleStep: 1 },
    { label: '1h', filter: d => d.interval === '60' || d.interval === '1h', sampleStep: 4 },
    { label: '4h', filter: d => d.interval === '240' || d.interval === '4h', sampleStep: 16 }
  ];

  const mtfResults = [];
  const base15Data = getSymbolData(alertsData, symbol);

  intervals.forEach(tf => {
    let tfData = alertsData.filter(d => matchSymbol(d.symbol, symbol) && tf.filter(d))
      .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));

    // If specific timeframe not found in alerts, aggregate from base dataset
    if (tfData.length < 5 && base15Data.length >= 10) {
      tfData = [];
      for (let i = 0; i < base15Data.length; i += tf.sampleStep) {
        tfData.push(base15Data[i]);
      }
    }

    if (tfData.length >= 3) {
      const analysis = analyzeMarketStructure(tfData);
      mtfResults.push({
        timeframe: tf.label,
        trend: analysis.confirmedTrend,
        bias: analysis.trend,
        probability: analysis.probability,
        bosCount: analysis.bosCount,
        dataPointsCount: tfData.length
      });
    } else {
      mtfResults.push({
        timeframe: tf.label,
        trend: 'Awaiting Feed',
        bias: 'Neutral',
        probability: 50,
        bosCount: 0,
        dataPointsCount: 0
      });
    }
  });

  return mtfResults;
}

// ── SMT Divergence Engine (Smart Money Technique) ─────────────────────────────
function detectSMTDivergence(primaryData, dxyData, xagData) {
  if (!primaryData || primaryData.length < 6) {
    return {
      hasDivergence: false,
      type: 'None',
      asset: null,
      confidence: 0,
      description: 'Insufficient history for SMT evaluation',
      badgeColor: '#a4a3ab'
    };
  }

  const pClose = primaryData.map(d => d.price || d.bar_close);
  const pLen = pClose.length;
  const pRecent = pClose.slice(-6);
  const pChange = (pRecent[pRecent.length - 1] - pRecent[0]) / pRecent[0];

  let smtSignal = null;

  // 1. Primary vs DXY (Inverse Correlation)
  if (dxyData && dxyData.length >= 6) {
    const dxyClose = dxyData.map(d => d.price || d.bar_close);
    const dxyRecent = dxyClose.slice(-6);
    const dxyChange = (dxyRecent[dxyRecent.length - 1] - dxyRecent[0]) / dxyRecent[0];

    // In normal conditions: Gold Up -> DXY Down. SMT occurs when they both move same direction or fail to confirm swings.
    if (pChange > 0.0015 && dxyChange > 0.001) {
      smtSignal = {
        hasDivergence: true,
        type: 'Bearish SMT Divergence',
        asset: 'DXY',
        confidence: 85,
        description: 'Gold push higher not confirmed by DXY (Dollar also rallying). Institutional warning for trap.',
        badgeColor: '#F87171'
      };
    } else if (pChange < -0.0015 && dxyChange < -0.001) {
      smtSignal = {
        hasDivergence: true,
        type: 'Bullish SMT Divergence',
        asset: 'DXY',
        confidence: 85,
        description: 'Gold drop not confirmed by DXY (Dollar also weakening). Institutional accumulation setup.',
        badgeColor: '#34D399'
      };
    }
  }

  // 2. Primary vs XAGUSD (Positive Correlation - Precious Metals SMT)
  if (!smtSignal && xagData && xagData.length >= 6) {
    const xagClose = xagData.map(d => d.price || d.bar_close);
    const xagRecent = xagClose.slice(-6);
    const xagChange = (xagRecent[xagRecent.length - 1] - xagRecent[0]) / xagRecent[0];

    // Normal: Both move together. SMT: Gold Higher High but Silver Lower High (or vice versa).
    if (pChange > 0.002 && xagChange < -0.001) {
      smtSignal = {
        hasDivergence: true,
        type: 'Bearish SMT Divergence',
        asset: 'XAGUSD',
        confidence: 80,
        description: 'Gold printing Higher High while Silver lagging / Lower High. Smart Money distribution.',
        badgeColor: '#F87171'
      };
    } else if (pChange < -0.002 && xagChange > 0.001) {
      smtSignal = {
        hasDivergence: true,
        type: 'Bullish SMT Divergence',
        asset: 'XAGUSD',
        confidence: 80,
        description: 'Gold printing Lower Low while Silver holding Higher Low. Smart Money absorption.',
        badgeColor: '#34D399'
      };
    }
  }

  return smtSignal || {
    hasDivergence: false,
    type: 'In Sync (No Divergence)',
    asset: 'Correlated Assets',
    confidence: 65,
    description: 'Gold, DXY, and Silver are moving in structural alignment.',
    badgeColor: '#60A5FA'
  };
}

// ── Session & Killzone Calculator ─────────────────────────────────────────────
function calculateSessionInfo(symData) {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const timeDecimal = utcHours + utcMinutes / 60;

  let activeSession = 'Asian Session';
  let isKillzone = false;
  let sessionBadgeColor = '#818CF8';

  if (timeDecimal >= 0 && timeDecimal < 7) {
    activeSession = 'Asian Range (Tokyo/Sydney)';
    sessionBadgeColor = '#818CF8';
  } else if (timeDecimal >= 7 && timeDecimal < 10) {
    activeSession = 'London Open Killzone (Judas Swing)';
    isKillzone = true;
    sessionBadgeColor = '#F59E0B';
  } else if (timeDecimal >= 10 && timeDecimal < 12) {
    activeSession = 'London Session (Expansion)';
    sessionBadgeColor = '#3B82F6';
  } else if (timeDecimal >= 12 && timeDecimal < 16) {
    activeSession = 'London / NY Overlap (Peak Volume)';
    isKillzone = true;
    sessionBadgeColor = '#34D399';
  } else if (timeDecimal >= 16 && timeDecimal < 21) {
    activeSession = 'New York PM Session';
    sessionBadgeColor = '#C084FC';
  } else {
    activeSession = 'Market Transition / Asian Setup';
    sessionBadgeColor = '#64748B';
  }

  // Calculate session High / Low if data available
  if (!symData || symData.length === 0) {
    return { activeSession, isKillzone, sessionBadgeColor, sessionHigh: '-', sessionLow: '-' };
  }

  const prices = symData.map(d => d.bar_high || d.high || d.price || d.bar_close);
  const lows = symData.map(d => d.bar_low || d.low || d.price || d.bar_close);

  const sessionHigh = Math.max(...prices).toFixed(2);
  const sessionLow = Math.min(...lows).toFixed(2);

  return {
    activeSession,
    isKillzone,
    sessionBadgeColor,
    sessionHigh,
    sessionLow
  };
}

// ── Helper: Robust symbol matcher ─────────────────────────────────────────────
function matchSymbol(rawSymbol, targetSymbol) {
  if (!rawSymbol || !targetSymbol) return false;
  if (rawSymbol === targetSymbol) return true;
  const rawClean = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const targetClean = targetSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return rawClean === targetClean || rawClean.endsWith(targetClean) || rawClean.includes(targetClean) || targetClean.includes(rawClean);
}

function getSymbolData(alertsData, symbol) {
  if (!symbol) return [];
  return alertsData
    .filter(d => matchSymbol(d.symbol, symbol) && (d.price !== null || d.bar_close !== null))
    .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
}

// ── Correlation helpers ──────────────────────────────────────────────────────
function getCorrelationStatus(primaryTrend, corrTrend, expectedRelation) {
  if (corrTrend === 'Neutral' || corrTrend === 'No Data' || corrTrend === 'Awaiting Feed') {
    return { status: 'Neutral', label: 'No Signal', color: '#a4a3ab' };
  }

  const primaryBullish = primaryTrend.includes('Bullish');
  const primaryBearish = primaryTrend.includes('Bearish');
  const corrBullish = corrTrend.includes('Bullish');
  const corrBearish = corrTrend.includes('Bearish');

  if (primaryTrend === 'Neutral') return { status: 'Neutral', label: 'Primary Neutral', color: '#a4a3ab' };

  if (expectedRelation === 'inverse') {
    if ((primaryBullish && corrBearish) || (primaryBearish && corrBullish)) {
      return { status: 'Confirming', label: '✓ Confirming (Inverse)', color: '#34D399' };
    } else {
      return { status: 'Diverging', label: '⚠ Diverging (SMT Alert)', color: '#F59E0B' };
    }
  } else {
    if ((primaryBullish && corrBullish) || (primaryBearish && corrBearish)) {
      return { status: 'Confirming', label: '✓ Confirming (Positive)', color: '#34D399' };
    } else {
      return { status: 'Diverging', label: '⚠ Diverging (SMT Alert)', color: '#F59E0B' };
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main Dashboard Component (Option 1: SMT Divergence & Studio)
// ══════════════════════════════════════════════════════════════════════════════
export default function PriceAnalysisDashboard() {
  const [alertsData, setAlertsData] = useState([]);
  const [uniqueSymbols, setUniqueSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [selectedTimespan, setSelectedTimespan] = useState('24h');
  const [queryLimit, setQueryLimit] = useState(1000);
  const [activeTab, setActiveTab] = useState('smt-studio'); // 'smt-studio', 'mtf-matrix', 'recent-signals'
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const priceChartRef = useRef(null);
  const smtChartRef = useRef(null);
  const volumeChartRef = useRef(null);

  const priceChartInst = useRef(null);
  const smtChartInst = useRef(null);
  const volumeChartInst = useRef(null);

  // ── Data Fetch ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Missing Supabase Environment Variables. Check .env');
      return;
    }
    
    setIsRefreshing(true);
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error: fetchErr } = await client
      .from('tv_alerts')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(queryLimit);

    setIsRefreshing(false);

    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      setError(fetchErr.message);
      return;
    }

    if (data) {
      setAlertsData(data);
      const syms = [...new Set(data.map(d => d.symbol).filter(Boolean))];
      setUniqueSymbols(syms);
      
      // Default to XAUUSD if available, otherwise first symbol
      const defaultMatch = syms.find(s => {
        const clean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return s === DEFAULT_SYMBOL || clean === DEFAULT_SYMBOL || clean.includes(DEFAULT_SYMBOL) || s.toUpperCase().includes('GOLD');
      });
      if (defaultMatch) {
        setSelectedSymbol(defaultMatch);
      } else if (syms.length > 0) {
        setSelectedSymbol(syms[0]);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [queryLimit]);

  // ── Timespan Filtered Dataset ───────────────────────────────────────────
  const filteredAlertsData = useMemo(() => {
    if (selectedTimespan === 'all' || alertsData.length === 0) return alertsData;
    const option = TIMESPAN_OPTIONS.find(o => o.id === selectedTimespan);
    if (!option || !option.durationMs) return alertsData;

    const timestamps = alertsData
      .map(d => new Date(d.bar_time || d.received_at).getTime())
      .filter(t => !isNaN(t));

    if (timestamps.length === 0) return alertsData;
    const maxTime = Math.max(...timestamps);
    const cutoffTime = maxTime - option.durationMs;

    return alertsData.filter(d => {
      const t = new Date(d.bar_time || d.received_at).getTime();
      return !isNaN(t) && t >= cutoffTime;
    });
  }, [alertsData, selectedTimespan]);

  // ── Prepared Datasets & Analysis ────────────────────────────────────────
  const primaryData = useMemo(() => getSymbolData(filteredAlertsData, selectedSymbol), [filteredAlertsData, selectedSymbol]);
  const dxyData = useMemo(() => getSymbolData(filteredAlertsData, 'DXY'), [filteredAlertsData]);
  const xagData = useMemo(() => getSymbolData(filteredAlertsData, 'XAGUSD'), [filteredAlertsData]);

  // Primary Structure Analysis
  const primaryStructure = useMemo(() => analyzeMarketStructure(primaryData), [primaryData]);
  
  // SMT Divergence Detection
  const smtDivergence = useMemo(() => detectSMTDivergence(primaryData, dxyData, xagData), [primaryData, dxyData, xagData]);
  
  // Session & Killzone Status
  const sessionInfo = useMemo(() => calculateSessionInfo(primaryData), [primaryData]);

  // Multi-Timeframe Matrix
  const mtfMatrix = useMemo(() => analyzeMultiTimeframe(filteredAlertsData, selectedSymbol), [filteredAlertsData, selectedSymbol]);

  // DXY & XAG correlation status
  const dxyStructure = useMemo(() => analyzeMarketStructure(dxyData), [dxyData]);
  const xagStructure = useMemo(() => analyzeMarketStructure(xagData), [xagData]);
  const dxyCorrelation = useMemo(() => getCorrelationStatus(primaryStructure.confirmedTrend, dxyStructure.confirmedTrend, 'inverse'), [primaryStructure, dxyStructure]);
  const xagCorrelation = useMemo(() => getCorrelationStatus(primaryStructure.confirmedTrend, xagStructure.confirmedTrend, 'positive'), [primaryStructure, xagStructure]);

  // Composite Confluence Score
  const confluenceScore = useMemo(() => {
    let score = 0;
    let factors = 0;

    if (primaryStructure.trend !== 'Neutral') { score += primaryStructure.bosCount >= 2 ? 35 : 20; factors += 35; }
    if (dxyCorrelation.status === 'Confirming') { score += 35; factors += 35; } else if (dxyCorrelation.status === 'Diverging') { factors += 35; }
    if (xagCorrelation.status === 'Confirming') { score += 30; factors += 30; } else if (xagCorrelation.status === 'Diverging') { factors += 30; }

    if (factors === 0) return { label: 'Neutral Setup', pct: 50, color: '#94a3b8' };
    const pct = Math.round((score / factors) * 100);
    return {
      label: pct >= 75 ? 'Institutional Confluence' : pct >= 50 ? 'Moderate Confluence' : 'Caution / Diverging',
      pct,
      color: pct >= 75 ? '#34D399' : pct >= 50 ? '#F59E0B' : '#F87171'
    };
  }, [primaryStructure, dxyCorrelation, xagCorrelation]);

  // ── Render Main Price Structure Chart ────────────────────────────────────
  useEffect(() => {
    if (!priceChartRef.current) return;
    if (primaryData.length === 0) {
      if (priceChartInst.current) {
        priceChartInst.current.destroy();
        priceChartInst.current = null;
      }
      return;
    }

    const labels = primaryData.map(d => {
      const date = new Date(d.bar_time || d.received_at);
      return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    const prices = primaryData.map(d => d.price || d.bar_close);
    const highs = primaryData.map(d => d.bar_high || d.high || d.price || d.bar_close);
    const lows = primaryData.map(d => d.bar_low || d.low || d.price || d.bar_close);

    const ctx = priceChartRef.current.getContext('2d');
    if (priceChartInst.current) priceChartInst.current.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(52, 211, 153, 0.35)');
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    priceChartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${selectedSymbol} High Corridor`,
            data: highs,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            tension: 0.2
          },
          {
            label: `${selectedSymbol} Price`,
            data: prices,
            borderColor: '#34D399',
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointRadius: 1,
            pointHoverRadius: 6,
            fill: '-1',
            tension: 0.2
          },
          {
            label: `${selectedSymbol} Low Corridor`,
            data: lows,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            tension: 0.2
          },
          {
            label: 'Bullish BOS (Break of Structure)',
            data: primaryStructure.bullishBOS,
            backgroundColor: '#3B82F6',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bearish BOS (Break of Structure)',
            data: primaryStructure.bearishBOS,
            backgroundColor: '#EF4444',
            borderColor: '#ffffff',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
          },
          {
            label: 'Bullish CHoCH (Change of Char)',
            data: primaryStructure.bullishCHoCH,
            backgroundColor: '#10B981',
            borderColor: '#FDE047',
            borderWidth: 2,
            pointRadius: 7,
            pointStyle: 'triangle',
            showLine: false
          },
          {
            label: 'Bearish CHoCH (Change of Char)',
            data: primaryStructure.bearishCHoCH,
            backgroundColor: '#DC2626',
            borderColor: '#FDE047',
            borderWidth: 2,
            pointRadius: 7,
            pointStyle: 'triangle',
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              filter: item => !item.text.includes('Corridor'),
              color: '#94a3b8',
              usePointStyle: true,
              boxWidth: 8
            }
          }
        }
      }
    });

    return () => {
      if (priceChartInst.current) priceChartInst.current.destroy();
    };
  }, [primaryData, primaryStructure, selectedSymbol]);

  // ── Render SMT Divergence Synchronized Overlay Chart ────────────────────
  useEffect(() => {
    if (!smtChartRef.current) return;
    if (primaryData.length === 0) {
      if (smtChartInst.current) {
        smtChartInst.current.destroy();
        smtChartInst.current = null;
      }
      return;
    }

    const ctx = smtChartRef.current.getContext('2d');
    if (smtChartInst.current) smtChartInst.current.destroy();

    // Normalize prices (% change from start)
    const normalize = (data) => {
      if (!data || data.length === 0) return [];
      const base = data[0].price || data[0].bar_close;
      return data.map(d => Number((((d.price || d.bar_close) - base) / base * 100).toFixed(3)));
    };

    const primaryNorm = normalize(primaryData);
    const dxyNormInverted = normalize(dxyData).map(v => -v); // Invert DXY so normal correlation moves parallel with Gold
    const xagNorm = normalize(xagData);

    const labels = primaryData.map(d => {
      const date = new Date(d.bar_time || d.received_at);
      return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    const datasets = [
      {
        label: `${selectedSymbol} (% Move)`,
        data: primaryNorm,
        borderColor: '#34D399',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3
      }
    ];

    if (dxyNormInverted.length > 0) {
      datasets.push({
        label: 'DXY Inverted (% Move - Inverted Dollar)',
        data: dxyNormInverted,
        borderColor: '#818CF8',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.3
      });
    }

    if (xagNorm.length > 0) {
      datasets.push({
        label: 'XAGUSD (% Move - Silver Relative)',
        data: xagNorm,
        borderColor: '#F59E0B',
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.3
      });
    }

    smtChartInst.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: '% Normalized Deviation', color: '#94a3b8', font: { size: 11 } }
          },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }
        },
        plugins: {
          legend: { display: true, labels: { color: '#cbd5e1', usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y}%`
            }
          }
        }
      }
    });

    return () => {
      if (smtChartInst.current) smtChartInst.current.destroy();
    };
  }, [primaryData, dxyData, xagData, selectedSymbol]);

  // ── Render Volume & Frequency Chart ─────────────────────────────────────
  useEffect(() => {
    if (!volumeChartRef.current) return;
    if (filteredAlertsData.length === 0) {
      if (volumeChartInst.current) {
        volumeChartInst.current.destroy();
        volumeChartInst.current = null;
      }
      return;
    }

    const symbolCounts = filteredAlertsData.reduce((acc, curr) => {
      if (curr.symbol) acc[curr.symbol] = (acc[curr.symbol] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const ctx = volumeChartRef.current.getContext('2d');
    if (volumeChartInst.current) volumeChartInst.current.destroy();

    volumeChartInst.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          label: 'Alert Frequency',
          data: sorted.map(s => s[1]),
          backgroundColor: 'rgba(129, 140, 248, 0.45)',
          borderColor: '#818CF8',
          borderWidth: 1,
          borderRadius: 6
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
  }, [filteredAlertsData]);

  const latestAlert = primaryData[primaryData.length - 1] || filteredAlertsData[0] || alertsData[0] || {};
  const latestPrice = latestAlert.price || latestAlert.bar_close || '-';

  if (error) {
    return (
      <div style={{ padding: '24px', background: '#1c1e28', borderRadius: '16px', border: '1px solid #ef4444', color: '#ef4444', margin: '20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <AlertTriangle size={20} />
          <h3 style={{ margin: 0 }}>Dashboard Configuration Notice</h3>
        </div>
        <p style={{ margin: 0, color: '#e2e8f0' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
      
      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#1c1e28',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '10px',
            borderRadius: '12px',
            background: 'rgba(52, 211, 153, 0.15)',
            color: '#34D399'
          }}>
            <Compass size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                Institutional SMT & Market Structure Studio
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '8px',
                background: 'rgba(129, 140, 248, 0.15)',
                color: '#818CF8',
                border: '1px solid rgba(129, 140, 248, 0.3)'
              }}>
                SMT v2.0
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>
              Smart Money Swings • Inter-market Divergence • Active Window: <strong style={{ color: '#34D399' }}>{selectedTimespan.toUpperCase()}</strong> ({primaryData.length} bars)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Timespan Window Selector Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#12131a',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.12)',
            gap: '2px'
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 6px 0 8px',
              fontSize: '11px',
              fontWeight: '600',
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <Clock size={12} /> Span:
            </span>
            {TIMESPAN_OPTIONS.map(opt => {
              const isActive = selectedTimespan === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedTimespan(opt.id)}
                  title={opt.description}
                  style={{
                    background: isActive ? '#34D399' : 'transparent',
                    color: isActive ? '#0f172a' : '#94a3b8',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Symbol Select */}
          <div style={{ position: 'relative' }}>
            <select 
              value={selectedSymbol} 
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{
                background: '#12131a',
                color: '#f8fafc',
                padding: '7px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {uniqueSymbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#12131a',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '7px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── SMT Alert Banner (Conditional) ─────────────────────────────────── */}
      <div style={{
        background: smtDivergence.hasDivergence 
          ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.12), rgba(28, 30, 40, 0.9))' 
          : 'linear-gradient(90deg, rgba(52, 211, 153, 0.12), rgba(28, 30, 40, 0.9))',
        border: `1px solid ${smtDivergence.badgeColor}40`,
        padding: '14px 20px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '10px',
            background: `${smtDivergence.badgeColor}20`,
            color: smtDivergence.badgeColor
          }}>
            {smtDivergence.hasDivergence ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: smtDivergence.badgeColor }}>
                {smtDivergence.type}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Ref: {smtDivergence.asset}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
              {smtDivergence.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Confidence Level</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: smtDivergence.badgeColor }}>
              {smtDivergence.confidence}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Row ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        
        {/* Latest Price */}
        <div style={{ background: '#1c1e28', padding: '18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedSymbol} Price</span>
            <Activity size={16} color="#34D399" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>
            {latestPrice !== '-' ? `$${Number(latestPrice).toFixed(2)}` : '-'}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            Range: ${sessionInfo.sessionLow} - ${sessionInfo.sessionHigh}
          </div>
        </div>

        {/* Structure Bias */}
        <div style={{ background: '#1c1e28', padding: '18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Market Structure (15m)</span>
            {primaryStructure.trend.includes('Bullish') ? <ArrowUpRight size={16} color="#34D399" /> : <ArrowDownRight size={16} color="#F87171" />}
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: '700',
            color: primaryStructure.trend.includes('Bullish') ? '#34D399' : primaryStructure.trend.includes('Bearish') ? '#F87171' : '#cbd5e1'
          }}>
            {primaryStructure.confirmedTrend}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            BOS Count: {primaryStructure.bosCount} • Prob: {primaryStructure.probability}%
          </div>
        </div>

        {/* Active Session & Killzone */}
        <div style={{ background: '#1c1e28', padding: '18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Active Trading Session</span>
            <Clock size={16} color={sessionInfo.sessionBadgeColor} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: sessionInfo.sessionBadgeColor }}>
            {sessionInfo.activeSession}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {sessionInfo.isKillzone ? '⚡ High Volatility Window' : 'Normal Liquidity Flow'}
          </div>
        </div>

        {/* Confluence Rating */}
        <div style={{ background: '#1c1e28', padding: '18px', borderRadius: '16px', border: `1px solid ${confluenceScore.color}30` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Trend Confluence</span>
            <Zap size={16} color={confluenceScore.color} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: confluenceScore.color }}>
            {confluenceScore.pct}%
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
            {confluenceScore.label}
          </div>
        </div>

      </div>

      {/* ── View Switcher Navigation Tabs ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveTab('smt-studio')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'smt-studio' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
            color: activeTab === 'smt-studio' ? '#34D399' : '#94a3b8',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <Compass size={15} /> SMT & Market Structure
        </button>

        <button
          onClick={() => setActiveTab('mtf-matrix')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'mtf-matrix' ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
            color: activeTab === 'mtf-matrix' ? '#818CF8' : '#94a3b8',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <Layers size={15} /> Multi-Timeframe Matrix
        </button>

        <button
          onClick={() => setActiveTab('recent-signals')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeTab === 'recent-signals' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: activeTab === 'recent-signals' ? '#F59E0B' : '#94a3b8',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <BarChart2 size={15} /> Live Alert Logs ({filteredAlertsData.length})
        </button>
      </div>

      {/* ── TAB 1: SMT & MARKET STRUCTURE STUDIO ───────────────────────────── */}
      {activeTab === 'smt-studio' && (
        <>
          {/* Main Chart Pane (Structure & BOS/CHoCH) */}
          <div style={{
            background: '#1c1e28',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>
                  {selectedSymbol} Market Structure & Swing Breakouts (15m)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  High-low volatility corridor with fractal BOS and CHoCH key confirmation triggers
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60A5FA',
                  fontWeight: '600'
                }}>
                  ● BOS (Trend Continuation)
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  fontWeight: '600'
                }}>
                  ▲ CHoCH (Trend Reversal)
                </span>
              </div>
            </div>
            <div style={{ position: 'relative', height: '320px' }}>
              <canvas ref={priceChartRef}></canvas>
              {primaryData.length === 0 && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(18, 19, 26, 0.85)',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  gap: '8px'
                }}>
                  <Clock size={24} color="#818CF8" />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>No alert data within {selectedTimespan.toUpperCase()} window for {selectedSymbol}</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Try selecting a wider window (e.g. 7D or ALL) or refreshing</span>
                </div>
              )}
            </div>
          </div>

          {/* SMT Overlay & Correlation Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            
            {/* SMT Normalized Overlay Chart */}
            <div style={{
              background: '#1c1e28',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                    SMT Divergence Multi-Asset Monitor
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    {selectedSymbol} vs Inverted DXY & Silver (Identifies smart money lead/lag divergence)
                  </p>
                </div>
              </div>
              <div style={{ position: 'relative', height: '260px' }}>
                <canvas ref={smtChartRef}></canvas>
                {primaryData.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(18, 19, 26, 0.85)',
                    borderRadius: '12px',
                    color: '#94a3b8',
                    gap: '6px'
                  }}>
                    <Activity size={22} color="#F59E0B" />
                    <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Awaiting data points in current window</span>
                  </div>
                )}
              </div>
            </div>

            {/* Correlation Cards Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* DXY Card */}
              <div style={{
                background: '#1c1e28',
                padding: '16px',
                borderRadius: '14px',
                border: `1px solid ${dxyCorrelation.color}30`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>DXY (US Dollar)</span>
                  <span style={{ fontSize: '11px', color: dxyCorrelation.color, fontWeight: '600' }}>
                    {dxyCorrelation.label}
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: dxyStructure.trend.includes('Bullish') ? '#34D399' : dxyStructure.trend.includes('Bearish') ? '#F87171' : '#94a3b8' }}>
                  {dxyStructure.confirmedTrend}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Inverse Target: Dollar weakness confirms Gold upside
                </div>
              </div>

              {/* XAGUSD Card */}
              <div style={{
                background: '#1c1e28',
                padding: '16px',
                borderRadius: '14px',
                border: `1px solid ${xagCorrelation.color}30`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>XAGUSD (Silver)</span>
                  <span style={{ fontSize: '11px', color: xagCorrelation.color, fontWeight: '600' }}>
                    {xagCorrelation.label}
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: xagStructure.trend.includes('Bullish') ? '#34D399' : xagStructure.trend.includes('Bearish') ? '#F87171' : '#94a3b8' }}>
                  {xagStructure.confirmedTrend}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Positive Target: Silver leads Gold during high-momentum breakouts
                </div>
              </div>

            </div>

          </div>
        </>
      )}

      {/* ── TAB 2: MULTI-TIMEFRAME MATRIX ─────────────────────────────────── */}
      {activeTab === 'mtf-matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{
            background: '#1c1e28',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f8fafc' }}>
              Multi-Timeframe Structure Alignment Matrix — {selectedSymbol}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {mtfMatrix.map((tf, i) => (
                <div key={i} style={{
                  background: '#12131a',
                  padding: '16px',
                  borderRadius: '12px',
                  border: `1px solid ${tf.bias === 'Bullish' ? 'rgba(52, 211, 153, 0.3)' : tf.bias === 'Bearish' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>{tf.timeframe}</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: tf.bias === 'Bullish' ? 'rgba(52, 211, 153, 0.15)' : tf.bias === 'Bearish' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: tf.bias === 'Bullish' ? '#34D399' : tf.bias === 'Bearish' ? '#F87171' : '#94a3b8',
                      fontWeight: '600'
                    }}>
                      {tf.trend}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                    Trend Probability: <strong style={{ color: '#f8fafc' }}>{tf.probability}%</strong>
                  </div>

                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${tf.probability}%`,
                      height: '100%',
                      background: tf.bias === 'Bullish' ? '#34D399' : tf.bias === 'Bearish' ? '#EF4444' : '#64748B'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
                    <span>BOS Count: {tf.bosCount}</span>
                    <span>Data: {tf.dataPointsCount} bars</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Distribution by Symbol */}
          <div style={{
            background: '#1c1e28',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '15px', color: '#f8fafc' }}>
              Alert Volume Activity by Ticker ({selectedTimespan.toUpperCase()})
            </h4>
            <div style={{ position: 'relative', height: '220px' }}>
              <canvas ref={volumeChartRef}></canvas>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 3: LIVE RECENT ALERTS ──────────────────────────────────────── */}
      {activeTab === 'recent-signals' && (
        <div style={{ background: '#1c1e28', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Webhook Signal Feed ({selectedTimespan.toUpperCase()})</h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Showing latest {Math.min(filteredAlertsData.length, 25)} alerts</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>Timestamp (UTC)</th>
                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>Symbol</th>
                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>Interval</th>
                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>Execution Price</th>
                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>Action Payload</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlertsData.slice(0, 25).map((alert, i) => (
                <tr key={i}>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                    {new Date(alert.bar_time || alert.received_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '700', color: '#f8fafc' }}>
                    {alert.symbol || '-'}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                      {alert.interval || '15m'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '600', color: '#34D399' }}>
                    {alert.price || alert.bar_close ? `$${Number(alert.price || alert.bar_close).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#94a3b8' }} title={alert.message}>
                    {alert.message || '-'}
                  </td>
                </tr>
              ))}
              {filteredAlertsData.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No alerts received in the selected {selectedTimespan.toUpperCase()} timespan window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
