#!/bin/bash
#
# Download speech-to-text models for sherpa-onnx
#
# OFFLINE MODELS (NeMo CTC - for batch transcription):
#   - small              NeMo Conformer small (~30MB)
#   - medium             NeMo Conformer medium (~120MB)
#   - large              NeMo Conformer large (~450MB)
#   - citrinet           NeMo Citrinet-512 (~140MB)
#
# STREAMING MODELS (for real-time transcription):
#   - streaming-en       Zipformer English (~70MB)
#   - streaming-en-small Zipformer English 20M (~25MB)
#   - streaming-bilingual Zipformer Chinese+English (~70MB)
#   - streaming-paraformer Paraformer Chinese+English (~220MB)
#

set -e

MODEL_ID="${1:-small}"
BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

case "$MODEL_ID" in
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
  citrinet)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-citrinet-512"
    MODEL_TYPE="offline"
    ;;

  # Streaming models
  streaming-en|streaming)
    MODEL_NAME="sherpa-onnx-streaming-zipformer-en-2023-02-21"
    MODEL_TYPE="streaming"
    ;;
  streaming-en-small)
    MODEL_NAME="sherpa-onnx-streaming-zipformer-en-20M-2023-02-17"
    MODEL_TYPE="streaming"
    ;;
  streaming-bilingual)
    MODEL_NAME="sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20"
    MODEL_TYPE="streaming"
    ;;
  streaming-paraformer)
    MODEL_NAME="sherpa-onnx-streaming-paraformer-bilingual-zh-en"
    MODEL_TYPE="streaming"
    ;;

  # Help
  -h|--help|help)
    echo "Download speech-to-text models for sherpa-onnx"
    echo ""
    echo "Usage: ./download-model.sh <model-id>"
    echo ""
    echo "OFFLINE MODELS (batch transcription):"
    echo "  small              NeMo Conformer small (~30MB)"
    echo "  medium             NeMo Conformer medium (~120MB)"
    echo "  large              NeMo Conformer large (~450MB)"
    echo "  citrinet           NeMo Citrinet-512 (~140MB)"
    echo ""
    echo "STREAMING MODELS (real-time transcription):"
    echo "  streaming-en       Zipformer English (~70MB) [default streaming]"
    echo "  streaming-en-small Zipformer English 20M (~25MB)"
    echo "  streaming-bilingual Zipformer Chinese+English (~70MB)"
    echo "  streaming-paraformer Paraformer Chinese+English (~220MB)"
    echo ""
    echo "Examples:"
    echo "  ./download-model.sh small           # For transcribe.js"
    echo "  ./download-model.sh streaming-en    # For transcribe-streaming.js"
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
