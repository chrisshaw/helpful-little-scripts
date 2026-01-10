# NeMo ONNX JavaScript

Speech-to-text transcription using NVIDIA NeMo models exported to ONNX, running in Node.js via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

## Quick Start

```bash
# Install dependencies
npm install

# Download a NeMo model (small ~30MB, medium ~120MB, large ~450MB)
./download-model.sh small

# Transcribe audio
node transcribe.js your-audio.wav
```

## Requirements

- Node.js 16+
- WAV audio files (16kHz mono recommended)

## Available Models

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `small` | ~30MB | Fastest | Good |
| `medium` | ~120MB | Balanced | Better |
| `large` | ~450MB | Slower | Best |
| `citrinet` | ~140MB | Fast | Good |

Download different models:
```bash
./download-model.sh medium
./download-model.sh large
./download-model.sh citrinet
```

## Usage

### Command Line

```bash
# Basic usage
node transcribe.js recording.wav

# Specify model directory
node transcribe.js recording.wav --model ./sherpa-onnx-nemo-ctc-en-conformer-medium
```

### As a Module

```javascript
const { transcribe } = require('./transcribe');

const text = transcribe('audio.wav', './sherpa-onnx-nemo-ctc-en-conformer-small');
console.log(text);
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

## How It Works

1. **sherpa-onnx** wraps ONNX Runtime with optimized C++ bindings
2. **NeMo CTC models** use Conformer architecture for speech recognition
3. Audio is processed through mel-spectrogram features
4. CTC decoder outputs text tokens mapped via `tokens.txt`

## Browser Support

For browser usage, consider [sherpa-onnx-wasm](https://www.npmjs.com/package/sherpa-onnx-wasm) which provides WebAssembly builds. Note that WASM version doesn't support threading.

## Credits

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) - Next-gen Kaldi with ONNX Runtime
- [NVIDIA NeMo](https://github.com/NVIDIA/NeMo) - Original model training framework
- Models from [k2-fsa releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)

## License

MIT
