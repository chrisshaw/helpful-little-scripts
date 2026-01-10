#!/usr/bin/env node
/**
 * Example: Basic transcription usage
 *
 * This demonstrates the simplest usage of NeMo ONNX transcription.
 * First run: ./download-model.sh small
 */

const { transcribe } = require('./transcribe');

// Example with a test file (you'll need to provide your own audio)
const audioFile = process.argv[2] || './sherpa-onnx-nemo-ctc-en-conformer-small/test_wavs/0.wav';
const modelDir = './sherpa-onnx-nemo-ctc-en-conformer-small';

try {
  console.log('Starting transcription...\n');

  const text = transcribe(audioFile, modelDir);

  console.log('Result:', text);
} catch (err) {
  console.error('Error:', err.message);
  console.error('\nMake sure to:');
  console.error('  1. Run: npm install');
  console.error('  2. Run: ./download-model.sh small');
  console.error('  3. Provide a valid WAV file');
}
