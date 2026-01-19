# NeMo ONNX JavaScript

Streaming speech-to-text using [Nemotron Speech Streaming](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b) via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

## Usage

```bash
npm install
./download-model.sh
node transcribe.js audio.wav
```

## Requirements

- Node.js 16+
- WAV audio (16kHz mono recommended)

Convert with ffmpeg: `ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav`
