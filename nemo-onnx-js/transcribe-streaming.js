#!/usr/bin/env node
/**
 * Streaming Speech-to-Text Transcription
 *
 * Uses sherpa-onnx streaming models for real-time speech recognition.
 * Supports transducer (zipformer) and paraformer architectures.
 */

const fs = require('fs');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');

// Default streaming model
const DEFAULT_MODEL_DIR = './sherpa-onnx-streaming-zipformer-en-2023-02-21';

/**
 * Detect model type from directory contents
 */
function detectModelType(modelDir) {
  // Check for transducer (has encoder, decoder, joiner)
  if (fs.existsSync(path.join(modelDir, 'encoder-epoch-99-avg-1.onnx')) ||
      fs.existsSync(path.join(modelDir, 'encoder-epoch-99-avg-1.int8.onnx'))) {
    return 'transducer';
  }
  // Check for paraformer
  if (fs.existsSync(path.join(modelDir, 'model.onnx')) ||
      fs.existsSync(path.join(modelDir, 'model.int8.onnx'))) {
    return 'paraformer';
  }
  return 'transducer'; // default
}

/**
 * Find model files in directory
 */
function findModelFiles(modelDir, pattern) {
  const files = fs.readdirSync(modelDir);
  const match = files.find(f => f.includes(pattern) && f.endsWith('.onnx'));
  return match ? path.join(modelDir, match) : null;
}

/**
 * Create streaming recognizer configuration
 */
function createConfig(modelDir) {
  const modelType = detectModelType(modelDir);
  const tokensPath = path.join(modelDir, 'tokens.txt');

  if (!fs.existsSync(tokensPath)) {
    throw new Error(`Tokens file not found: ${tokensPath}`);
  }

  const config = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      tokens: tokensPath,
      debug: false,
      numThreads: 2,
      provider: 'cpu',
    },
    decodingMethod: 'greedy_search',
    maxActivePaths: 4,
  };

  if (modelType === 'transducer') {
    // Find encoder, decoder, joiner files
    const encoder = findModelFiles(modelDir, 'encoder') ||
                    path.join(modelDir, 'encoder-epoch-99-avg-1.onnx');
    const decoder = findModelFiles(modelDir, 'decoder') ||
                    path.join(modelDir, 'decoder-epoch-99-avg-1.onnx');
    const joiner = findModelFiles(modelDir, 'joiner') ||
                   path.join(modelDir, 'joiner-epoch-99-avg-1.onnx');

    config.modelConfig.transducer = {
      encoder: encoder,
      decoder: decoder,
      joiner: joiner,
    };
  } else if (modelType === 'paraformer') {
    config.modelConfig.paraformer = {
      encoder: path.join(modelDir, 'encoder.onnx'),
      decoder: path.join(modelDir, 'decoder.onnx'),
    };
  }

  return config;
}

/**
 * Create a streaming recognizer
 */
function createRecognizer(modelDir) {
  const config = createConfig(modelDir);
  return sherpa_onnx.createOnlineRecognizer(config);
}

/**
 * Transcribe audio file with streaming (simulated real-time)
 * @param {string} audioPath - Path to WAV file
 * @param {string} modelDir - Model directory
 * @param {object} options - Options (chunkMs, showPartial)
 */
function transcribeStreaming(audioPath, modelDir = DEFAULT_MODEL_DIR, options = {}) {
  const { chunkMs = 100, showPartial = true } = options;

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  console.log(`Loading streaming model from: ${modelDir}`);
  const recognizer = createRecognizer(modelDir);
  const stream = recognizer.createStream();

  // Read wave file
  const wave = sherpa_onnx.readWave(audioPath);
  const sampleRate = wave.sampleRate;
  const samples = wave.samples;

  console.log(`Audio: ${sampleRate}Hz, ${(samples.length / sampleRate).toFixed(2)}s`);
  console.log(`Streaming with ${chunkMs}ms chunks...\n`);

  // Calculate chunk size
  const chunkSize = Math.floor(sampleRate * chunkMs / 1000);
  let offset = 0;
  let lastText = '';

  const startTime = Date.now();

  // Process in chunks (simulating real-time streaming)
  while (offset < samples.length) {
    const end = Math.min(offset + chunkSize, samples.length);
    const chunk = samples.slice(offset, end);

    // Feed chunk to recognizer
    stream.acceptWaveform(sampleRate, chunk);

    // Decode available frames
    while (recognizer.isReady(stream)) {
      recognizer.decode(stream);
    }

    // Get partial result
    const result = recognizer.getResult(stream);
    if (showPartial && result.text && result.text !== lastText) {
      process.stdout.write(`\r[Partial] ${result.text}`);
      lastText = result.text;
    }

    offset = end;
  }

  // Signal end of audio
  stream.inputFinished();

  // Final decode
  while (recognizer.isReady(stream)) {
    recognizer.decode(stream);
  }

  const finalResult = recognizer.getResult(stream);
  const elapsed = (Date.now() - startTime) / 1000;
  const audioDuration = samples.length / sampleRate;
  const rtf = elapsed / audioDuration;

  // Clear partial output line
  if (showPartial) {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  // Cleanup
  stream.free();
  recognizer.free();

  return {
    text: finalResult.text,
    duration: audioDuration,
    elapsed: elapsed,
    rtf: rtf,
  };
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Streaming Speech-to-Text Transcription

Usage:
  node transcribe-streaming.js <audio.wav> [options]

Options:
  --model <dir>      Model directory (default: ${DEFAULT_MODEL_DIR})
  --chunk <ms>       Chunk size in milliseconds (default: 100)
  --no-partial       Don't show partial results

Examples:
  node transcribe-streaming.js recording.wav
  node transcribe-streaming.js speech.wav --model ./sherpa-onnx-streaming-zipformer-en-20M-2023-02-17
  node transcribe-streaming.js speech.wav --chunk 200

First, download a streaming model:
  ./download-model.sh streaming-en
`);
    process.exit(0);
  }

  // Parse arguments
  let audioPath = null;
  let modelDir = DEFAULT_MODEL_DIR;
  let chunkMs = 100;
  let showPartial = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      modelDir = args[i + 1];
      i++;
    } else if (args[i] === '--chunk' && args[i + 1]) {
      chunkMs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--no-partial') {
      showPartial = false;
    } else if (!args[i].startsWith('-')) {
      audioPath = args[i];
    }
  }

  if (!audioPath) {
    console.error('Error: No audio file specified');
    process.exit(1);
  }

  try {
    const result = transcribeStreaming(audioPath, modelDir, { chunkMs, showPartial });

    console.log('--- Transcription ---');
    console.log(result.text);
    console.log('---------------------');
    console.log(`Duration: ${result.duration.toFixed(2)}s | Processed in: ${result.elapsed.toFixed(2)}s | RTF: ${result.rtf.toFixed(3)}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

// Export for module use
module.exports = { transcribeStreaming, createRecognizer };

if (require.main === module) {
  main();
}
