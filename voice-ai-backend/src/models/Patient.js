const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    sparse: true
  },
  patientId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number
  },
  sex: {
    type: String
  },
  village: {
    type: String
  },
  phone: {
    type: String
  },
  allergies: [String],
  history: [String],
  medications: [String],
  vitals: {
    temp: { type: String, default: 'Not recorded' },
    bp: { type: String, default: 'Not recorded' },
    pulse: { type: String, default: 'Not recorded' },
    spo2: { type: String, default: 'Not recorded' }
  }
}, { timestamps: true });

module.exports = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
