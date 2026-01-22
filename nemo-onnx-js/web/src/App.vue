<script setup>
import { ref, onUnmounted } from 'vue'

const isRecording = ref(false)
const isConnected = ref(false)
const isConnecting = ref(false)
const transcript = ref('')
const partialTranscript = ref('')
const error = ref('')
const statusMessage = ref('Click "Connect" to start')

let audioContext = null
let mediaStream = null
let workletNode = null
let websocket = null

// WebSocket URL - uses proxy in development, direct in production
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:3000/ws`
  : `ws://${window.location.host}/ws`

function connect() {
  if (isConnected.value || isConnecting.value) return

  isConnecting.value = true
  error.value = ''
  statusMessage.value = 'Connecting to server...'

  websocket = new WebSocket(WS_URL)

  websocket.onopen = () => {
    console.log('WebSocket connected')
  }

  websocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)

      switch (msg.type) {
        case 'ready':
          isConnected.value = true
          isConnecting.value = false
          statusMessage.value = 'Connected. Click "Start Recording" to begin.'
          break

        case 'partial':
          partialTranscript.value = msg.text
          break

        case 'final':
          transcript.value += msg.text + ' '
          partialTranscript.value = ''
          break

        case 'error':
          error.value = `Server error: ${msg.message}`
          break
      }
    } catch (e) {
      console.error('Failed to parse message:', e)
    }
  }

  websocket.onerror = (e) => {
    console.error('WebSocket error:', e)
    error.value = 'Connection error. Is the server running?'
    isConnecting.value = false
  }

  websocket.onclose = () => {
    console.log('WebSocket closed')
    isConnected.value = false
    isConnecting.value = false
    if (isRecording.value) {
      stopRecording()
    }
    statusMessage.value = 'Disconnected. Click "Connect" to reconnect.'
  }
}

async function startRecording() {
  if (!isConnected.value) {
    error.value = 'Please connect to the server first'
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
      if (!websocket || websocket.readyState !== WebSocket.OPEN) return

      // Send audio samples as binary data
      const samples = event.data
      websocket.send(samples.buffer)
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
  // Tell server we're done
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ type: 'stop' }))
  }

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

function disconnect() {
  if (isRecording.value) {
    stopRecording()
  }
  if (websocket) {
    websocket.close()
    websocket = null
  }
  isConnected.value = false
  statusMessage.value = 'Disconnected. Click "Connect" to reconnect.'
}

onUnmounted(() => {
  stopRecording()
  disconnect()
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

      // Send chunks of 1600 samples (100ms at 16kHz)
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
    <p class="subtitle">Using Nemotron Speech Streaming model</p>

    <div class="status">{{ statusMessage }}</div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="controls">
      <button
        v-if="!isConnected"
        @click="connect"
        :disabled="isConnecting"
        class="btn primary"
      >
        {{ isConnecting ? 'Connecting...' : 'Connect' }}
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

        <button
          @click="disconnect"
          class="btn secondary"
          :disabled="isRecording"
        >
          Disconnect
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
