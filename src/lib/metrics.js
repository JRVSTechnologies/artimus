export function extractMaxTPFromText(text) {
  if (!text) return 1;
  const matches = [...text.matchAll(/TP\s*(\d+)/gi)];
  if (matches.length > 0) {
    return Math.max(...matches.map(m => parseInt(m[1], 10)));
  }
  return 1;
}

export function computeSignalMetrics(rawSignal) {
  const entryHigh = parseFloat(rawSignal['Entry High']);
  const entryLow = parseFloat(rawSignal['Entry Low']);
  const sl = parseFloat(rawSignal['S/L']);
  
  if (isNaN(entryHigh) || isNaN(entryLow) || isNaN(sl)) {
    return { ...rawSignal, isValid: false, risk_pts: 0, realizedR: { conservative: 0, ladder: 0, optimistic: 0 } };
  }

  const entry_mid = (entryLow + entryHigh) / 2;
  const risk_pts = Math.abs(entry_mid - sl);
  const zone_width = Math.abs(entryHigh - entryLow);
  const sl_dist_pct = risk_pts > 0 ? (risk_pts / entry_mid * 100) : 0;

  const tps = [rawSignal.TP1, rawSignal.TP2, rawSignal.TP3, rawSignal.TP4, rawSignal.TP5]
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
    
  const maxTpLevel = extractMaxTPFromText(rawSignal['Raw Signal Text']);
  
  let realizedR_conservative = 0;
  let realizedR_ladder = 0;
  let realizedR_optimistic = 0;

  if (rawSignal.Status === 'TP Hit') {
    if (tps.length > 0) {
      const tpRs = tps.map(tp => Math.abs(tp - entry_mid) / risk_pts);
      
      const tp1_r = tpRs[0];
      const max_tp_r = Math.max(...tpRs);

      realizedR_conservative = tp1_r;
      realizedR_optimistic = max_tp_r;
      
      if (tpRs.length >= 2) {
        realizedR_ladder = (tp1_r * 0.5) + (tpRs[1] * 0.25) + (max_tp_r * 0.25);
      } else {
        realizedR_ladder = max_tp_r;
      }
    } else {
      realizedR_conservative = 1;
      realizedR_ladder = 1;
      realizedR_optimistic = 1;
    }
  } else if (rawSignal.Status === 'SL Hit') {
    realizedR_conservative = -1;
    realizedR_ladder = -1;
    realizedR_optimistic = -1;
  } else if (rawSignal.Status === 'Breakeven') {
    realizedR_conservative = 0;
    realizedR_ladder = 0;
    realizedR_optimistic = 0;
  }

  let wibHour = 0;
  let wibDay = 0;
  try {
    const cleanDateStr = rawSignal.Date.replace(' (GMT+7)', '').replace(' at ', ' ');
    const dateObj = new Date(cleanDateStr); // Strip text to help JS Date
    const wibTimeStr = dateObj.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour12: false });
    const wibDate = new Date(wibTimeStr);
    if (!isNaN(wibDate.getTime())) {
      wibHour = wibDate.getHours();
      wibDay = wibDate.getDay();
    }
  } catch (e) {
    // default 0
  }

  return {
    ...rawSignal,
    isValid: risk_pts > 0,
    entry_mid,
    risk_pts,
    zone_width,
    sl_dist_pct,
    maxTpLevel,
    realizedR: {
      conservative: realizedR_conservative,
      ladder: realizedR_ladder,
      optimistic: realizedR_optimistic
    },
    wibHour,
    wibDay
  };
}

export function aggregateSignals(computedSignals, exitModel = 'ladder') {
  const closedSignals = computedSignals.filter(s => s.isValid && ['TP Hit', 'SL Hit', 'Breakeven'].includes(s.Status));
  
  const totalClosed = closedSignals.length;
  const wins = closedSignals.filter(s => s.Status === 'TP Hit').length;
  const losses = closedSignals.filter(s => s.Status === 'SL Hit').length;
  const bes = closedSignals.filter(s => s.Status === 'Breakeven').length;
  
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
  const beRate = totalClosed > 0 ? (bes / totalClosed) * 100 : 0;
  
  let cumulativeR = 0;
  let maxDD = 0;
  let peakR = 0;
  let currentStreak = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  const sortedSignals = [...closedSignals].sort((a, b) => {
    const dateA = new Date(a.Date.replace(' (GMT+7)', '').replace(' at ', ' '));
    const dateB = new Date(b.Date.replace(' (GMT+7)', '').replace(' at ', ' '));
    return dateA - dateB;
  });

  let prevOutcome = null;
  let currentStreakCount = 0;

  let cumCons = 0, cumLad = 0, cumOpt = 0;
  const multiEquityCurve = sortedSignals.map((s, index) => {
    const r = s.realizedR[exitModel] || 0;
    cumulativeR += r;
    
    if (r > 0) grossProfit += r;
    if (r < 0) grossLoss += Math.abs(r);

    if (cumulativeR > peakR) peakR = cumulativeR;
    const dd = peakR - cumulativeR;
    if (dd > maxDD) maxDD = dd;
    
    if (r > 0) {
      if (prevOutcome === 'win') currentStreakCount++;
      else { currentStreakCount = 1; prevOutcome = 'win'; }
    } else if (r < 0) {
      if (prevOutcome === 'loss') currentStreakCount--;
      else { currentStreakCount = -1; prevOutcome = 'loss'; }
    }
    
    cumCons += s.realizedR['conservative'];
    cumLad += s.realizedR['ladder'];
    cumOpt += s.realizedR['optimistic'];
    
    return {
      index: index + 1,
      name: s.Signal || `Signal ${s.Date}`,
      date: s.Date,
      conservative: cumCons,
      ladder: cumLad,
      optimistic: cumOpt,
      outcome: s.Status,
      session: s.Session,
      currentR: r,
      cumulativeR: cumulativeR
    };
  });
  
  currentStreak = currentStreakCount;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
  const expectancy = totalClosed > 0 ? (grossProfit - grossLoss) / totalClosed : 0;

  const sessionStats = {};
  closedSignals.forEach(s => {
    const sess = s.Session || 'Unknown';
    if (!sessionStats[sess]) sessionStats[sess] = { total: 0, wins: 0, losses: 0, r: 0 };
    sessionStats[sess].total++;
    if (s.Status === 'TP Hit') sessionStats[sess].wins++;
    if (s.Status === 'SL Hit') sessionStats[sess].losses++;
    sessionStats[sess].r += s.realizedR[exitModel] || 0;
  });

  const sessionArray = Object.keys(sessionStats).map(sess => {
    const t = sessionStats[sess];
    const exp = t.total > 0 ? t.r / t.total : 0;
    return { session: sess, total: t.total, expectancy: exp };
  });

  const directionStats = { Buy: { total: 0, wins: 0, r: 0 }, Sell: { total: 0, wins: 0, r: 0 } };
  closedSignals.forEach(s => {
    const dir = s.Direction === 'Buy' ? 'Buy' : 'Sell';
    directionStats[dir].total++;
    if (s.Status === 'TP Hit') directionStats[dir].wins++;
    directionStats[dir].r += s.realizedR[exitModel] || 0;
  });

  // Calculate Rolling Performance (20 signals)
  const rollingPerformance = [];
  const ROLL_WINDOW = 20;
  for (let i = 0; i < sortedSignals.length; i++) {
    const slice = sortedSignals.slice(Math.max(0, i - ROLL_WINDOW + 1), i + 1);
    const sWins = slice.filter(x => x.Status === 'TP Hit').length;
    const sLosses = slice.filter(x => x.Status === 'SL Hit').length;
    const sTotal = slice.length;
    const sWinRate = (sWins + sLosses) > 0 ? (sWins / (sWins + sLosses)) * 100 : 0;
    const sR = slice.reduce((acc, val) => acc + (val.realizedR[exitModel] || 0), 0);
    const sExp = sTotal > 0 ? sR / sTotal : 0;
    
    rollingPerformance.push({
      index: i + 1,
      winRate: sWinRate,
      expectancy: sExp
    });
  }

  const killZones = ['London Pre', 'London-NY Overlap', 'NY Open']; 
  const cfxSignals = closedSignals.filter(s => killZones.includes(s.Session));
  const cfxTotal = cfxSignals.length;
  const cfxWins = cfxSignals.filter(s => s.Status === 'TP Hit').length;
  const cfxLosses = cfxSignals.filter(s => s.Status === 'SL Hit').length;
  const cfxWinRate = (cfxWins + cfxLosses) > 0 ? (cfxWins / (cfxWins + cfxLosses)) * 100 : 0;
  const cfxGrossProfit = cfxSignals.reduce((acc, s) => acc + (s.realizedR[exitModel] > 0 ? s.realizedR[exitModel] : 0), 0);
  const cfxGrossLoss = cfxSignals.reduce((acc, s) => acc + (s.realizedR[exitModel] < 0 ? Math.abs(s.realizedR[exitModel]) : 0), 0);
  const cfxProfitFactor = cfxGrossLoss > 0 ? cfxGrossProfit / cfxGrossLoss : cfxGrossProfit;
  const cfxExpectancy = cfxTotal > 0 ? (cfxGrossProfit - cfxGrossLoss) / cfxTotal : 0;
  
  let cfxPeak = 0;
  let cfxCum = 0;
  let cfxMaxDD = 0;
  cfxSignals.sort((a, b) => {
    const dateA = new Date(a.Date.replace(' (GMT+7)', '').replace(' at ', ' '));
    const dateB = new Date(b.Date.replace(' (GMT+7)', '').replace(' at ', ' '));
    return dateA - dateB;
  }).forEach(s => {
    cfxCum += s.realizedR[exitModel] || 0;
    if (cfxCum > cfxPeak) cfxPeak = cfxCum;
    if (cfxPeak - cfxCum > cfxMaxDD) cfxMaxDD = cfxPeak - cfxCum;
  });

  const cfxStats = {
    total: cfxTotal,
    winRate: cfxWinRate,
    expectancy: cfxExpectancy,
    profitFactor: cfxProfitFactor,
    maxDD: cfxMaxDD
  };

  return {
    totalSignals: computedSignals.length,
    totalClosed,
    winRate,
    beRate,
    expectancy,
    profitFactor,
    maxDD,
    currentStreak,
    multiEquityCurve,
    sessionBreakdown: sessionArray,
    directionBreakdown: directionStats,
    outcomes: { TP: wins, SL: losses, BE: bes, Open: computedSignals.length - totalClosed },
    sortedSignals,
    rollingPerformance,
    cfxStats
  };
}
