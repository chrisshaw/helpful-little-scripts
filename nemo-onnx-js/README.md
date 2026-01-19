# NeMo ONNX JavaScript

Speech-to-text transcription in Node.js using [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

Supports **streaming** (real-time) and **offline** (batch) transcription.

## Quick Start

```bash
npm install

# Download Nemotron streaming model (~600MB)
./download-model.sh nemotron

# Transcribe with real-time streaming
node transcribe-streaming.js your-audio.wav
```

## Requirements

- Node.js 16+
- WAV audio files (16kHz mono recommended)

## Available Models

### Streaming (Real-Time)

| Model | Command | Size | Notes |
|-------|---------|------|-------|
| **Nemotron 0.6B** | `./download-model.sh nemotron` | ~600MB | Best quality, recommended |
| Zipformer English | `./download-model.sh streaming-en` | ~70MB | Smaller, faster |
| Zipformer Small | `./download-model.sh streaming-en-small` | ~25MB | Smallest |

### Offline (Batch)

| Model | Command | Size |
|-------|---------|------|
| NeMo Conformer Small | `./download-model.sh small` | ~30MB |
| NeMo Conformer Medium | `./download-model.sh medium` | ~120MB |
| NeMo Conformer Large | `./download-model.sh large` | ~450MB |

## Usage

### Streaming Transcription

```bash
node transcribe-streaming.js recording.wav
node transcribe-streaming.js recording.wav --chunk 160
node transcribe-streaming.js recording.wav --model ./sherpa-onnx-streaming-zipformer-en-2023-02-21
```

### Offline Transcription

```bash
node transcribe.js recording.wav
node transcribe.js recording.wav --model ./sherpa-onnx-nemo-ctc-en-conformer-medium
```

### As a Module

```javascript
const { transcribeStreaming } = require('./transcribe-streaming');
const result = transcribeStreaming('audio.wav');
console.log(result.text);
```

## Audio Format

Models expect 16kHz mono WAV. Convert with ffmpeg:

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
```

## Credits

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
- [NVIDIA NeMo](https://github.com/NVIDIA/NeMo)
- [Nemotron Speech Streaming](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b)
