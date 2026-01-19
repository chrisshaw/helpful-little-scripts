#!/bin/bash
#
# Download speech-to-text models for sherpa-onnx
#
# OFFLINE MODELS (batch transcription):
#   - small              NeMo Conformer small (~30MB)
#   - medium             NeMo Conformer medium (~120MB)
#   - large              NeMo Conformer large (~450MB)
#
# STREAMING MODELS (real-time transcription):
#   - nemotron           Nemotron Speech Streaming 0.6B int8 (~600MB) [RECOMMENDED]
#   - streaming-en       Zipformer English (~70MB)
#   - streaming-en-small Zipformer English 20M (~25MB)
#

set -e

MODEL_ID="${1:-nemotron}"
BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

case "$MODEL_ID" in
  # Streaming models
  nemotron|streaming)
    MODEL_NAME="sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14"
    MODEL_TYPE="streaming"
    ;;
  streaming-en)
    MODEL_NAME="sherpa-onnx-streaming-zipformer-en-2023-02-21"
    MODEL_TYPE="streaming"
    ;;
  streaming-en-small)
    MODEL_NAME="sherpa-onnx-streaming-zipformer-en-20M-2023-02-17"
    MODEL_TYPE="streaming"
    ;;

  # Offline NeMo CTC models
  small)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-small"
    MODEL_TYPE="offline"
    ;;
  medium)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-medium"
    MODEL_TYPE="offline"
    ;;
  large)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-large"
    MODEL_TYPE="offline"
    ;;

  # Help
  -h|--help|help)
    echo "Download speech-to-text models for sherpa-onnx"
    echo ""
    echo "Usage: ./download-model.sh <model-id>"
    echo ""
    echo "STREAMING MODELS (real-time transcription):"
    echo "  nemotron           Nemotron Speech Streaming 0.6B int8 (~600MB) [RECOMMENDED]"
    echo "  streaming-en       Zipformer English (~70MB)"
    echo "  streaming-en-small Zipformer English 20M (~25MB)"
    echo ""
    echo "OFFLINE MODELS (batch transcription):"
    echo "  small              NeMo Conformer small (~30MB)"
    echo "  medium             NeMo Conformer medium (~120MB)"
    echo "  large              NeMo Conformer large (~450MB)"
    echo ""
    echo "Examples:"
    echo "  ./download-model.sh nemotron        # Nemotron streaming (best)"
    echo "  ./download-model.sh streaming-en    # Zipformer streaming (smaller)"
    echo "  ./download-model.sh small           # Offline batch transcription"
    exit 0
    ;;

  *)
    echo "Unknown model: $MODEL_ID"
    echo "Run './download-model.sh --help' for available models"
    exit 1
    ;;
esac

DOWNLOAD_URL="${BASE_URL}/${MODEL_NAME}.tar.bz2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Downloading $MODEL_TYPE model: $MODEL_NAME"
echo "URL: $DOWNLOAD_URL"
echo ""

# Check if already exists
if [ -d "$MODEL_NAME" ]; then
  echo "Model already exists: $MODEL_NAME"
  echo "Remove the directory to re-download."
  exit 0
fi

# Download
echo "Downloading..."
curl -L -O "$DOWNLOAD_URL"

# Extract
echo "Extracting..."
tar -xjf "${MODEL_NAME}.tar.bz2"

# Cleanup archive
rm -f "${MODEL_NAME}.tar.bz2"

echo ""
echo "Model downloaded to: $MODEL_NAME"
echo ""
echo "Contents:"
ls -la "$MODEL_NAME"

echo ""
if [ "$MODEL_TYPE" = "streaming" ]; then
  echo "Test with:"
  echo "  node transcribe-streaming.js <your-audio.wav> --model ./$MODEL_NAME"
else
  echo "Test with:"
  echo "  node transcribe.js <your-audio.wav> --model ./$MODEL_NAME"
fi
