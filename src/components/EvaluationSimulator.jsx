import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Target, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

const GROUPS = [
  ["Asian Open","BE",0,7,[]],           ["Asian Open","SL",0,6,[]],
  ["Asian Open","TP",2,2,[1.468,2.675]],["Asian Open","TP",3,1,[1.400,2.800,4.200]],
  ["Asian Open","TP",5,3,[1.148,2.570,4.378,7.296,11.193]],
  ["London-NY Overlap","BE",0,61,[]],   ["London-NY Overlap","SL",0,42,[]],
  ["London-NY Overlap","TP",2,19,[1.327,2.861]],
  ["London-NY Overlap","TP",3,8,[1.076,2.454,4.655]],
  ["London-NY Overlap","TP",4,9,[1.276,3.258,6.111,11.005]],
  ["London-NY Overlap","TP",5,4,[1.133,2.508,3.961,7.264,13.672]],
  ["NY Open","BE",0,45,[]],             ["NY Open","SL",0,27,[]],
  ["NY Open","TP",2,6,[1.129,2.272]],   ["NY Open","TP",3,4,[0.967,2.647,5.494]],
  ["NY Open","TP",4,12,[1.228,2.709,4.784,8.850]],
  ["NY Open","TP",5,4,[1.185,2.725,4.372,8.136,15.848]],
  ["Pre-NY Gap","BE",0,10,[]],          ["Pre-NY Gap","SL",0,2,[]],
  ["Pre-NY Gap","TP",2,2,[1.156,2.578]],["Pre-NY Gap","TP",3,2,[1.123,3.319,4.848]],
  ["Pre-NY Gap","TP",4,1,[0.875,1.750,2.500,5.250]],
  ["Pre-NY Gap","TP",5,4,[1.358,2.972,5.435,9.975,23.188]],
];

const POOL = [];
GROUPS.forEach(g => { for (let i=0;i<g[3];i++) POOL.push(g); });

const LADDER = [0, 0, 0.70, 0.20, 0.10];
const BE_COST = 0.15;
const SLIP = 0.05;
const RUNNER_BAIL = 0.30;
const ACCOUNT = 50000;
const MAX_DD = 5000;
const DAILY_HALT = -2.0;
const TRADES_PER_DAY = 2;

function drawTrade() {
  const [sess, status, ml, , Rs] = POOL[Math.floor(Math.random() * POOL.length)];
  if (status === "SL") return { r: -1 - SLIP, tag: "SL", label: "SL", sess };
  if (ml === 0) return { r: -BE_COST, tag: "BE", label: "BE", sess };
  let eff = ml;
  if (eff > 3 && Math.random() < RUNNER_BAIL) eff = 3;
  let r = 0;
  for (let i = 0; i < eff; i++) r += LADDER[i] * (Rs[i] - SLIP);
  return { r, tag: r > 0 ? "WIN" : "BE", label: eff >= 3 ? ("TP" + eff) : "TP2 stall", sess };
}

export default function EvaluationSimulator() {
  const [phase, setPhase] = useState(4000);
  const [riskPct, setRiskPct] = useState(0.5);
  
  const [isRunning, setIsRunning] = useState(false);
  
  const riskDollar = (riskPct / 100) * ACCOUNT;
  const targetR = phase / riskDollar;
  const ddR = MAX_DD / riskDollar;

  const [sim, setSim] = useState({
    eq: 0, peak: 0, n: 0, day: 1, inDay: 0, dayR: 0,
    paid: 0, done: null, curve: [0], streak: 0, worstStreak: 0,
    trades: []
  });

  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const tableRef = useRef(null);

  const reset = useCallback(() => {
    setSim({
      eq: 0, peak: 0, n: 0, day: 1, inDay: 0, dayR: 0,
      paid: 0, done: null, curve: [0], streak: 0, worstStreak: 0,
      trades: []
    });
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Sync reset when inputs change
  useEffect(() => {
    reset();
  }, [phase, riskPct, reset]);

  const stepTrade = useCallback(() => {
    setSim(prev => {
      if (prev.done) return prev;
      
      let nextDay = prev.day;
      let nextInDay = prev.inDay;
      let nextDayR = prev.dayR;

      if (nextInDay >= TRADES_PER_DAY || nextDayR <= DAILY_HALT) {
        nextDay++;
        nextInDay = 0;
        nextDayR = 0;
      }

      const t = drawTrade();
      const nextEq = prev.eq + t.r;
      const nextPeak = Math.max(prev.peak, nextEq);
      nextDayR += t.r;
      nextInDay++;
      const nextN = prev.n + 1;
      
      const nextCurve = [...prev.curve, nextEq];
      
      let nextPaid = prev.paid;
      let nextStreak = prev.streak;
      let nextWorstStreak = prev.worstStreak;

      if (t.r > 0.01) {
        nextPaid++;
        nextStreak = 0;
      } else {
        nextStreak++;
        if (nextStreak > nextWorstStreak) nextWorstStreak = nextStreak;
      }

      const currentDdR = nextEq - nextPeak;

      const newTrade = {
        n: nextN,
        day: nextDay,
        t,
        ddR: currentDdR,
        eq: nextEq
      };

      let done = null;
      if (nextEq >= targetR) done = 'pass';
      else if (currentDdR <= -ddR) done = 'fail';

      // Auto-scroll logic happens via effect
      return {
        eq: nextEq, peak: nextPeak, n: nextN, day: nextDay, inDay: nextInDay, dayR: nextDayR,
        paid: nextPaid, done, curve: nextCurve, streak: nextStreak, worstStreak: nextWorstStreak,
        trades: [...prev.trades, newTrade]
      };
    });
  }, [targetR, ddR]);

  useEffect(() => {
    if (sim.done && isRunning) {
      clearInterval(timerRef.current);
      setIsRunning(false);
    }
    if (tableRef.current && sim.trades.length > 0) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
  }, [sim.done, isRunning, sim.trades.length]);

  const toggleRun = () => {
    if (isRunning) {
      clearInterval(timerRef.current);
      setIsRunning(false);
    } else {
      if (sim.done) reset();
      setIsRunning(true);
      timerRef.current = setInterval(stepTrade, 55);
    }
  };

  const handleNextDay = () => {
    if (isRunning) toggleRun();
    if (sim.done) reset();
    
    // Step until the day changes
    setSim(prev => {
      let current = { ...prev };
      const startDay = current.day;
      let guard = 0;
      
      while (current.day === startDay && !current.done && guard++ < 12) {
        // Execute stepTrade logic synchronously
        if (current.inDay >= TRADES_PER_DAY || current.dayR <= DAILY_HALT) {
          current.day++;
          current.inDay = 0;
          current.dayR = 0;
        }
        const t = drawTrade();
        current.eq += t.r;
        current.dayR += t.r;
        current.inDay++;
        current.n++;
        if (current.eq > current.peak) current.peak = current.eq;
        current.curve = [...current.curve, current.eq];
        if (t.r > 0.01) { current.paid++; current.streak = 0; }
        else { current.streak++; if (current.streak > current.worstStreak) current.worstStreak = current.streak; }
        const currentDdR = current.eq - current.peak;
        current.trades = [...current.trades, { n: current.n, day: current.day, t, ddR: currentDdR, eq: current.eq }];
        
        if (current.eq >= targetR) current.done = 'pass';
        else if (currentDdR <= -ddR) current.done = 'fail';
      }
      return current;
    });
  };

  useEffect(() => {
    const paint = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth;
      const H = c.clientHeight;
      c.width = W * dpr;
      c.height = H * dpr;
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      x.clearRect(0, 0, W, H);
      
      const PL = 52, PR = 10, PT = 14, PB = 22, w = W - PL - PR, h = H - PT - PB;

      const hi = Math.max(targetR * 1.1, ...sim.curve, 1);
      const lo = Math.min(-ddR * 1.05, ...sim.curve);
      const N = Math.max(sim.curve.length - 1, 30);
      const X = i => PL + (i / N) * w;
      const Y = v => PT + h - ((v - lo) / (hi - lo)) * h;

      // zero line
      x.strokeStyle = 'rgba(255,255,255,0.1)';
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(PL, Y(0)); x.lineTo(PL + w, Y(0)); x.stroke();

      // target + floor
      x.setLineDash([5, 4]); x.lineWidth = 1;
      x.strokeStyle = '#10b981'; // pass green
      x.beginPath(); x.moveTo(PL, Y(targetR)); x.lineTo(PL + w, Y(targetR)); x.stroke();
      x.strokeStyle = '#f43f5e'; // fail red
      x.beginPath(); x.moveTo(PL, Y(-ddR)); x.lineTo(PL + w, Y(-ddR)); x.stroke();
      x.setLineDash([]);

      // axis labels
      x.fillStyle = '#94a3b8'; // text-subtle
      x.font = '11px system-ui, sans-serif'; x.textAlign = 'right';
      x.fillText('+$' + (targetR * riskDollar / 1000).toFixed(1) + 'k', PL - 7, Y(targetR) + 4);
      x.fillText('−$' + (ddR * riskDollar / 1000).toFixed(1) + 'k', PL - 7, Y(-ddR) + 4);
      x.fillText('0', PL - 7, Y(0) + 4);

      if (sim.curve.length < 2) return;

      // fill under curve
      const g = x.createLinearGradient(0, PT, 0, PT + h);
      g.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      x.beginPath(); x.moveTo(X(0), Y(0));
      sim.curve.forEach((v, i) => x.lineTo(X(i), Y(v)));
      x.lineTo(X(sim.curve.length - 1), Y(0)); x.closePath();
      x.fillStyle = g; x.fill();

      // curve
      x.beginPath(); x.strokeStyle = '#38bdf8'; // brand blue
      x.lineWidth = 2;
      x.lineJoin = 'round';
      sim.curve.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)));
      x.stroke();

      // head marker
      const li = sim.curve.length - 1;
      x.beginPath(); x.arc(X(li), Y(sim.curve[li]), 4, 0, 7);
      x.fillStyle = sim.done === 'fail' ? '#f43f5e' : (sim.done === 'pass' ? '#10b981' : '#38bdf8');
      x.fill();
    };
    
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [sim.curve, sim.done, targetR, ddR, riskDollar]);

  const worstDD = () => {
    let p = -1e9, w = 0;
    for (const v of sim.curve) {
      if (v > p) p = v;
      if (p - v > w) w = p - v;
    }
    return w;
  };

  const currentEqDollar = ACCOUNT + sim.eq * riskDollar;
  const togoDollar = Math.max(0, phase - sim.eq * riskDollar);
  const currentDdDollar = (sim.peak - sim.eq) * riskDollar;

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header-premium">
        <h1>50K Evaluation Simulator</h1>
        <p>Every trade is drawn from the 281 signals posted in permitted sessions between January and August 2026, managed with a 70/20/10 ladder. Breakevens are charged 0.15R, entries slip 0.05R, and 30% of runners bail at TP3.</p>
      </div>

      {/* Readout Metrics */}
      <div className="stats-row" style={{ marginBottom: '24px' }}>
        <div className="stat-card-premium">
          <div className="stat-card-title">Equity</div>
          <div className={`stat-card-value ${sim.eq > 0.01 ? 'text-green' : sim.eq < -0.01 ? 'text-red' : ''}`}>
            ${Math.round(currentEqDollar).toLocaleString()}
          </div>
        </div>
        <div className="stat-card-premium">
          <div className="stat-card-title">To target</div>
          <div className="stat-card-value text-blue">${Math.round(togoDollar).toLocaleString()}</div>
        </div>
        <div className="stat-card-premium">
          <div className="stat-card-title">Drawdown</div>
          <div className={`stat-card-value ${currentDdDollar > MAX_DD * 0.5 ? 'text-red' : ''}`}>
            {currentDdDollar > 1 ? `−$${Math.round(currentDdDollar).toLocaleString()}` : '$0'}
          </div>
        </div>
        <div className="stat-card-premium">
          <div className="stat-card-title">Trades</div>
          <div className="stat-card-value">{sim.n}</div>
        </div>
        <div className="stat-card-premium">
          <div className="stat-card-title">Day</div>
          <div className="stat-card-value">{sim.n ? sim.day : 0}</div>
        </div>
        <div className="stat-card-premium">
          <div className="stat-card-title">Paid / Total</div>
          <div className="stat-card-value">{sim.paid} / {sim.n}</div>
        </div>
      </div>

      {/* Canvas Chart */}
      <div className="chart-card-premium" style={{ marginBottom: '24px' }}>
        <h3 className="chart-card-title">Performance Trajectory</h3>
        <canvas ref={canvasRef} style={{ width: '100%', height: '300px', display: 'block' }}></canvas>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '13px', color: 'var(--text-subtle)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '2px', background: '#38bdf8' }}></span> Equity
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '0px', borderTop: '2px dashed #10b981' }}></span> Pass target
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '0px', borderTop: '2px dashed #f43f5e' }}></span> Drawdown floor
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="chart-card-premium" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>Phase</label>
          <select value={phase} onChange={e => setPhase(Number(e.target.value))} style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff', fontSize: '14px' }}>
            <option value="4000" style={{color: '#000'}}>Phase 1 — $4,000</option>
            <option value="2500" style={{color: '#000'}}>Phase 2 — $2,500</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-subtle)', fontWeight: 600 }}>Risk per trade</label>
          <select value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} style={{ padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-card)', color: '#fff', fontSize: '14px' }}>
            <option value="0.25" style={{color: '#000'}}>0.25% — $125</option>
            <option value="0.5" style={{color: '#000'}}>0.50% — $250</option>
            <option value="0.75" style={{color: '#000'}}>0.75% — $375</option>
            <option value="1" style={{color: '#000'}}>1.00% — $500</option>
            <option value="2" style={{color: '#000'}}>2.00% — $1,000</option>
          </select>
        </div>
        <button onClick={toggleRun} className="btn btn-primary" style={{ padding: '10px 20px', minWidth: '130px', background: isRunning ? '#f43f5e' : '#38bdf8', borderColor: isRunning ? '#f43f5e' : '#38bdf8', color: '#0f172a' }}>
          {isRunning ? 'Stop' : 'Run to finish'}
        </button>
        <button onClick={() => { if(isRunning) toggleRun(); stepTrade(); }} className="btn" style={{ padding: '10px 20px', background: 'var(--panel)', color: 'var(--text-main)' }}>
          Next trade
        </button>
        <button onClick={handleNextDay} className="btn" style={{ padding: '10px 20px', background: 'var(--panel)', color: 'var(--text-main)' }}>
          Next day
        </button>
        <button onClick={reset} className="btn" style={{ padding: '10px 20px', background: 'var(--panel)', color: 'var(--text-main)' }}>
          Reset
        </button>
      </div>

      {/* Verdict Alert */}
      {sim.done && (
        <div style={{
          padding: '16px 20px', marginBottom: '24px', borderRadius: '6px',
          backgroundColor: sim.done === 'pass' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          borderLeft: `4px solid ${sim.done === 'pass' ? '#10b981' : '#f43f5e'}`
        }}>
          {sim.done === 'pass' ? (
            <div>
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> Passed in {sim.n} trades across {sim.day} trading days.
              </div>
              <div style={{ color: 'var(--text-subtle)', fontSize: '14px' }}>
                Only {sim.paid} of {sim.n} trades paid anything. Worst drawdown on the way: −${Math.round(worstDD() * riskDollar).toLocaleString()}.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#f43f5e', fontWeight: 600, fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> Failed — drawdown floor breached after {sim.n} trades.
              </div>
              <div style={{ color: 'var(--text-subtle)', fontSize: '14px' }}>
                This happens in roughly 1 run in 500 at 0.50% risk. At 1.00% it is closer to 1 in 20.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blotter Table */}
      <div className="chart-card-premium" style={{ padding: 0, overflow: 'hidden' }}>
        <div ref={tableRef} style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="table-premium" style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--edge)', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Day</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Result</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>R</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>P&L</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Equity</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Drawdown</th>
              </tr>
            </thead>
            <tbody>
              {sim.trades.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                    Press "Run to finish" to trade the evaluation, or step through one trade at a time.
                  </td>
                </tr>
              ) : (
                sim.trades.map((tr, i) => {
                  const isLatest = i === sim.trades.length - 1;
                  const tagCls = tr.t.tag === 'SL' ? 'danger' : tr.t.tag === 'WIN' ? 'success' : 'warning';
                  return (
                    <tr key={i} style={{ backgroundColor: isLatest ? 'rgba(56, 189, 248, 0.08)' : 'transparent', borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '10px 16px' }}>{tr.n}</td>
                      <td style={{ padding: '10px 16px' }}>{tr.day}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className={`status-badge ${tagCls}`}>{tr.t.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: tr.t.r > 0.01 ? '#10b981' : tr.t.r < -0.01 ? '#f43f5e' : 'var(--text-subtle)' }}>
                        {tr.t.r > 0 ? '+' : ''}{tr.t.r.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: tr.t.r > 0.01 ? '#10b981' : tr.t.r < -0.01 ? '#f43f5e' : 'var(--text-subtle)' }}>
                        {tr.t.r > 0 ? '+' : ''}${Math.round(tr.t.r * riskDollar).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>
                        ${Math.round(ACCOUNT + tr.eq * riskDollar).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: tr.ddR < -0.01 ? '#f43f5e' : 'var(--text-subtle)' }}>
                        {tr.ddR < -0.01 ? `−$${Math.round(-tr.ddR * riskDollar).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sim.worstStreak >= 5 && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#f43f5e' }}>
          Longest run without a payout so far: {sim.worstStreak} trades. Median for this system is 8; the 95th percentile is 14.
        </div>
      )}
      
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-card)', fontSize: '12px', color: 'var(--text-subtle)', maxWidth: '80ch' }}>
        Resampled from a record with no losing months, so it cannot show you a month where gold trends through every fib entry. Treat the pass rates as an optimistic ceiling. Technical read of your own system, not financial advice.
      </div>
    </div>
  );
}
