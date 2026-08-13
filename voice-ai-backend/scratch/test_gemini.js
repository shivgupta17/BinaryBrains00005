require('dotenv').config();
const { transcribeAndTranslateAudio, analyzeClientProblem } = require('../src/services/geminiService');
const path = require('path');
const fs = require('fs');

async function test() {
  console.log('--- Testing analyzeClientProblem with gemini-flash-latest ---');
  try {
    const analysis = await analyzeClientProblem({
      original: 'mujhe do din se bukhar aur tez sirdard hai',
      english: 'I have fever and severe headache for two days'
    });
    console.log('Analysis Result:', JSON.stringify(analysis, null, 2));
  } catch (err) {
    console.error('Analysis Error:', err);
  }
}

test();
