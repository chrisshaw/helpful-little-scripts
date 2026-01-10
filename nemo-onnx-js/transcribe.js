#!/usr/bin/env node
/**
 * NeMo ONNX Speech-to-Text Transcription
 *
 * Uses sherpa-onnx to run NeMo CTC models for speech recognition.
 * Supports multiple NeMo model variants (conformer-small, conformer-medium, etc.)
 */

const fs = require('fs');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');

// Default model configuration
const DEFAULT_MODEL_DIR = './sherpa-onnx-nemo-ctc-en-conformer-small';

/**
 * Create an offline recognizer with the specified model
 * @param {string} modelDir - Directory containing the model files
 * @returns {object} - The recognizer instance
 */
function createRecognizer(modelDir) {
  const modelPath = path.join(modelDir, 'model.int8.onnx');
  const tokensPath = path.join(modelDir, 'tokens.txt');

  // Verify files exist
  if (!fs.existsSync(modelPath)) {
    console.error(`Model file not found: ${modelPath}`);
    console.error('Run: npm run download-model');
    process.exit(1);
  }

  if (!fs.existsSync(tokensPath)) {
    console.error(`Tokens file not found: ${tokensPath}`);
    process.exit(1);
  }

  const config = {
    modelConfig: {
      nemoCtc: {
        model: modelPath,
      },
      tokens: tokensPath,
      debug: false,
    },
  };

  return sherpa_onnx.createOfflineRecognizer(config);
}

/**
 * Transcribe an audio file
 * @param {string} audioPath - Path to the WAV file
 * @param {string} modelDir - Directory containing model files
 * @returns {string} - The transcribed text
 */
function transcribe(audioPath, modelDir = DEFAULT_MODEL_DIR) {
  // Verify audio file exists
  if (!fs.existsSync(audioPath)) {
    console.error(`Audio file not found: ${audioPath}`);
    process.exit(1);
  }

  console.log(`Loading model from: ${modelDir}`);
  const recognizer = createRecognizer(modelDir);

  console.log(`Transcribing: ${audioPath}`);
  const stream = recognizer.createStream();

  // Read the wave file
  const wave = sherpa_onnx.readWave(audioPath);
  console.log(`Audio: ${wave.sampleRate}Hz, ${(wave.samples.length / wave.sampleRate).toFixed(2)}s`);

  // Process the audio
  stream.acceptWaveform(wave.sampleRate, wave.samples);

  // Decode
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);

  // Cleanup
  stream.free();
  recognizer.free();

  return result.text;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
NeMo ONNX Speech-to-Text Transcription

Usage:
  node transcribe.js <audio.wav> [--model <model-dir>]

Arguments:
  audio.wav          Path to a WAV audio file (16kHz, mono recommended)
  --model <dir>      Model directory (default: ${DEFAULT_MODEL_DIR})

Examples:
  node transcribe.js recording.wav
  node transcribe.js speech.wav --model ./sherpa-onnx-nemo-ctc-en-conformer-medium

First, download a model:
  npm run download-model
`);
    process.exit(0);
  }

  // Parse arguments
  let audioPath = null;
  let modelDir = DEFAULT_MODEL_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      modelDir = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      audioPath = args[i];
    }
  }

  if (!audioPath) {
    console.error('Error: No audio file specified');
    process.exit(1);
  }

  // Run transcription
  const text = transcribe(audioPath, modelDir);

  console.log('\n--- Transcription ---');
  console.log(text);
  console.log('---------------------');
}

// Export for use as module
module.exports = { transcribe, createRecognizer };

// Run if called directly
if (require.main === module) {
  main();
}
