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
| **FastConformer Hybrid Streaming** | Cache-aware Transducer | **Yes** | True streaming with multiple latencies |

*Parakeet TDT is a transducer model but is NOT designed for cache-aware streaming. It processes complete utterances.

### Exporting NeMo Streaming Models

To use NeMo's cache-aware streaming models (FastConformer Hybrid), you need to export them yourself:

```bash
# Install NeMo
pip install 'nemo_toolkit[asr]' onnx onnxruntime

# Export a streaming model
python export-nemo-streaming.py --model stt_en_fastconformer_hybrid_large_streaming_multi

# Available streaming models:
# - stt_en_fastconformer_hybrid_large_streaming_multi (multiple latencies)
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_80ms (lowest latency)
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_480ms
# - nvidia/stt_en_fastconformer_hybrid_large_streaming_1040ms
```

For full transducer export (encoder/decoder/joiner), use the [sherpa-onnx export scripts](https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/nemo/fast-conformer-hybrid-transducer-ctc).

## Browser Support

For browser usage, consider [sherpa-onnx-wasm](https://www.npmjs.com/package/sherpa-onnx-wasm) which provides WebAssembly builds.

## Credits

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) - Next-gen Kaldi with ONNX Runtime
- [NVIDIA NeMo](https://github.com/NVIDIA/NeMo) - Original model training framework
- Models from [k2-fsa releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)

## License

MIT
