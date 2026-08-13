const http = require('http');
const fs = require('fs');
const path = require('path');

// Generate a dummy audio file (small webm structure or simple buffer)
const dummyAudioPath = path.join(__dirname, 'dummy.webm');
const sampleBuffer = Buffer.from([
  0x1A, 0x45, 0xDF, 0xA3, 0x99, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81, 0x01, 0x42, 0xF2, 0x81,
  0x04, 0x42, 0xF3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D, 0x42, 0x87, 0x81, 0x02,
  0x42, 0x85, 0x81, 0x02
]);
fs.writeFileSync(dummyAudioPath, sampleBuffer);

async function runApiTest() {
  console.log('Testing voice API endpoint...');
  const FormData = require('module').createRequire(__filename)('multer');
  
  // Test analyze endpoint directly with a test conversation
  const fileUtils = require('../src/utils/fileUtils');
  const convId = 'conv_test_' + Date.now();
  const testConv = {
    conversationId: convId,
    patientId: 'PAT_TEST',
    createdAt: new Date().toISOString(),
    language: { detected: 'Hindi', languageCode: 'hi' },
    transcription: {
      original: 'mujhe do din se bukhar aur gale me dard hai',
      english: 'I have fever and sore throat for two days'
    },
    aiAnalysis: null
  };
  fileUtils.saveConversation(testConv);

  const reqObj = JSON.stringify({ patientId: 'PAT_TEST' });
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/voice/${convId}/analyze`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqObj)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Analyze Endpoint Response Status:', res.statusCode);
      console.log('Analyze Endpoint Response Body:', body);
    });
  });

  req.on('error', err => console.error('Request Error:', err));
  req.write(reqObj);
  req.end();
}

runApiTest();
