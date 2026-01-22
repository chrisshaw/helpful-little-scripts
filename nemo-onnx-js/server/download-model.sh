#!/bin/bash
#
# Download Nemotron Speech Streaming model for sherpa-onnx
#

set -e

BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"
MODEL_NAME="sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/models"

mkdir -p "$MODEL_DIR"
cd "$MODEL_DIR"

if [ -d "$MODEL_NAME" ]; then
  echo "Model already exists: $MODEL_DIR/$MODEL_NAME"
  exit 0
fi

echo "Downloading Nemotron Speech Streaming model (~600MB)..."
curl -L -O "${BASE_URL}/${MODEL_NAME}.tar.bz2"

echo "Extracting..."
tar -xjf "${MODEL_NAME}.tar.bz2"
rm -f "${MODEL_NAME}.tar.bz2"

echo ""
echo "Done. Start the server with:"
echo "  npm start"
