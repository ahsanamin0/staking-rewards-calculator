const express = require('express');
const router = express.Router();

const FREQ_MAP = { daily: 365, weekly: 52, monthly: 12, annually: 1 };
const MAX_POINTS = 400;   // chart ke liye zyada se zyada itne points
const MAX_YEARS = 100;

const round = (v, d = 4) => Number(v.toFixed(d));


/**
 * Compound interest: A = P * (1 + r / n) ^ (n * t)
 *
 * Every time series point uses the same formula, so non-integer
 * durations such as 1.5 years are handled exactly.
 * Returns either a result object or { error }.
 */
function computeStaking({ principal, apy, duration, durationUnit, frequency, tokenPrice }) {
  const P = Number(principal);
  const apyPct = Number(apy);
  const d = Number(duration);
  const unit = String(durationUnit || 'years').toLowerCase();
  const n = FREQ_MAP[String(frequency || 'monthly').toLowerCase()];

  if (!n) return { error: 'Invalid compounding frequency.' };
  if (!Number.isFinite(P) || P <= 0) return { error: 'Amount to stake must be greater than 0.' };
  if (!Number.isFinite(apyPct) || apyPct < 0) return { error: 'APY must be 0 or higher.' };
  if (!Number.isFinite(d) || d <= 0) return { error: 'Duration must be greater than 0.' };
  if (unit !== 'years' && unit !== 'days') return { error: 'Duration unit must be years or days.' };

  const t = unit === 'days' ? d / 365 : d;
  if (t > MAX_YEARS) return { error: `Duration cannot exceed ${MAX_YEARS} years.` };

  let price = null;
  if (tokenPrice !== undefined && tokenPrice !== null && tokenPrice !== '') {
    price = Number(tokenPrice);
    if (!Number.isFinite(price) || price < 0) return { error: 'Token price must be 0 or higher.' };
  }

  const r = apyPct / 100; // APY = 0 => (1 + 0)^x = 1, 
  const balanceAt = (years) => P * Math.pow(1 + r / n, n * years);

  // O(min(n*t, MAX_POINTS)) time aur space
  const steps = Math.min(Math.max(Math.ceil(n * t), 1), MAX_POINTS);
  const timeSeries = [];
  for (let i = 0; i <= steps; i++) {
    const x = (t * i) / steps;
    const bal = balanceAt(x);
    timeSeries.push({
      period: i,
      time: round(x, 3),          
      balance: round(bal, 2),
      rewards: round(bal - P, 2),
    });
  }

  const finalBalance = balanceAt(t);
  const totalRewards = finalBalance - P;

  const result = {
    principal: P,
    finalBalance: round(finalBalance, 2),
    totalRewards: round(totalRewards, 2),
    timeSeries,
  };

  if (price !== null) {
    result.finalBalanceUsd = round(finalBalance * price, 2);
    result.totalRewardsUsd = round(totalRewards * price, 2);
  }
  return result;
}

router.post('/', (req, res) => {
  try {
    const out = computeStaking(req.body || {});
    if (out.error) return res.status(400).json({ error: out.error });
    return res.json(out);
  } catch (error) {
    console.error('Calculator Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
module.exports.computeStaking = computeStaking;