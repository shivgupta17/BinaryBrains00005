require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, getDbStatus } = require('./config/db');
const voiceRoutes = require('./routes/voiceRoutes');
const patientRoutes = require('./routes/patientRoutes');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const referralRoutes = require('./routes/referralRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const patientDashboardRoutes = require('./routes/patientDashboardRoutes');
const schedulerService = require('./services/schedulerService');

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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDbStatus();
  res.status(200).json({
    status: 'ok',
    service: 'voice-ai-backend',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here')
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/patient', patientDashboardRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Connect to MongoDB Atlas & Start Server
async function startServer() {
  await connectDB();
  schedulerService.initScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('======================================================');
    console.log(`🎙️ Voice & Document AI Backend Server is Running!`);
    console.log(`👉 API Port:        http://localhost:${PORT}`);
    console.log(`👉 Health Check:    http://localhost:${PORT}/api/health`);
    console.log(`👉 Patient API:     http://localhost:${PORT}/api/patients`);
    console.log(`👉 Patient Portal:  http://localhost:${PORT}/api/patient/dashboard-data`);
    console.log(`👉 Cases API:       http://localhost:${PORT}/api/cases`);
    console.log(`👉 Referrals API:   http://localhost:${PORT}/api/referrals`);
    console.log(`👉 Doctors API:     http://localhost:${PORT}/api/doctors`);
    console.log('======================================================\n');
  });
}

startServer();
