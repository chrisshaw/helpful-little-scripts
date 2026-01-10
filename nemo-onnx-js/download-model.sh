#!/bin/bash
#
# Download NeMo ONNX models for speech-to-text
#
# Available models:
#   - conformer-small  (fastest, ~30MB)
#   - conformer-medium (balanced, ~120MB)
#   - conformer-large  (most accurate, ~450MB)
#   - citrinet-512     (efficient, ~140MB)
#

set -e

MODEL_SIZE="${1:-small}"
BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

case "$MODEL_SIZE" in
  small)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-small"
    ;;
  medium)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-medium"
    ;;
  large)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-conformer-large"
    ;;
  citrinet)
    MODEL_NAME="sherpa-onnx-nemo-ctc-en-citrinet-512"
    ;;
  *)
    echo "Unknown model size: $MODEL_SIZE"
    echo "Available: small, medium, large, citrinet"
    exit 1
    ;;
esac

DOWNLOAD_URL="${BASE_URL}/${MODEL_NAME}.tar.bz2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Downloading NeMo CTC model: $MODEL_NAME"
echo "URL: $DOWNLOAD_URL"
echo ""

# Download if not exists
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

# Cleanup
rm -f "${MODEL_NAME}.tar.bz2"

echo ""
echo "Model downloaded to: $MODEL_NAME"
echo ""
echo "Contents:"
ls -la "$MODEL_NAME"

echo ""
echo "Test with:"
echo "  node transcribe.js <your-audio.wav> --model ./$MODEL_NAME"
