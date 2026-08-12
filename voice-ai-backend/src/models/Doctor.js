const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  doctorId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  specialty: {
    type: String,
    default: 'General Medicine'
  },
  hospital: {
    type: String,
    default: 'GramCare Central Clinic'
  },
  onlineStatus: {
    type: String,
    enum: ['ONLINE', 'OFFLINE', 'BUSY'],
    default: 'ONLINE'
  }
}, { timestamps: true });

module.exports = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
