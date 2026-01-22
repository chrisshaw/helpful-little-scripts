# NeMo ONNX JavaScript

Streaming speech-to-text using [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).

## Web App (Browser)

A minimal Vue 3 web app with real-time microphone transcription.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 and:
1. Click "Load Model" (downloads ~100MB on first load)
2. Click "Start Recording"
3. Speak into your microphone

The app uses sherpa-onnx-wasm with a Zipformer streaming model.

## CLI Tool (Node.js)

Transcribe audio files using sherpa-onnx with Nemotron Speech Streaming.

```bash
npm install
./download-model.sh
node transcribe.js audio.wav
```

### Requirements

- Node.js 18+
- WAV audio (16kHz mono recommended)

Convert with ffmpeg: `ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav`

## Models

- **Web**: Uses [Zipformer Bilingual](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20) (Chinese/English)
- **CLI**: Uses [Nemotron Speech Streaming](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b) (English)

Both models support streaming (real-time) transcription.
