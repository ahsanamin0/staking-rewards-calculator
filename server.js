const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Connect Database
// connectDB();

// CORS: the frontend (localhost:3000) runs on a different port than the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204); // preflight
  next();
});

// Init Middleware
app.use(express.json());

// Template routes are commented out because this project does not use them.
// Define Routes
// app.use('/api/users', require('./server/routes/api/users'));
// app.use('/api/auth', require('./server/routes/api/auth'));
// app.use('/api/profile', require('./server/routes/api/profile'));
// app.use('/api/posts', require('./server/routes/api/posts'));

// Staking rewards calculator (calculator.js lives next to this file)
app.use('/api/calculate-rewards', require('./calculator'));

 
// Serve static assets in production
// (API routes are registered above so the '*' catch-all does not swallow them)
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5025;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));