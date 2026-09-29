import React, { useState } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5025';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface Point {
  period: number;
  time: number;
  balance: number;
  rewards: number;
}
interface Result {
  principal: number;
  finalBalance: number;
  totalRewards: number;
  finalBalanceUsd?: number;
  totalRewardsUsd?: number;
  timeSeries: Point[];
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StakingWidget: React.FC = () => {
  const theme = useTheme();
  const [formData, setFormData] = useState({
    principal: '',
    apy: '',
    duration: '',
    durationUnit: 'years',
    frequency: 'monthly',
    tokenPrice: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string | null => {
    if (!(Number(formData.principal) > 0)) return 'Amount to stake must be greater than 0.';
    if (formData.apy === '' || Number(formData.apy) < 0) return 'APY must be 0 or higher.';
    if (!(Number(formData.duration) > 0)) return 'Duration must be greater than 0.';
    if (formData.tokenPrice !== '' && Number(formData.tokenPrice) < 0)
      return 'Token price cannot be negative.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setErrorMsg(problem);
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    // Timeout: request for snippet 
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_URL}/api/calculate-rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      let data: any = null;
      try {
        data = await response.json();
            } catch {
        throw new Error(`The server returned an invalid response (status ${response.status}).`);
      }

      if (!response.ok) throw new Error(data?.error || 'Failed to calculate.');

      setResult(data);
      setStatus('success');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setErrorMsg('Request timed out. Please check that the backend is running.');
      } else if (err.message === 'Failed to fetch') {
        setErrorMsg('Cannot reach the server. Make sure the backend is running and CORS is enabled.');
      } else {
        setErrorMsg(err.message);
      }
      setStatus('error');
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mt: 3, borderRadius: 2 }}>
      <Typography variant="h5" gutterBottom color="primary">
        Staking Rewards Calculator
      </Typography>

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
        {/* CSS Grid: mobile 1 column, tablet+ 2 columns */}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}
        >
          <TextField label="Amount to Stake" name="principal" type="number" required
            value={formData.principal} onChange={handleChange} inputProps={{ min: 0, step: 'any' }} />
          <TextField label="APY (%)" name="apy" type="number" required
            value={formData.apy} onChange={handleChange} inputProps={{ min: 0, step: 'any' }} />
          <TextField label="Duration" name="duration" type="number" required
            value={formData.duration} onChange={handleChange} inputProps={{ min: 0, step: 'any' }} />
          <TextField select label="Duration Unit" name="durationUnit"
            value={formData.durationUnit} onChange={handleChange}>
            <MenuItem value="years">Years</MenuItem>
            <MenuItem value="days">Days</MenuItem>
          </TextField>
          <TextField select label="Compounding Frequency" name="frequency"
            value={formData.frequency} onChange={handleChange}>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="annually">Annually</MenuItem>
          </TextField>
          <TextField label="Token Price in USD (optional)" name="tokenPrice" type="number"
            value={formData.tokenPrice} onChange={handleChange} inputProps={{ min: 0, step: 'any' }} />
          <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
            <Button type="submit" variant="contained" color="primary" fullWidth size="large"
              disabled={status === 'loading'}>
              {status === 'loading' ? <CircularProgress size={24} color="inherit" /> : 'Calculate Rewards'}
            </Button>
          </Box>
        </Box>
      </Box>

      {status === 'error' && (
        <Alert severity="error" sx={{ mt: 2 }}>{errorMsg}</Alert>
      )}

      {status === 'success' && result && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Final Balance: {fmt(result.finalBalance)}</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Total Rewards: {fmt(result.totalRewards)}
          </Typography>
          {result.finalBalanceUsd !== undefined && (
            <Typography variant="subtitle1" color="text.secondary">
              Final Balance (USD): ${fmt(result.finalBalanceUsd)} · Rewards (USD): ${fmt(result.totalRewardsUsd ?? 0)}
            </Typography>
          )}

          <Box sx={{ width: '100%', height: 300, mt: 3 }}>
            <ResponsiveContainer>
              <LineChart data={result.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="time" stroke={theme.palette.text.secondary}
                  label={{ value: 'Years', position: 'insideBottom', offset: -2 }} />
                <YAxis stroke={theme.palette.text.secondary} domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(v: any, name: any) => [fmt(Number(v)), name === 'balance' ? 'Balance' : name]}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Line type="monotone" dataKey="balance" stroke={theme.palette.primary.main}
                  strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default StakingWidget;
