const { computeStaking } = require('./calculator');

const base = { principal: 1000, apy: 12, duration: 1, durationUnit: 'years', frequency: 'monthly' };

describe('computeStaking: correctness', () => {
  test('1000 @ 12% for 1 year, monthly', () => {
    const r = computeStaking(base);
    expect(r.finalBalance).toBeCloseTo(1126.83, 2);
    expect(r.totalRewards).toBeCloseTo(126.83, 2);
  });

  test('2000 @ 10% for 1 year, monthly', () => {
    expect(computeStaking({ ...base, principal: 2000, apy: 10 }).finalBalance).toBeCloseTo(2209.43, 2);
  });

  test('non-integer duration: 1.5 years, monthly', () => {
    expect(computeStaking({ ...base, duration: 1.5 }).finalBalance).toBeCloseTo(1196.15, 2);
  });

  test('non-integer duration with annual compounding uses a fractional exponent', () => {
    expect(computeStaking({ ...base, duration: 1.5, frequency: 'annually' }).finalBalance).toBeCloseTo(1185.3, 2);
  });

  test('more frequent compounding never gives a smaller balance', () => {
    const bal = (frequency) => computeStaking({ ...base, duration: 1.5, frequency }).finalBalance;
    expect(bal('annually')).toBeLessThan(bal('monthly'));
    expect(bal('monthly')).toBeLessThan(bal('weekly'));
    expect(bal('weekly')).toBeLessThan(bal('daily'));
  });

  test('duration in days: 365 days equals 1 year', () => {
    const days = computeStaking({ ...base, duration: 365, durationUnit: 'days' });
    expect(days.finalBalance).toBeCloseTo(computeStaking(base).finalBalance, 2);
  });

  test('frequency is case-insensitive', () => {
    expect(computeStaking({ ...base, frequency: 'MONTHLY' }).finalBalance).toBeCloseTo(1126.83, 2);
  });

  test('numeric strings are accepted (form values arrive as strings)', () => {
    const r = computeStaking({ ...base, principal: '1000', apy: '12', duration: '1' });
    expect(r.finalBalance).toBeCloseTo(1126.83, 2);
  });
});

describe('computeStaking: edge cases', () => {
  test('zero APY keeps the balance equal to the principal', () => {
    const r = computeStaking({ ...base, apy: 0 });
    expect(r.finalBalance).toBe(1000);
    expect(r.totalRewards).toBe(0);
  });

  test.each([
    ['zero principal', { principal: 0 }],
    ['negative principal', { principal: -5 }],
    ['non-numeric principal', { principal: 'abc' }],
    ['empty principal', { principal: '' }],
    ['negative APY', { apy: -1 }],
    ['non-numeric APY', { apy: 'abc' }],
    ['zero duration', { duration: 0 }],
    ['negative duration', { duration: -2 }],
    ['duration above the 100 year limit', { duration: 101 }],
    ['unknown frequency', { frequency: 'hourly' }],
    ['unknown duration unit', { durationUnit: 'weeks' }],
    ['negative token price', { tokenPrice: -1 }],
    ['non-numeric token price', { tokenPrice: 'abc' }],
  ])('rejects %s', (_label, override) => {
    const r = computeStaking({ ...base, ...override });
    expect(r.error).toEqual(expect.any(String));
    expect(r.timeSeries).toBeUndefined();
  });
});

describe('computeStaking: token price', () => {
  test('adds USD values when a price is given', () => {
    const r = computeStaking({ ...base, tokenPrice: 2 });
    expect(r.finalBalanceUsd).toBeCloseTo(r.finalBalance * 2, 1);
    expect(r.totalRewardsUsd).toBeCloseTo(r.totalRewards * 2, 1);
  });

  test('omits USD values when no price is given', () => {
    const r = computeStaking(base);
    expect(r.finalBalanceUsd).toBeUndefined();
    expect(r.totalRewardsUsd).toBeUndefined();
  });
});

describe('computeStaking: time series', () => {
  test('starts at the principal and ends at the final balance', () => {
    const r = computeStaking({ ...base, duration: 1.5 });
    const first = r.timeSeries[0];
    const last = r.timeSeries[r.timeSeries.length - 1];
    expect(first).toMatchObject({ time: 0, balance: 1000, rewards: 0 });
    expect(last.time).toBeCloseTo(1.5, 3);
    expect(last.balance).toBeCloseTo(r.finalBalance, 2);
  });

  test('has one point per compounding period plus the start (18 months = 19 points)', () => {
    expect(computeStaking({ ...base, duration: 1.5 }).timeSeries).toHaveLength(19);
  });

  test('balance never decreases over time', () => {
    const { timeSeries } = computeStaking({ ...base, duration: 3, frequency: 'weekly' });
    for (let i = 1; i < timeSeries.length; i++) {
      expect(timeSeries[i].balance).toBeGreaterThanOrEqual(timeSeries[i - 1].balance);
    }
  });

  test('is capped at 401 points for very long daily schedules', () => {
    const r = computeStaking({ ...base, duration: 50, frequency: 'daily' });
    expect(r.timeSeries).toHaveLength(401);
  });
});