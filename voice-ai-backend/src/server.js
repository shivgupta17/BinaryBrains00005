require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const voiceRoutes = require('./routes/voiceRoutes');
const patientRoutes = require('./routes/patientRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'voice-ai-backend',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here')
  });
});

// API Routes
app.use('/api/voice', voiceRoutes);
app.use('/api/patients', patientRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🎙️ Voice & Document AI Backend Server is Running!`);
  console.log(`👉 API Port:        http://localhost:${PORT}`);
  console.log(`👉 Health Check:    http://localhost:${PORT}/api/health`);
  console.log(`👉 Patient API:     http://localhost:${PORT}/api/patients`);
  console.log('======================================================\n');
});
