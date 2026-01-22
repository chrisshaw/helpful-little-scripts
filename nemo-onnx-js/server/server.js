#!/usr/bin/env node
/**
 * Streaming Speech Recognition Server
 *
 * Express + WebSocket server that handles real-time audio streaming
 * from browser clients using sherpa-onnx-node for speech recognition.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const sherpa_onnx = require('sherpa-onnx-node');

// Configuration
const PORT = process.env.PORT || 3000;
const MODEL_DIR = path.join(__dirname, 'models', 'sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14');

/**
 * Find model file in directory matching pattern
 * Prefers .int8.onnx over .onnx for smaller size
 */
function findModelFile(modelDir, pattern) {
  const files = fs.readdirSync(modelDir);
  let match = files.find(f => f.includes(pattern) && f.endsWith('.int8.onnx'));
  if (!match) {
    match = files.find(f => f.includes(pattern) && f.endsWith('.onnx'));
  }
  return match ? path.join(modelDir, match) : null;
}

/**
 * Create the streaming recognizer
 */
function createRecognizer() {
  const tokensPath = path.join(MODEL_DIR, 'tokens.txt');

  if (!fs.existsSync(MODEL_DIR)) {
    throw new Error(`Model directory not found: ${MODEL_DIR}\nRun: ./download-model.sh`);
  }

  if (!fs.existsSync(tokensPath)) {
    throw new Error(`Tokens file not found: ${tokensPath}`);
  }

  const encoder = findModelFile(MODEL_DIR, 'encoder');
  const decoder = findModelFile(MODEL_DIR, 'decoder');
  const joiner = findModelFile(MODEL_DIR, 'joiner');

  if (!encoder || !decoder || !joiner) {
    throw new Error(`Missing model files in ${MODEL_DIR}. Need encoder, decoder, joiner .onnx files.`);
  }

  console.log('Loading model files:');
  console.log(`  Encoder: ${encoder}`);
  console.log(`  Decoder: ${decoder}`);
  console.log(`  Joiner: ${joiner}`);
  console.log(`  Tokens: ${tokensPath}`);

  const config = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      transducer: {
        encoder: encoder,
        decoder: decoder,
        joiner: joiner,
      },
      tokens: tokensPath,
      numThreads: 2,
      provider: 'cpu',
      debug: false,
    },
    decodingMethod: 'greedy_search',
    maxActivePaths: 4,
    enableEndpoint: true,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.2,
    rule3MinUtteranceLength: 20,
  };

  return new sherpa_onnx.OnlineRecognizer(config);
}

// Initialize Express app
const app = express();
const server = createServer(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_DIR });
});

// Initialize WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Load the recognizer once on startup
console.log('Loading speech recognition model...');
let recognizer;
try {
  recognizer = createRecognizer();
  console.log('Model loaded successfully!');
} catch (err) {
  console.error('Failed to load model:', err.message);
  process.exit(1);
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Create a new stream for this client
  const stream = recognizer.createStream();
  let segmentIndex = 0;
  let lastText = '';

  // Send ready message
  ws.send(JSON.stringify({ type: 'ready' }));

  ws.on('message', (data, isBinary) => {
    try {
      // Handle text messages (JSON commands)
      if (!isBinary) {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stop') {
          // Client stopped recording - finalize any remaining text
          stream.inputFinished();
          while (recognizer.isReady(stream)) {
            recognizer.decode(stream);
          }
          const result = recognizer.getResult(stream);
          if (result.text) {
            segmentIndex++;
            ws.send(JSON.stringify({
              type: 'final',
              text: result.text,
              segment: segmentIndex,
            }));
          }
          recognizer.reset(stream);
        }
        return;
      }

      // Handle binary audio data
      if (data instanceof Buffer) {
        // Copy buffer to ensure proper alignment for Float32Array
        const alignedBuffer = new ArrayBuffer(data.length);
        new Uint8Array(alignedBuffer).set(data);
        const floatArray = new Float32Array(alignedBuffer);

        // Feed samples to recognizer
        stream.acceptWaveform({ sampleRate: 16000, samples: floatArray });

        // Decode available frames
        while (recognizer.isReady(stream)) {
          recognizer.decode(stream);
        }

        // Get result
        const result = recognizer.getResult(stream);

        // Send partial result if text changed
        if (result.text && result.text !== lastText) {
          lastText = result.text;
          ws.send(JSON.stringify({
            type: 'partial',
            text: result.text,
          }));
        }

        // Check for endpoint (end of utterance)
        if (recognizer.isEndpoint(stream)) {
          if (result.text) {
            segmentIndex++;
            ws.send(JSON.stringify({
              type: 'final',
              text: result.text,
              segment: segmentIndex,
            }));
            lastText = '';
          }
          recognizer.reset(stream);
        }
        return;
      }
    } catch (err) {
      console.error('Error processing message:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message,
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    stream.free();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.clients.forEach((client) => client.close());
  server.close(() => {
    recognizer.free();
    process.exit(0);
  });
});
