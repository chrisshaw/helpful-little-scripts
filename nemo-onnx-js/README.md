# NeMo ONNX JavaScript

Speech-to-text transcription using NVIDIA NeMo and other models exported to ONNX, running in Node.js via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

Supports both **offline** (batch) and **streaming** (real-time) transcription.

## Quick Start

```bash
# Install dependencies
npm install

# For offline transcription (NeMo models)
./download-model.sh small
node transcribe.js your-audio.wav

# For streaming/real-time transcription
./download-model.sh streaming-en
node transcribe-streaming.js your-audio.wav
```

## Requirements

- Node.js 16+
- WAV audio files (16kHz mono recommended)

## Available Models

### Offline Models (Batch Transcription)

Best for processing complete audio files. Uses NeMo CTC Conformer architecture.

| Model | Command | Size | Notes |
|-------|---------|------|-------|
| Conformer Small | `./download-model.sh small` | ~30MB | Fastest |
| Conformer Medium | `./download-model.sh medium` | ~120MB | Balanced |
| Conformer Large | `./download-model.sh large` | ~450MB | Most accurate |
| Citrinet-512 | `./download-model.sh citrinet` | ~140MB | Efficient |

### Streaming Models (Real-Time Transcription)

Best for real-time audio processing. Shows partial results as audio streams in.

| Model | Command | Size | Notes |
|-------|---------|------|-------|
| Zipformer English | `./download-model.sh streaming-en` | ~70MB | Recommended |
| Zipformer English (small) | `./download-model.sh streaming-en-small` | ~25MB | Fastest |
| Zipformer Bilingual | `./download-model.sh streaming-bilingual` | ~70MB | Chinese + English |
| Paraformer Bilingual | `./download-model.sh streaming-paraformer` | ~220MB | Chinese + English |

## Usage

### Offline Transcription

Process complete audio files:

```bash
# Basic usage
node transcribe.js recording.wav

# Specify model
node transcribe.js recording.wav --model ./sherpa-onnx-nemo-ctc-en-conformer-medium
```

### Streaming Transcription

Real-time processing with partial results:

```bash
# Basic usage (shows partial results as it processes)
node transcribe-streaming.js recording.wav

# Specify model and chunk size
node transcribe-streaming.js recording.wav --model ./sherpa-onnx-streaming-zipformer-en-2023-02-21 --chunk 100

# Hide partial results
node transcribe-streaming.js recording.wav --no-partial
```

### As a Module

```javascript
// Offline
const { transcribe } = require('./transcribe');
const text = transcribe('audio.wav', './sherpa-onnx-nemo-ctc-en-conformer-small');

// Streaming
const { transcribeStreaming } = require('./transcribe-streaming');
const result = transcribeStreaming('audio.wav', './sherpa-onnx-streaming-zipformer-en-2023-02-21', {
  chunkMs: 100,
  showPartial: true
});
console.log(result.text);
console.log(`RTF: ${result.rtf}`); // Real-time factor
```

## Audio Format

The models expect:
- **Format**: WAV
- **Sample Rate**: 16kHz (will be resampled if different)
- **Channels**: Mono

Convert audio with ffmpeg:
```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
```

## Streaming vs Offline

| Feature | Offline | Streaming |
|---------|---------|-----------|
| Use case | Batch processing | Real-time audio |
| Partial results | No | Yes |
| Latency | Higher | Lower |
| Accuracy | Higher | Good |
| Models | NeMo CTC | Zipformer, Paraformer |

## How It Works

1. **sherpa-onnx** wraps ONNX Runtime with optimized C++ bindings
2. **Offline models** use CTC decoding for complete utterances
3. **Streaming models** use transducer architecture for incremental decoding
4. Audio is processed through mel-spectrogram features

## NeMo Model Types Explained

NeMo offers several ASR architectures with different streaming capabilities:

| Model | Architecture | Streaming | Notes |
|-------|-------------|-----------|-------|
| **Conformer CTC** | CTC | No | Offline only, good accuracy |
| **Parakeet TDT** | Transducer (TDT) | No* | Offline transducer, highest accuracy |
| **Nemotron Speech Streaming** | Cache-aware FastConformer + RNN-T | **Yes** | Best for voice agents (Jan 2026) |
| **FastConformer Hybrid Streaming** | Cache-aware Transducer | **Yes** | Multiple latency options |

*Parakeet TDT is a transducer model but is NOT designed for cache-aware streaming. It processes complete utterances.

### Nemotron Speech Streaming (Recommended)

[nvidia/nemotron-speech-streaming-en-0.6b](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b) is NVIDIA's latest streaming model (January 2026), designed specifically for low-latency voice applications:

- **0.6B parameters** with cache-aware FastConformer encoder + RNN-T decoder
- **Configurable chunk sizes**: 80ms, 160ms, 560ms, 1120ms
- **Native punctuation & capitalization** - no post-processing needed
- **<8% WER** across benchmarks (AMI, Earnings22, GigaSpeech, LibriSpeech)
- **3x higher throughput** vs buffered streaming on H100

### Exporting NeMo Streaming Models

To use NeMo's cache-aware streaming models, export them to ONNX:

```bash
# Install NeMo
pip install 'nemo_toolkit[asr]' onnx onnxruntime

# Export Nemotron Speech Streaming (recommended)
python export-nemo-streaming.py --model nvidia/nemotron-speech-streaming-en-0.6b

# Or export FastConformer Hybrid Streaming
python export-nemo-streaming.py --model stt_en_fastconformer_hybrid_large_streaming_multi

# Available models:
# - nvidia/nemotron-speech-streaming-en-0.6b (RECOMMENDED - lowest latency, best quality)
# - stt_en_fastconformer_hybrid_large_streaming_multi (multiple latencies)
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_80ms
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_480ms
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_1040ms
```

For full transducer export (encoder/decoder/joiner), use the [sherpa-onnx export scripts](https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/nemo/fast-conformer-hybrid-transducer-ctc).

### Nemotron Speech Streaming - JavaScript Status

**Current Support:**

| Runtime | Nemotron Streaming | Notes |
|---------|-------------------|-------|
| sherpa-onnx | Not yet | No explicit support as of Jan 2026 |
| onnx-asr (Python) | No | Batch only, no streaming |
| Pipecat | Yes | Uses NeMo/PyTorch via WebSocket |
| Direct ONNX Runtime | Planned | See `nemotron-streaming-onnx.js` |

**Options for Nemotron in JavaScript:**

1. **Use FastConformer Hybrid Streaming** (works now with sherpa-onnx):
   ```bash
   ./download-model.sh streaming-en
   node transcribe-streaming.js audio.wav
   ```

2. **WebSocket to Python backend** (recommended for production):
   - Deploy NeMo model via [Pipecat](https://github.com/pipecat-ai/nemotron-january-2026)
   - Connect from Node.js via WebSocket

3. **Direct ONNX Runtime** (experimental):
   - See `nemotron-streaming-onnx.js` for implementation plan
   - Requires: mel spectrogram extraction, cache management, RNN-T decoder
   - Estimated: ~550 lines of JavaScript

## Browser Support

For browser usage, consider [sherpa-onnx-wasm](https://www.npmjs.com/package/sherpa-onnx-wasm) which provides WebAssembly builds.

## Credits

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) - Next-gen Kaldi with ONNX Runtime
- [NVIDIA NeMo](https://github.com/NVIDIA/NeMo) - Original model training framework
- Models from [k2-fsa releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)

## License

MIT
