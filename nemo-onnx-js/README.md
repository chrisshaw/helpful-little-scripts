# NeMo ONNX JavaScript

Streaming speech-to-text using [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) with a Vue 3 frontend and Node.js WebSocket backend.

## Quick Start

### 1. Start the Server

```bash
cd server
npm install
npm run download-model  # Downloads ~600MB model (first time only)
npm start
```

Server runs at http://localhost:3000 with WebSocket at `ws://localhost:3000/ws`

### 2. Start the Web App

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 and:
1. Click **Connect** to connect to the server
2. Click **Start Recording**
3. Speak into your microphone
4. See real-time transcription

## Project Structure

```
nemo-onnx-js/
├── server/                 # Node.js WebSocket backend
│   ├── server.js          # Express + WebSocket server
│   ├── package.json
│   ├── download-model.sh  # Downloads Nemotron model
│   └── models/            # Model files (gitignored)
└── web/                   # Vue 3 frontend
    ├── src/App.vue        # Main component
    ├── package.json
    └── vite.config.js
```

## Model

Uses [Nemotron Speech Streaming](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b) (English, ~600MB) - a high-quality streaming ASR model from NVIDIA.

## Requirements

- Node.js 18+
- Microphone access in browser
