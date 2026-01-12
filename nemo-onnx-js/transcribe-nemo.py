#!/usr/bin/env python3
"""
Nemotron Speech Streaming - Simple Python Inference

This is the simplest way to use Nemotron Speech Streaming.
Just use NeMo directly - no ONNX conversion needed.

Requirements:
  pip install 'nemo_toolkit[asr]'

Usage:
  python transcribe-nemo.py audio.wav
  python transcribe-nemo.py audio.wav --streaming
  python transcribe-nemo.py audio.wav --model nvidia/parakeet-tdt-0.6b-v2
"""

import argparse
import sys


def transcribe_simple(audio_path, model_name="nvidia/nemotron-speech-streaming-en-0.6b"):
    """Simple batch transcription - easiest approach."""
    import nemo.collections.asr as nemo_asr

    print(f"Loading model: {model_name}")
    model = nemo_asr.models.ASRModel.from_pretrained(model_name)

    print(f"Transcribing: {audio_path}")
    result = model.transcribe([audio_path])

    # Handle different return types
    if hasattr(result[0], 'text'):
        return result[0].text
    return result[0]


def transcribe_streaming(audio_path, model_name="nvidia/nemotron-speech-streaming-en-0.6b", chunk_ms=160):
    """
    Streaming transcription with cache-aware inference.

    For full streaming control, use NeMo's cache-aware streaming script:
      python NeMo/examples/asr/asr_cache_aware_streaming/speech_to_text_cache_aware_streaming_infer.py
    """
    import nemo.collections.asr as nemo_asr
    import torch
    import soundfile as sf

    print(f"Loading model: {model_name}")
    model = nemo_asr.models.ASRModel.from_pretrained(model_name)

    # Load audio
    audio, sr = sf.read(audio_path)
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    # Chunk size in samples
    chunk_size = int(sr * chunk_ms / 1000)

    print(f"Audio: {len(audio)/sr:.2f}s, chunk: {chunk_ms}ms ({chunk_size} samples)")
    print("Streaming transcription:")

    # Process in chunks (simplified - for full cache-aware streaming, use NeMo's script)
    transcripts = []
    for i in range(0, len(audio), chunk_size):
        chunk = audio[i:i + chunk_size]
        if len(chunk) < chunk_size // 2:
            break

        # For proper streaming, you'd maintain cache state here
        # This is a simplified chunked approach
        with torch.no_grad():
            # Note: True streaming requires cache management
            # This just shows the chunk-by-chunk concept
            pass

    # For now, fall back to full transcription
    # True streaming requires the cache-aware inference script
    print("(Using batch mode - for true streaming, use NeMo's cache-aware script)")
    return transcribe_simple(audio_path, model_name)


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with Nemotron Speech")
    parser.add_argument("audio", help="Path to audio file (WAV, 16kHz recommended)")
    parser.add_argument("--model", default="nvidia/nemotron-speech-streaming-en-0.6b",
                        help="Model name (default: nvidia/nemotron-speech-streaming-en-0.6b)")
    parser.add_argument("--streaming", action="store_true",
                        help="Use streaming mode (experimental)")
    parser.add_argument("--chunk-ms", type=int, default=160,
                        help="Chunk size in ms for streaming (default: 160)")
    args = parser.parse_args()

    if args.streaming:
        text = transcribe_streaming(args.audio, args.model, args.chunk_ms)
    else:
        text = transcribe_simple(args.audio, args.model)

    print("\n--- Transcription ---")
    print(text)
    print("---------------------")


if __name__ == "__main__":
    main()
