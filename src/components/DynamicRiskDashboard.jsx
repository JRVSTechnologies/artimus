import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calculator, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sliders, 
  RotateCcw, 
  Download, 
  Info, 
  Volume2, 
  VolumeX, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  Percent,
  Layers,
  FileCode,
  X
} from 'lucide-react';
import '../styles/DynamicRiskDashboard.css';

export default function DynamicRiskDashboard() {
  // Global Settings State
  const [riskUSD, setRiskUSD] = useState(250);
  const [targetUSD, setTargetUSD] = useState(250);
  const [tp1Pips, setTp1Pips] = useState(200);
  const [pipMode, setPipMode] = useState('standard'); // 'standard' ($10/pip) or 'dollar' ($100/pip)
  const [commissionPerLot, setCommissionPerLot] = useState(7.00);
  const [includeCommission, setIncludeCommission] = useState(true);

  // Active Trade Controls
  const [currentSL, setCurrentSL] = useState(30);
  const [direction, setDirection] = useState('LONG'); // 'LONG' or 'SHORT'
  const [entryPrice, setEntryPrice] = useState(2650.00);
  const [customRunnerPips, setCustomRunnerPips] = useState(750);

  // UI state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sortCol, setSortCol] = useState(0);
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const presetVariants = useMemo(() => [20, 25, 30, 40, 50, 60, 75, 80, 100, 125, 150, 200], []);

  // Audio click synthesizer
  const playClick = useCallback((freq = 800, duration = 0.04) => {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio fallback
    }
  }, [audioEnabled]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  const copyToClipboard = useCallback((text, id, label = 'Value') => {
    playClick(1100, 0.05);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast(`Copied ${label}: ${text}`);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      showToast(`Copied ${label}: ${text}`);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }, [playClick, showToast]);

  // Pip Values
  const pipValue = pipMode === 'standard' ? 10.00 : 100.00;
  const pricePerPip = pipMode === 'standard' ? 0.10 : 1.00;

  // Calculation function for any given SL
  const calculateMetrics = useCallback((slPips) => {
    const exactEntry = slPips > 0 ? (riskUSD / (slPips * pipValue)) : 0;
    const mt5Entry = Math.floor(exactEntry * 100) / 100;
    const actualDollarRisk = mt5Entry * slPips * pipValue;

    const exactClose = tp1Pips > 0 ? (targetUSD / (tp1Pips * pipValue)) : 0;
    const mt5CloseRaw = Math.ceil(exactClose * 100) / 100;
    const mt5CloseExecuted = Math.min(mt5Entry, mt5CloseRaw);

    const theoClosePct = tp1Pips > 0 ? ((slPips / tp1Pips) * 100) : 0;
    const actualClosePct = mt5Entry > 0 ? ((mt5CloseExecuted / mt5Entry) * 100) : 0;
    const runnerLot = Math.max(0, +(mt5Entry - mt5CloseExecuted).toFixed(2));

    const grossBanked = mt5CloseExecuted * tp1Pips * pipValue;
    const entryCommission = mt5Entry * commissionPerLot;
    const exitCommission = mt5CloseExecuted * commissionPerLot;
    const netBanked = includeCommission ? (grossBanked - exitCommission) : grossBanked;

    const beBufferPips = +(commissionPerLot / pipValue).toFixed(2);
    const rrAtTP1 = slPips > 0 ? (tp1Pips / slPips) : 0;

    const slGoldDist = slPips * pricePerPip;
    const tp1GoldDist = tp1Pips * pricePerPip;

    let slPrice = 0;
    let tp1Price = 0;
    let bePrice = 0;

    if (direction === 'LONG') {
      slPrice = entryPrice - slGoldDist;
      tp1Price = entryPrice + tp1GoldDist;
      bePrice = entryPrice + (beBufferPips * pricePerPip);
    } else {
      slPrice = entryPrice + slGoldDist;
      tp1Price = entryPrice - tp1GoldDist;
      bePrice = entryPrice - (beBufferPips * pricePerPip);
    }

    return {
      slPips,
      slGoldDist,
      exactEntry,
      mt5Entry,
      actualDollarRisk,
      exactClose,
      mt5CloseRaw,
      mt5CloseExecuted,
      theoClosePct,
      actualClosePct,
      runnerLot,
      grossBanked,
      netBanked,
      entryCommission,
      exitCommission,
      beBufferPips,
      rrAtTP1,
      slPrice,
      tp1Price,
      bePrice,
      isDeficit: mt5CloseRaw > mt5Entry
    };
  }, [riskUSD, targetUSD, tp1Pips, pipValue, pricePerPip, commissionPerLot, includeCommission, direction, entryPrice]);

  // Active Trade Metrics
  const activeMetrics = useMemo(() => calculateMetrics(currentSL), [calculateMetrics, currentSL]);

  // Runner Simulator Calculations
  const runnerMilestones = useMemo(() => {
    const calc = (totalPips) => {
      const runnerProfit = activeMetrics.runnerLot * totalPips * pipValue;
      const totalTradeProfit = activeMetrics.grossBanked + runnerProfit;
      const totalR = riskUSD > 0 ? (totalTradeProfit / riskUSD) : 0;
      const price = direction === 'LONG' 
        ? entryPrice + (totalPips * pricePerPip)
        : entryPrice - (totalPips * pricePerPip);
      return { totalPips, runnerProfit, totalTradeProfit, totalR, price };
    };

    return {
      tp1: calc(tp1Pips),
      m300: calc(300),
      m400: calc(400),
      m500: calc(500),
      custom: calc(customRunnerPips)
    };
  }, [activeMetrics, pipValue, riskUSD, direction, entryPrice, pricePerPip, tp1Pips, customRunnerPips]);

  // Matrix Table Data
  const matrixData = useMemo(() => {
    let list = presetVariants.map(sl => calculateMetrics(sl));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(d => d.slPips.toString().includes(q));
    }
    list.sort((a, b) => {
      let valA, valB;
      switch (sortCol) {
        case 0: valA = a.slPips; valB = b.slPips; break;
        case 1: valA = a.slGoldDist; valB = b.slGoldDist; break;
        case 2: valA = a.exactEntry; valB = b.exactEntry; break;
        case 3: valA = a.mt5Entry; valB = b.mt5Entry; break;
        case 4: valA = a.actualClosePct; valB = b.actualClosePct; break;
        case 5: valA = a.mt5CloseExecuted; valB = b.mt5CloseExecuted; break;
        case 6: valA = a.grossBanked; valB = b.grossBanked; break;
        case 7: valA = a.runnerLot; valB = b.runnerLot; break;
        case 8: valA = a.rrAtTP1; valB = b.rrAtTP1; break;
        default: valA = a.slPips; valB = b.slPips;
      }
      return sortAsc ? (valA - valB) : (valB - valA);
    });
    return list;
  }, [presetVariants, calculateMetrics, searchQuery, sortCol, sortAsc]);

  // Order Blueprint Code
  const orderTicketCode = useMemo(() => {
    const dirText = direction === 'LONG' ? 'BUY' : 'SELL';
    return `// ─── MT5 ORDER EXECUTION BLUEPRINT ───
SYMBOL:       XAUUSD (Gold)
ACTION:       ${dirText} ${activeMetrics.mt5Entry.toFixed(2)} Lots @ ${entryPrice.toFixed(2)}
INITIAL SL:   ${activeMetrics.slPrice.toFixed(2)} (-${currentSL} pips | Actual Risk: $${activeMetrics.actualDollarRisk.toFixed(2)})
PARTIAL TP1:  ${activeMetrics.tp1Price.toFixed(2)} (+${tp1Pips} pips)

// ─── AUTOMATED HARVESTING RULES ───
1. At ${activeMetrics.tp1Price.toFixed(2)} (+${tp1Pips} pips):
   • Partial Close: ${activeMetrics.mt5CloseExecuted.toFixed(2)} Lots (${activeMetrics.actualClosePct.toFixed(1)}% of volume)
   • Banks into Balance: $${activeMetrics.grossBanked.toFixed(2)} Gross (Finances Next $${riskUSD} Risk)
   
2. Breakeven Relocation:
   • Move SL immediately to: ${activeMetrics.bePrice.toFixed(2)} (+${activeMetrics.beBufferPips} pips buffer)
   • Covers $${commissionPerLot.toFixed(2)}/lot round-turn commission for net-zero exit.

3. Runner Management:
   • Remaining Runner: ${activeMetrics.runnerLot.toFixed(2)} Lots (Pure Free-Roll)
   • Trailing: Structure trail or target +500p (+$${(activeMetrics.runnerLot * 500 * pipValue).toFixed(2)})`;
  }, [direction, activeMetrics, entryPrice, currentSL, tp1Pips, riskUSD, commissionPerLot, pipValue]);

  // Export CSV
  const handleExportCSV = () => {
    playClick(1200);
    const rows = presetVariants.map(sl => calculateMetrics(sl));
    let csv = "data:text/csv;charset=utf-8,";
    csv += "SL_Pips,Gold_Dist_USD,Exact_Entry_Lot,MT5_Entry_Lot,Actual_Risk_USD,Close_Pct_TP1,MT5_Close_Lot,Gross_Banked_USD,Net_Banked_USD,Runner_Lot,RR_At_TP1\n";
    rows.forEach(r => {
      csv += [
        r.slPips,
        r.slGoldDist.toFixed(2),
        r.exactEntry.toFixed(4),
        r.mt5Entry.toFixed(2),
        r.actualDollarRisk.toFixed(2),
        r.actualClosePct.toFixed(1) + "%",
        r.mt5CloseExecuted.toFixed(2),
        r.grossBanked.toFixed(2),
        r.netBanked.toFixed(2),
        r.runnerLot.toFixed(2),
        r.rrAtTP1.toFixed(2)
      ].join(",") + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `XAUUSD_Risk_TP_Matrix_${riskUSD}USD.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Matrix Exported');
  };

  const handleReset = () => {
    playClick(600);
    setRiskUSD(250);
    setTargetUSD(250);
    setTp1Pips(200);
    setPipMode('standard');
    setCommissionPerLot(7.00);
    setIncludeCommission(true);
    setCurrentSL(30);
    setDirection('LONG');
    setEntryPrice(2650.00);
    setCustomRunnerPips(750);
    showToast('Reset to Defaults');
  };

  const runnerYield100p = activeMetrics.runnerLot * 100 * pipValue;
  const runnerYieldGold1 = activeMetrics.runnerLot * 100; // $1.00 move on 100oz contract = $100 per lot

  return (
    <div className="drd-container">
      
      {/* ── 1. Top Header ── */}
      <div className="drd-header">
        <div className="drd-header-left">
          <div className="drd-logo-badge">
            <Calculator size={22} />
          </div>
          <div>
            <div className="drd-title">
              Dynamic Risk & Partial TP Ladder
              <span className="drd-badge drd-badge-emerald">MT5 INSTANT</span>
            </div>
            <div className="drd-subtitle drd-mono">
              INSTITUTIONAL POSITION SIZING & PARTIAL HARVESTING ENGINE // XAUUSD & FOREX
            </div>
          </div>
        </div>

        <div className="drd-header-actions">
          <button 
            className={`drd-btn drd-btn-icon ${audioEnabled ? 'active-cyan' : ''}`}
            onClick={() => {
              setAudioEnabled(prev => !prev);
              showToast(audioEnabled ? 'Clicks Muted' : 'Clicks Enabled');
            }}
            title="Toggle Audio Feedback"
          >
            {audioEnabled ? <Volume2 size={16} color="#38bdf8" /> : <VolumeX size={16} color="#64748b" />}
          </button>

          <button className="drd-btn" onClick={() => { playClick(650); setIsFormulaOpen(true); }}>
            <Info size={14} />
            Formula Math Logic
          </button>

          <button className="drd-btn" onClick={handleReset}>
            <RotateCcw size={14} />
            Reset Defaults
          </button>

          <button className="drd-btn drd-btn-primary" onClick={handleExportCSV}>
            <Download size={14} />
            Export CSV Sheet
          </button>
        </div>
      </div>

      {/* ── 2. Top Control Bar (Global Settings) ── */}
      <section className="drd-control-panel">
        
        {/* Row 1: Core Trade Risk & Profit Parameters */}
        <div className="drd-control-row-primary">
          
          {/* Risk Capital */}
          <div className="drd-input-group">
            <label className="drd-label">
              <span>Risk Capital ($R)</span>
              <span className="drd-badge drd-badge-rose">MAX LOSS</span>
            </label>
            <div className="drd-input-wrap">
              <input 
                type="number" 
                className="drd-input" 
                value={riskUSD} 
                step="10" 
                min="10"
                onChange={(e) => setRiskUSD(parseFloat(e.target.value) || 0)}
              />
              <span className="drd-input-unit">USD</span>
            </div>
            <div className="drd-hint">
              <span>Presets:</span>
              <a onClick={() => { playClick(850); setRiskUSD(100); }}>$100</a> ·
              <a onClick={() => { playClick(850); setRiskUSD(250); }} style={{ color: '#38bdf8', fontWeight: 700 }}>$250</a> ·
              <a onClick={() => { playClick(850); setRiskUSD(500); }}>$500</a> ·
              <a onClick={() => { playClick(850); setRiskUSD(1000); }}>$1K</a>
            </div>
          </div>

          {/* Target Banked Profit */}
          <div className="drd-input-group">
            <label className="drd-label">
              <span>Target Banked Profit</span>
              <span className="drd-badge drd-badge-emerald">AT TP1</span>
            </label>
            <div className="drd-input-wrap">
              <input 
                type="number" 
                className="drd-input" 
                value={targetUSD} 
                step="10" 
                min="10"
                onChange={(e) => setTargetUSD(parseFloat(e.target.value) || 0)}
              />
              <span className="drd-input-unit">USD</span>
            </div>
            <div className="drd-hint">
              <span>Finances next trade setup (1.0R banked)</span>
            </div>
          </div>

          {/* TP1 Distance */}
          <div className="drd-input-group">
            <label className="drd-label">
              <span>Partial Distance (TP1)</span>
              <span className="drd-badge drd-badge-emerald">${(tp1Pips * pricePerPip).toFixed(2)} Gold Move</span>
            </label>
            <div className="drd-input-wrap">
              <input 
                type="number" 
                className="drd-input" 
                value={tp1Pips} 
                step="10" 
                min="10"
                onChange={(e) => setTp1Pips(parseFloat(e.target.value) || 0)}
              />
              <span className="drd-input-unit">PIPS</span>
            </div>
            <div className="drd-hint">
              <span>Default scale-out target (+{tp1Pips} pips)</span>
            </div>
          </div>

        </div>

        {/* Section Divider */}
        <div className="drd-control-divider">
          <span className="drd-divider-label">BROKER & CONTRACT EXECUTION SPECIFICATIONS</span>
        </div>

        {/* Row 2: Broker Execution Environment */}
        <div className="drd-control-row-secondary">
          
          {/* Pip Convention Switcher */}
          <div className="drd-input-group">
            <label className="drd-label">
              <span>Pip Value Basis</span>
              <span className="drd-badge drd-badge-dim">
                {pipMode === 'standard' ? 'XAUUSD: 10 PIPS = $1.00' : 'XAUUSD: 1 PIP = $1.00'}
              </span>
            </label>
            <div className="drd-toggle-group">
              <button 
                className={`drd-toggle-btn ${pipMode === 'standard' ? 'active-emerald' : ''}`}
                onClick={() => { playClick(950); setPipMode('standard'); }}
              >
                $0.10 / pip (10 pips = $1.00)
              </button>
              <button 
                className={`drd-toggle-btn ${pipMode === 'dollar' ? 'active-cyan' : ''}`}
                onClick={() => { playClick(950); setPipMode('dollar'); }}
              >
                $1.00 / pip (1 pip = $1.00)
              </button>
            </div>
            <div className="drd-hint">
              <span>${pipValue.toFixed(2)} / pip per 1.00 standard lot (100 oz contract)</span>
            </div>
          </div>

          {/* Commission & BE Buffer */}
          <div className="drd-input-group">
            <div className="drd-label">
              <span>Round-Turn Commission</span>
              <div 
                className={`drd-switch ${includeCommission ? 'active' : ''}`}
                onClick={() => {
                  playClick(900);
                  setIncludeCommission(!includeCommission);
                }}
              >
                <div className="drd-switch-track">
                  <div className="drd-switch-thumb"></div>
                </div>
                <span style={{ fontSize: '10px', color: includeCommission ? '#10b981' : '#64748b' }}>
                  {includeCommission ? 'DEDUCT ON' : 'OFF'}
                </span>
              </div>
            </div>
            <div className="drd-input-wrap">
              <input 
                type="number" 
                className="drd-input" 
                value={commissionPerLot} 
                step="0.5" 
                min="0"
                onChange={(e) => setCommissionPerLot(parseFloat(e.target.value) || 0)}
              />
              <span className="drd-input-unit">$/LOT RT</span>
            </div>
            <div className="drd-hint">
              <span>Covers RT commission · BE Buffer: <b style={{ color: '#38bdf8' }}>+{activeMetrics.beBufferPips} pips</b></span>
            </div>
          </div>

        </div>

      </section>

      {/* ── 3. Interactive Hero Calculator ── */}
      <div className="drd-hero-card">
        
        <div className="drd-card-header">
          <div>
            <div className="drd-title" style={{ fontSize: '18px' }}>
              <Sliders size={20} color="#38bdf8" />
              Live Trade Execution Calculator
            </div>
            <div className="drd-subtitle drd-mono">
              Strict Mathematical Floor & Ceil Engine for MT5 Order Placement
            </div>
          </div>

          <div>
            {activeMetrics.isDeficit ? (
              <span className="drd-badge drd-badge-rose">
                <AlertTriangle size={12} />
                CAPITAL DEFICIT AT TP1
              </span>
            ) : (
              <span className="drd-badge drd-badge-emerald">
                <CheckCircle2 size={12} />
                RISK FINANCED AT TP1
              </span>
            )}
          </div>
        </div>

        {/* SL Slider & Controls */}
        <div className="drd-sl-section">
          <div className="drd-sl-header">
            <div>
              <div className="drd-label">CURRENT TRADE STOP LOSS</div>
              <div className="drd-sl-val-group">
                <span className="drd-sl-number drd-mono">{currentSL}</span>
                <span style={{ fontSize: '13px', color: '#94a3b8' }} className="drd-mono">PIPS</span>
                <span className="drd-sl-gold-badge drd-mono">${activeMetrics.slGoldDist.toFixed(2)} Gold Move</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="drd-mono" style={{ fontSize: '11px', color: '#64748b' }}>PRECISE SL:</span>
              <div className="drd-input-wrap" style={{ width: '110px' }}>
                <input 
                  type="number" 
                  className="drd-input" 
                  value={currentSL} 
                  min="5" 
                  max="300"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) setCurrentSL(v);
                  }}
                />
                <span className="drd-input-unit">pips</span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="drd-slider-wrap">
            <input 
              type="range" 
              className="drd-slider" 
              min="5" 
              max="250" 
              value={currentSL}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setCurrentSL(v);
                playClick(700 + v * 2, 0.02);
              }}
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="drd-preset-strip">
            <span className="drd-mono" style={{ fontSize: '11px', color: '#64748b', marginRight: '4px' }}>FAST PRESETS:</span>
            {presetVariants.map(p => (
              <button 
                key={p}
                className={`drd-chip ${currentSL === p ? 'active' : ''}`}
                onClick={() => { playClick(1000); setCurrentSL(p); }}
              >
                {p}p
              </button>
            ))}
          </div>
        </div>

        {/* Direction & Price Level Strip */}
        <div className="drd-price-strip">
          
          <div className="drd-price-pill">
            <span className="drd-pill-label">DIRECTION</span>
            <div className="drd-toggle-group" style={{ minWidth: '130px', flex: '1 1 auto' }}>
              <button 
                className={`drd-toggle-btn ${direction === 'LONG' ? 'active-emerald' : ''}`}
                onClick={() => { playClick(1100); setDirection('LONG'); }}
              >
                LONG ▲
              </button>
              <button 
                className={`drd-toggle-btn ${direction === 'SHORT' ? 'active-rose' : ''}`}
                onClick={() => { playClick(1100); setDirection('SHORT'); }}
              >
                SHORT ▼
              </button>
            </div>
          </div>

          <div className="drd-price-pill">
            <span className="drd-pill-label">ENTRY PRICE (XAUUSD)</span>
            <div className="drd-input-wrap" style={{ minWidth: '120px', flex: '1 1 auto' }}>
              <input 
                type="number" 
                className="drd-input" 
                value={entryPrice} 
                step="0.5"
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="drd-price-pill">
            <span className="drd-pill-label" style={{ color: '#f43f5e' }}>
              <ArrowDownRight size={11} /> STOP LOSS LEVEL
            </span>
            <div className="drd-pill-val-row">
              <span className="drd-pill-val" style={{ color: '#f43f5e' }}>{activeMetrics.slPrice.toFixed(2)}</span>
              <button 
                className="drd-copy-pill"
                onClick={() => copyToClipboard(activeMetrics.slPrice.toFixed(2), 'price-sl', 'Stop Loss Price')}
              >
                {copiedId === 'price-sl' ? <Check size={11} color="#10b981" /> : 'Copy'}
              </button>
            </div>
          </div>

          <div className="drd-price-pill">
            <span className="drd-pill-label" style={{ color: '#10b981' }}>
              <ArrowUpRight size={11} /> TP1 HARVEST LEVEL
            </span>
            <div className="drd-pill-val-row">
              <span className="drd-pill-val" style={{ color: '#10b981' }}>{activeMetrics.tp1Price.toFixed(2)}</span>
              <button 
                className="drd-copy-pill"
                onClick={() => copyToClipboard(activeMetrics.tp1Price.toFixed(2), 'price-tp1', 'TP1 Price')}
              >
                {copiedId === 'price-tp1' ? <Check size={11} color="#10b981" /> : 'Copy'}
              </button>
            </div>
          </div>

          <div className="drd-price-pill">
            <span className="drd-pill-label" style={{ color: '#38bdf8' }}>
              <ShieldAlert size={11} /> BE STOP (+BUFFER)
            </span>
            <div className="drd-pill-val-row">
              <span className="drd-pill-val" style={{ color: '#38bdf8' }}>{activeMetrics.bePrice.toFixed(2)}</span>
              <button 
                className="drd-copy-pill"
                onClick={() => copyToClipboard(activeMetrics.bePrice.toFixed(2), 'price-be', 'Breakeven Price')}
              >
                {copiedId === 'price-be' ? <Check size={11} color="#10b981" /> : 'Copy'}
              </button>
            </div>
          </div>

        </div>

        {/* Warning Alert if Deficit */}
        {activeMetrics.isDeficit && (
          <div className="drd-warning">
            <AlertTriangle size={22} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div className="drd-warning-title">INSUFFICIENT POSITION VOLUME WARNING (SL ≥ TP1)</div>
              <div className="drd-warning-desc">
                Your Stop Loss (<b>{currentSL} pips</b>) requires closing <b>{activeMetrics.mt5CloseRaw} lots</b> to bank ${targetUSD}. However, entry volume is strictly capped at <b>{activeMetrics.mt5Entry} lots</b> to protect your ${riskUSD} max loss. Closing 100% of the position banks only <b>${activeMetrics.grossBanked.toFixed(2)}</b> (a deficit of ${(targetUSD - activeMetrics.grossBanked).toFixed(2)}). Runner lot is <b>0.00</b>.
              </div>
            </div>
          </div>
        )}

        {/* ── 4 High-Contrast KPI Cards ── */}
        <div className="drd-kpi-grid">
          
          {/* Card 1: Entry Lot */}
          <div className="drd-kpi-card drd-kpi-cyan">
            <div className="drd-kpi-top">
              <span className="drd-kpi-title" style={{ color: '#38bdf8' }}>1. MT5 ENTRY LOT</span>
              <button 
                className="drd-btn drd-btn-xs" 
                onClick={() => copyToClipboard(activeMetrics.mt5Entry.toFixed(2), 'kpi-entry', 'Entry Lot')}
              >
                {copiedId === 'kpi-entry' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                Copy
              </button>
            </div>
            <div className="drd-kpi-number-row">
              <span className="drd-kpi-big" style={{ color: '#38bdf8' }}>{activeMetrics.mt5Entry.toFixed(2)}</span>
              <span className="drd-badge drd-badge-cyan">FLOOR 0.01</span>
            </div>
            <div className="drd-kpi-sub">
              <span>Exact Unrounded: <b>{activeMetrics.exactEntry.toFixed(4)} lot</b></span>
              <span>Actual $ Risk: <b style={{ color: '#f43f5e' }}>${activeMetrics.actualDollarRisk.toFixed(2)}</b> (-${(riskUSD - activeMetrics.actualDollarRisk).toFixed(2)} under)</span>
              <span>Comm: {includeCommission ? `$${activeMetrics.entryCommission.toFixed(2)} RT` : 'Off'}</span>
            </div>
          </div>

          {/* Card 2: Close Lot */}
          <div className="drd-kpi-card drd-kpi-emerald">
            <div className="drd-kpi-top">
              <span className="drd-kpi-title" style={{ color: '#10b981' }}>2. CLOSE AT TP1 (+{tp1Pips}p)</span>
              <button 
                className="drd-btn drd-btn-xs drd-btn-primary" 
                onClick={() => copyToClipboard(activeMetrics.mt5CloseExecuted.toFixed(2), 'kpi-close', 'Close Lot')}
              >
                {copiedId === 'kpi-close' ? <Check size={12} color="#fff" /> : <Copy size={12} />}
                Copy
              </button>
            </div>
            <div className="drd-kpi-number-row">
              <span className="drd-kpi-big" style={{ color: '#10b981' }}>{activeMetrics.mt5CloseExecuted.toFixed(2)}</span>
              <span className="drd-badge drd-badge-emerald">{activeMetrics.actualClosePct.toFixed(1)}% CLOSE</span>
            </div>
            <div className="drd-kpi-sub">
              <span>Theoretical Close: <b>{activeMetrics.theoClosePct.toFixed(1)}%</b> (SL/TP1)</span>
              <span>Banked at TP1: <b style={{ color: '#10b981' }}>${activeMetrics.grossBanked.toFixed(2)} Gross</b></span>
              <span style={{ color: '#10b981' }}>{includeCommission ? `Net Banked: $${activeMetrics.netBanked.toFixed(2)}` : `Net: $${activeMetrics.grossBanked.toFixed(2)}`}</span>
            </div>
          </div>

          {/* Card 3: Runner Lot */}
          <div className="drd-kpi-card drd-kpi-amber">
            <div className="drd-kpi-top">
              <span className="drd-kpi-title" style={{ color: '#f59e0b' }}>3. REMAINING RUNNER</span>
              <button 
                className="drd-btn drd-btn-xs" 
                onClick={() => copyToClipboard(activeMetrics.runnerLot.toFixed(2), 'kpi-runner', 'Runner Lot')}
              >
                {copiedId === 'kpi-runner' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                Copy
              </button>
            </div>
            <div className="drd-kpi-number-row">
              <span className="drd-kpi-big" style={{ color: '#f59e0b' }}>{activeMetrics.runnerLot.toFixed(2)}</span>
              <span className="drd-badge drd-badge-amber">
                {activeMetrics.mt5Entry > 0 ? ((activeMetrics.runnerLot / activeMetrics.mt5Entry) * 100).toFixed(1) : 0}% RUN
              </span>
            </div>
            <div className="drd-kpi-sub">
              <span>Risk State: <b style={{ color: '#10b981' }}>Pure Free-Roll</b></span>
              <span>Yield per 100 pips: <b style={{ color: '#f59e0b' }}>+${runnerYield100p.toFixed(2)}</b></span>
              <span>Yield per $1 move: <b style={{ color: '#f59e0b' }}>+${runnerYieldGold1.toFixed(2)}</b></span>
            </div>
          </div>

          {/* Card 4: R:R Multiple */}
          <div className={`drd-kpi-card ${activeMetrics.rrAtTP1 < 1.0 ? 'drd-kpi-rose' : 'drd-kpi-cyan'}`}>
            <div className="drd-kpi-top">
              <span className="drd-kpi-title">4. R:R MULTIPLE AT TP1</span>
              <span className={`drd-badge ${activeMetrics.rrAtTP1 < 1.0 ? 'drd-badge-rose' : 'drd-badge-cyan'}`}>
                {activeMetrics.rrAtTP1 < 1.0 ? 'INVERTED' : 'ASYMMETRIC'}
              </span>
            </div>
            <div className="drd-kpi-number-row">
              <span className="drd-kpi-big">{activeMetrics.rrAtTP1.toFixed(2)} R</span>
              <span className="drd-badge drd-badge-dim">{tp1Pips}p / {currentSL}p</span>
            </div>
            <div className="drd-kpi-sub">
              <span>Capital Risked: <b>${activeMetrics.actualDollarRisk.toFixed(2)}</b></span>
              <span>TP1 Financed: <b style={{ color: '#10b981' }}>{((activeMetrics.grossBanked / riskUSD) * 100).toFixed(1)}% of Next $R</b></span>
              <span style={{ color: activeMetrics.rrAtTP1 < 1.0 ? '#f43f5e' : '#38bdf8' }}>
                {activeMetrics.rrAtTP1 < 1.0 ? 'Warning: SL is larger than TP1' : '100% Risk Free beyond +200p'}
              </span>
            </div>
          </div>

        </div>

        {/* Position Volume Bar */}
        <div className="drd-pos-wrap">
          <div className="drd-pos-header">
            <span>POSITION VOLUME SPLIT</span>
            <span style={{ color: '#94a3b8' }}>
              Total: {activeMetrics.mt5Entry.toFixed(2)} Lot · Banked: {activeMetrics.mt5CloseExecuted.toFixed(2)} Lot ({activeMetrics.actualClosePct.toFixed(1)}%) · Runner: {activeMetrics.runnerLot.toFixed(2)} Lot
            </span>
          </div>
          <div className="drd-pos-track">
            <div 
              className="drd-pos-slice-closed" 
              style={{ width: `${Math.min(100, Math.max(0, activeMetrics.actualClosePct))}%` }}
            />
            <div 
              className="drd-pos-slice-runner" 
              style={{ width: `${Math.max(0, 100 - activeMetrics.actualClosePct)}%` }}
            />
          </div>
          <div className="drd-pos-legend">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }}></span>
              <span>Closed Slice at TP1: <b style={{ color: '#10b981' }}>{activeMetrics.mt5CloseExecuted.toFixed(2)} Lot</b> (${activeMetrics.grossBanked.toFixed(2)} Banked)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }}></span>
              <span>Running Free Slice: <b style={{ color: '#f59e0b' }}>{activeMetrics.runnerLot.toFixed(2)} Lot</b> (+${runnerYield100p.toFixed(2)} / 100p)</span>
            </div>
          </div>
        </div>

        {/* ── Runner Windfall Simulator ── */}
        <div className="drd-sim-box">
          <div className="drd-card-header">
            <div>
              <div className="drd-title" style={{ fontSize: '16px' }}>
                <TrendingUp size={18} color="#f59e0b" />
                Runner Windfall Projection Simulator
              </div>
              <div className="drd-subtitle drd-mono">
                Cumulative Realized Equity & Total R-Multiple as Runner Trades Further
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="drd-mono" style={{ fontSize: '11px', color: '#64748b' }}>CUSTOM RUNNER PIPS:</span>
              <div className="drd-input-wrap" style={{ width: '90px' }}>
                <input 
                  type="number" 
                  className="drd-input" 
                  value={customRunnerPips} 
                  step="50"
                  onChange={(e) => setCustomRunnerPips(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="drd-sim-grid">
            
            {/* +200p */}
            <div className="drd-sim-card featured">
              <div className="drd-sim-tag">
                <span style={{ color: '#10b981' }}>+{tp1Pips} PIPS (TP1)</span>
                <span className="drd-badge drd-badge-emerald">{runnerMilestones.tp1.price.toFixed(2)}</span>
              </div>
              <div className="drd-sim-profit" style={{ color: '#10b981' }}>
                ${activeMetrics.grossBanked.toFixed(2)}
              </div>
              <div className="drd-sim-meta">
                <span>Banked Partial: <b>${activeMetrics.grossBanked.toFixed(2)}</b></span>
                <span>Runner Open: <b>$0.00</b></span>
                <span>Total R-Multiple: <b style={{ color: '#10b981' }}>{(activeMetrics.grossBanked / riskUSD).toFixed(2)} R</b></span>
              </div>
            </div>

            {/* +300p */}
            <div className="drd-sim-card">
              <div className="drd-sim-tag">
                <span style={{ color: '#f59e0b' }}>+300 PIPS (+100p)</span>
                <span className="drd-badge drd-badge-dim">{runnerMilestones.m300.price.toFixed(2)}</span>
              </div>
              <div className="drd-sim-profit" style={{ color: '#f59e0b' }}>
                ${runnerMilestones.m300.totalTradeProfit.toFixed(2)}
              </div>
              <div className="drd-sim-meta">
                <span>Runner Profit: <b>+${runnerMilestones.m300.runnerProfit.toFixed(2)}</b></span>
                <span>Banked at TP1: <b>+${activeMetrics.grossBanked.toFixed(2)}</b></span>
                <span>Total R-Multiple: <b style={{ color: '#f59e0b' }}>{runnerMilestones.m300.totalR.toFixed(2)} R</b></span>
              </div>
            </div>

            {/* +400p */}
            <div className="drd-sim-card">
              <div className="drd-sim-tag">
                <span style={{ color: '#f59e0b' }}>+400 PIPS (+200p)</span>
                <span className="drd-badge drd-badge-dim">{runnerMilestones.m400.price.toFixed(2)}</span>
              </div>
              <div className="drd-sim-profit" style={{ color: '#f59e0b' }}>
                ${runnerMilestones.m400.totalTradeProfit.toFixed(2)}
              </div>
              <div className="drd-sim-meta">
                <span>Runner Profit: <b>+${runnerMilestones.m400.runnerProfit.toFixed(2)}</b></span>
                <span>Banked at TP1: <b>+${activeMetrics.grossBanked.toFixed(2)}</b></span>
                <span>Total R-Multiple: <b style={{ color: '#f59e0b' }}>{runnerMilestones.m400.totalR.toFixed(2)} R</b></span>
              </div>
            </div>

            {/* +500p */}
            <div className="drd-sim-card">
              <div className="drd-sim-tag">
                <span style={{ color: '#f59e0b' }}>+500 PIPS (+300p)</span>
                <span className="drd-badge drd-badge-dim">{runnerMilestones.m500.price.toFixed(2)}</span>
              </div>
              <div className="drd-sim-profit" style={{ color: '#f59e0b' }}>
                ${runnerMilestones.m500.totalTradeProfit.toFixed(2)}
              </div>
              <div className="drd-sim-meta">
                <span>Runner Profit: <b>+${runnerMilestones.m500.runnerProfit.toFixed(2)}</b></span>
                <span>Banked at TP1: <b>+${activeMetrics.grossBanked.toFixed(2)}</b></span>
                <span>Total R-Multiple: <b style={{ color: '#f59e0b' }}>{runnerMilestones.m500.totalR.toFixed(2)} R</b></span>
              </div>
            </div>

          </div>

          {/* Custom Milestone Result */}
          <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(10, 15, 29, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px' }} className="drd-mono">
              <span className="drd-badge drd-badge-amber">CUSTOM +{customRunnerPips} PIPS</span>
              <span style={{ color: '#94a3b8' }}>Target Price: {runnerMilestones.custom.price.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontSize: '12px' }} className="drd-mono">
              <span>Total Profit: <b style={{ color: '#f59e0b', fontSize: '15px', fontWeight: 800 }}>${runnerMilestones.custom.totalTradeProfit.toFixed(2)}</b></span>
              <span>Total Realized: <b style={{ color: '#10b981', fontSize: '15px', fontWeight: 800 }}>{runnerMilestones.custom.totalR.toFixed(2)} R</b></span>
            </div>
          </div>
        </div>

        {/* Order Blueprint Ticket */}
        <div className="drd-ticket-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="drd-mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
              MT5 ORDER EXECUTION BLUEPRINT
            </span>
            <button 
              className="drd-btn drd-btn-xs"
              onClick={() => copyToClipboard(orderTicketCode, 'ticket-code', 'Ticket Instructions')}
            >
              {copiedId === 'ticket-code' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              Copy Ticket Instructions
            </button>
          </div>
          <pre className="drd-ticket-code">{orderTicketCode}</pre>
        </div>

      </div>

      {/* ── 4. Dynamic Variants Reference Matrix Table ── */}
      <section className="drd-table-section">
        <div className="drd-card-header">
          <div>
            <div className="drd-title" style={{ fontSize: '18px' }}>
              <Layers size={20} color="#38bdf8" />
              Dynamic Variants Reference Matrix
            </div>
            <div className="drd-subtitle drd-mono">
              Click Any Row to Instantly Load into Calculator · Real-time Mathematical Scaling
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="drd-input-wrap" style={{ width: '180px' }}>
              <input 
                type="text" 
                className="drd-input" 
                placeholder="Search SL Pips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className="drd-btn drd-btn-xs"
              onClick={() => {
                playClick(800);
                setSortCol(0);
                setSortAsc(true);
                setSearchQuery('');
              }}
            >
              Default Sort
            </button>
          </div>
        </div>

        <div className="drd-table-wrap">
          <table className="drd-table">
            <thead>
              <tr>
                <th onClick={() => { playClick(900); if (sortCol === 0) setSortAsc(!sortAsc); else { setSortCol(0); setSortAsc(true); }}} className={sortCol === 0 ? 'sort-active' : ''}>
                  SL (Pips) ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 1) setSortAsc(!sortAsc); else { setSortCol(1); setSortAsc(true); }}} className={sortCol === 1 ? 'sort-active' : ''}>
                  Gold Dist ($) ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 2) setSortAsc(!sortAsc); else { setSortCol(2); setSortAsc(true); }}} className={sortCol === 2 ? 'sort-active' : ''}>
                  Exact Lot ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 3) setSortAsc(!sortAsc); else { setSortCol(3); setSortAsc(true); }}} className={sortCol === 3 ? 'sort-active' : ''}>
                  MT5 Entry Lot ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 4) setSortAsc(!sortAsc); else { setSortCol(4); setSortAsc(true); }}} className={sortCol === 4 ? 'sort-active' : ''}>
                  Close % at TP1 ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 5) setSortAsc(!sortAsc); else { setSortCol(5); setSortAsc(true); }}} className={sortCol === 5 ? 'sort-active' : ''}>
                  MT5 Close Lot ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 6) setSortAsc(!sortAsc); else { setSortCol(6); setSortAsc(true); }}} className={sortCol === 6 ? 'sort-active' : ''}>
                  Banked Profit ($) ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 7) setSortAsc(!sortAsc); else { setSortCol(7); setSortAsc(true); }}} className={sortCol === 7 ? 'sort-active' : ''}>
                  Runner Lot ↕
                </th>
                <th onClick={() => { playClick(900); if (sortCol === 8) setSortAsc(!sortAsc); else { setSortCol(8); setSortAsc(true); }}} className={sortCol === 8 ? 'sort-active' : ''}>
                  R:R at TP1 ↕
                </th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map((d) => {
                const isActive = d.slPips === currentSL;
                const rrColor = d.rrAtTP1 < 1.0 ? '#f43f5e' : '#10b981';

                return (
                  <tr 
                    key={d.slPips} 
                    className={isActive ? 'active-row' : ''}
                    onClick={(e) => {
                      if (e.target.closest('.drd-copy-pill')) return;
                      playClick(1000);
                      setCurrentSL(d.slPips);
                    }}
                  >
                    <td>
                      <span className="drd-mono" style={{ fontWeight: 700, color: isActive ? '#38bdf8' : 'inherit' }}>
                        {d.slPips} pips
                      </span>
                      {isActive && (
                        <span className="drd-badge drd-badge-cyan" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '6px' }}>
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8' }}>${d.slGoldDist.toFixed(2)}</td>
                    <td style={{ color: '#64748b' }}>{d.exactEntry.toFixed(3)}</td>
                    <td>
                      <span className="drd-mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{d.mt5Entry.toFixed(2)}</span>
                      <button 
                        className="drd-copy-pill"
                        title="Copy MT5 Entry Lot"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(d.mt5Entry.toFixed(2), `tbl-entry-${d.slPips}`, 'Entry Lot');
                        }}
                      >
                        {copiedId === `tbl-entry-${d.slPips}` ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                      </button>
                    </td>
                    <td>
                      <span className="drd-mono" style={{ fontWeight: 700 }}>{d.actualClosePct.toFixed(1)}%</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b', marginLeft: '4px' }}>({d.theoClosePct.toFixed(0)}% th)</span>
                    </td>
                    <td>
                      <span className="drd-mono" style={{ fontWeight: 700, color: '#10b981' }}>{d.mt5CloseExecuted.toFixed(2)}</span>
                      <button 
                        className="drd-copy-pill"
                        title="Copy MT5 Close Lot"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(d.mt5CloseExecuted.toFixed(2), `tbl-close-${d.slPips}`, 'Close Lot');
                        }}
                      >
                        {copiedId === `tbl-close-${d.slPips}` ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                      </button>
                    </td>
                    <td className="drd-mono" style={{ fontWeight: 700, color: '#10b981' }}>
                      ${d.grossBanked.toFixed(2)}
                    </td>
                    <td>
                      <span className="drd-mono" style={{ fontWeight: 700, color: '#f59e0b' }}>{d.runnerLot.toFixed(2)}</span>
                      <button 
                        className="drd-copy-pill"
                        title="Copy Runner Lot"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(d.runnerLot.toFixed(2), `tbl-runner-${d.slPips}`, 'Runner Lot');
                        }}
                      >
                        {copiedId === `tbl-runner-${d.slPips}` ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                      </button>
                    </td>
                    <td className="drd-mono" style={{ fontWeight: 700, color: rrColor }}>
                      {d.rrAtTP1.toFixed(2)} R
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className={`drd-btn drd-btn-xs ${isActive ? 'drd-btn-primary' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick(1000);
                          setCurrentSL(d.slPips);
                        }}
                      >
                        {isActive ? 'Loaded' : 'Load'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', flexWrap: 'wrap', gap: '10px' }} className="drd-mono">
          <div>Showing {matrixData.length} Variants (20p to 200p) · Synchronized with ${riskUSD} Risk & ${targetUSD} Target</div>
          <div><span style={{ color: '#38bdf8' }}>Tip:</span> Click any copy icon to copy precise lot volume straight into MT5.</div>
        </div>
      </section>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="drd-toast">
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Formula Transparency Modal ── */}
      {isFormulaOpen && (
        <div className="drd-modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsFormulaOpen(false); }}>
          <div className="drd-modal-window">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <div className="drd-title" style={{ fontSize: '17px' }}>Dynamic Risk & Partial TP Engine</div>
                <div className="drd-subtitle drd-mono">Mathematical Proof & Institutional Rules</div>
              </div>
              <button className="drd-btn drd-btn-icon" onClick={() => setIsFormulaOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">1. Exact Position Sizing</div>
              <code className="drd-formula-code">Exact_Entry_Lot = Risk_USD / (SL_Pips * Pip_Value)</code>
              <div className="drd-formula-desc">Continuous unrounded volume required so that reaching the stop loss incurs precisely $Risk_USD loss.</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">2. MT5 Execution Entry Lot (Floor Rule)</div>
              <code className="drd-formula-code">MT5_Entry_Lot = Math.floor(Exact_Entry_Lot * 100) / 100</code>
              <div className="drd-formula-desc">MT5 restricts volume to 0.01 lot increments. Sizing is strictly rounded <b>DOWN</b> (floor) to guarantee dollar risk never exceeds the maximum allowable risk cap.</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">3. Exact Partial Volume Needed to Finance the Trade</div>
              <code className="drd-formula-code">Exact_Close_Lot = Target_Profit_USD / (TP1_Pips * Pip_Value)</code>
              <div className="drd-formula-desc">Calculates the unrounded volume that, when closed at TP1, yields exactly $Target_Profit_USD (banking 1.0R for the next setup).</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">4. MT5 Partial Close Lot (Ceil Rule)</div>
              <code className="drd-formula-code">MT5_Close_Lot = Math.ceil(Exact_Close_Lot * 100) / 100</code>
              <div className="drd-formula-desc">Strictly rounded <b>UP</b> (ceil) to nearest 0.01 lot to guarantee at least the target profit is banked into balance.</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">5. Theoretical Close Percentage</div>
              <code className="drd-formula-code">Close_Percentage = (SL_Pips / TP1_Pips) * 100</code>
              <div className="drd-formula-desc">When Target Profit equals Initial Risk ($R), the exact mathematical fraction to harvest is purely the ratio of Stop Loss distance to TP1 distance.</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">6. Remaining Risk-Free Runner</div>
              <code className="drd-formula-code">Runner_Lot = Math.max(0, MT5_Entry_Lot - MT5_Close_Lot)</code>
              <div className="drd-formula-desc">Open remainder of trade after taking partial profits. Relocating SL to breakeven (+ buffer) converts this volume into pure windfall upside.</div>
            </div>

            <div className="drd-formula-card">
              <div className="drd-formula-title">7. Breakeven Commission Buffer</div>
              <code className="drd-formula-code">BE_Buffer_Pips = Commission_Per_Lot_RT / Pip_Value</code>
              <div className="drd-formula-desc">Moving SL precisely to Entry Price + BE_Buffer_Pips guarantees broker round-turn commissions are fully absorbed if stopped out at BE.</div>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="drd-btn drd-btn-primary" onClick={() => setIsFormulaOpen(false)}>Close Guide</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
