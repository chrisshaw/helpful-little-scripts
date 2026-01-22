<script setup>
import { ref, onUnmounted } from 'vue'

const isRecording = ref(false)
const isModelLoaded = ref(false)
const isLoading = ref(false)
const transcript = ref('')
const partialTranscript = ref('')
const error = ref('')
const statusMessage = ref('Click "Load Model" to start')

let audioContext = null
let mediaStream = null
let workletNode = null
let recognizer = null
let recognizerStream = null

const MODEL_BASE = 'https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/resolve/main/'
const SHERPA_WASM_BASE = 'https://cdn.jsdelivr.net/npm/sherpa-onnx-wasm@1.10.30/dist/'

async function loadSherpaOnnx() {
  if (window.sherpa_onnx) return window.sherpa_onnx

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SHERPA_WASM_BASE + 'sherpa-onnx-wasm-main.js'
    script.onload = async () => {
      try {
        const sherpa = await window.createSherpaOnnx({
          locateFile: (path) => SHERPA_WASM_BASE + path,
        })
        window.sherpa_onnx = sherpa
        resolve(sherpa)
      } catch (e) {
        reject(e)
      }
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function fetchAsUint8Array(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function loadModel() {
  if (isModelLoaded.value) return

  isLoading.value = true
  error.value = ''

  try {
    statusMessage.value = 'Loading sherpa-onnx WASM...'
    const sherpa = await loadSherpaOnnx()

    statusMessage.value = 'Downloading model files (this may take a minute)...'

    const [encoder, decoder, joiner, tokens] = await Promise.all([
      fetchAsUint8Array(MODEL_BASE + 'encoder-epoch-99-avg-1.int8.onnx'),
      fetchAsUint8Array(MODEL_BASE + 'decoder-epoch-99-avg-1.onnx'),
      fetchAsUint8Array(MODEL_BASE + 'joiner-epoch-99-avg-1.int8.onnx'),
      fetchAsUint8Array(MODEL_BASE + 'tokens.txt'),
    ])

    statusMessage.value = 'Initializing recognizer...'

    sherpa.FS.writeFile('/encoder.onnx', encoder)
    sherpa.FS.writeFile('/decoder.onnx', decoder)
    sherpa.FS.writeFile('/joiner.onnx', joiner)
    sherpa.FS.writeFile('/tokens.txt', tokens)

    const config = {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: '/encoder.onnx',
          decoder: '/decoder.onnx',
          joiner: '/joiner.onnx',
        },
        tokens: '/tokens.txt',
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
    }

    recognizer = sherpa.createOnlineRecognizer(config)
    recognizerStream = recognizer.createStream()

    isModelLoaded.value = true
    statusMessage.value = 'Model loaded. Click "Start Recording" to begin.'
  } catch (e) {
    error.value = `Failed to load model: ${e.message}`
    statusMessage.value = 'Error loading model'
  } finally {
    isLoading.value = false
  }
}

async function startRecording() {
  if (!isModelLoaded.value) {
    error.value = 'Please load the model first'
    return
  }

  error.value = ''

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    audioContext = new AudioContext({ sampleRate: 16000 })

    await audioContext.audioWorklet.addModule(
      URL.createObjectURL(
        new Blob([audioWorkletCode], { type: 'application/javascript' })
      )
    )

    const source = audioContext.createMediaStreamSource(mediaStream)
    workletNode = new AudioWorkletNode(audioContext, 'audio-processor')

    workletNode.port.onmessage = (event) => {
      if (!recognizer || !recognizerStream) return

      const samples = event.data
      recognizerStream.acceptWaveform(16000, samples)

      while (recognizer.isReady(recognizerStream)) {
        recognizer.decode(recognizerStream)
      }

      const result = recognizer.getResult(recognizerStream)
      if (result.text) {
        partialTranscript.value = result.text
      }

      if (recognizer.isEndpoint(recognizerStream)) {
        if (result.text) {
          transcript.value += result.text + ' '
          partialTranscript.value = ''
        }
        recognizer.reset(recognizerStream)
      }
    }

    source.connect(workletNode)
    workletNode.connect(audioContext.destination)

    isRecording.value = true
    statusMessage.value = 'Recording... Speak into your microphone'
  } catch (e) {
    error.value = `Microphone error: ${e.message}`
  }
}

function stopRecording() {
  if (workletNode) {
    workletNode.disconnect()
    workletNode = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }

  if (partialTranscript.value) {
    transcript.value += partialTranscript.value + ' '
    partialTranscript.value = ''
  }

  isRecording.value = false
  statusMessage.value = 'Stopped. Click "Start Recording" to continue.'
}

function clearTranscript() {
  transcript.value = ''
  partialTranscript.value = ''
}

onUnmounted(() => {
  stopRecording()
  if (recognizerStream) {
    recognizerStream.free()
  }
  if (recognizer) {
    recognizer.free()
  }
})

const audioWorkletCode = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
  }

  process(inputs) {
    const input = inputs[0]
    if (input.length > 0) {
      const samples = input[0]
      this.buffer.push(...samples)

      if (this.buffer.length >= 1600) {
        this.port.postMessage(new Float32Array(this.buffer))
        this.buffer = []
      }
    }
    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)
`
</script>

<template>
  <div class="container">
    <h1>Streaming Speech Recognition</h1>
    <p class="subtitle">Using sherpa-onnx with Zipformer model</p>

    <div class="status">{{ statusMessage }}</div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="controls">
      <button
        v-if="!isModelLoaded"
        @click="loadModel"
        :disabled="isLoading"
        class="btn primary"
      >
        {{ isLoading ? 'Loading...' : 'Load Model' }}
      </button>

      <template v-else>
        <button
          v-if="!isRecording"
          @click="startRecording"
          class="btn primary"
        >
          Start Recording
        </button>
        <button
          v-else
          @click="stopRecording"
          class="btn danger"
        >
          Stop Recording
        </button>
      </template>

      <button
        @click="clearTranscript"
        class="btn secondary"
        :disabled="!transcript && !partialTranscript"
      >
        Clear
      </button>
    </div>

    <div class="transcript-container">
      <div class="label">Transcript:</div>
      <div class="transcript">
        <span>{{ transcript }}</span>
        <span class="partial">{{ partialTranscript }}</span>
        <span v-if="isRecording" class="cursor">|</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.subtitle {
  color: #888;
  margin-top: -0.5rem;
}

.status {
  padding: 0.75rem 1rem;
  background: #2a2a2a;
  border-radius: 6px;
  color: #aaa;
}

.error {
  padding: 0.75rem 1rem;
  background: #3a1a1a;
  border: 1px solid #ff4444;
  border-radius: 6px;
  color: #ff6666;
}

.controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: #4a9eff;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #3a8eef;
}

.btn.danger {
  background: #ff4a4a;
  color: white;
}

.btn.danger:hover:not(:disabled) {
  background: #ef3a3a;
}

.btn.secondary {
  background: #444;
  color: white;
}

.btn.secondary:hover:not(:disabled) {
  background: #555;
}

.transcript-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-weight: 500;
  color: #888;
}

.transcript {
  min-height: 200px;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 6px;
  line-height: 1.6;
  font-size: 1.1rem;
}

.partial {
  color: #888;
}

.cursor {
  animation: blink 1s infinite;
  color: #4a9eff;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
