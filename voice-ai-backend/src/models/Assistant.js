const mongoose = require('mongoose');

const assistantSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  assistantId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  clinic: {
    type: String,
    default: 'Rajpur Primary Health Centre'
  },
  phone: {
    type: String,
    default: '+91 98765 43210'
  }
}, { timestamps: true });

module.exports = mongoose.models.Assistant || mongoose.model('Assistant', assistantSchema);
