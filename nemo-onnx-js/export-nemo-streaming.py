#!/usr/bin/env python3
"""
Export NeMo Cache-Aware Streaming Models to ONNX

This script exports NeMo's cache-aware streaming models to ONNX format
for use with sherpa-onnx or direct ONNX Runtime inference.

Recommended Models (True Streaming with Cache-Aware Architecture):

  Nemotron Speech Streaming (January 2026 - RECOMMENDED):
  - nvidia/nemotron-speech-streaming-en-0.6b
    - 0.6B params, cache-aware FastConformer + RNN-T
    - Chunk sizes: 80ms, 160ms, 560ms, 1120ms
    - Native punctuation & capitalization
    - Best for voice agents and low-latency applications

  FastConformer Hybrid Streaming:
  - stt_en_fastconformer_hybrid_large_streaming_multi (multiple latencies)
  - nvidia/stt_en_fastconformer_hybrid_large_streaming_80ms
  - nvidia/stt_en_fastconformer_hybrid_large_streaming_480ms
  - nvidia/stt_en_fastconformer_hybrid_large_streaming_1040ms

Requirements:
  pip install nemo_toolkit[asr] onnx onnxruntime

Usage:
  # Nemotron Speech Streaming (recommended)
  python export-nemo-streaming.py --model nvidia/nemotron-speech-streaming-en-0.6b

  # FastConformer Hybrid
  python export-nemo-streaming.py --model stt_en_fastconformer_hybrid_large_streaming_multi

Based on: https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/nemo/fast-conformer-hybrid-transducer-ctc
"""

import argparse
import os
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(
        description="Export NeMo FastConformer streaming models to ONNX"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="nvidia/nemotron-speech-streaming-en-0.6b",
        help="NeMo model name or path (default: nvidia/nemotron-speech-streaming-en-0.6b)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory (default: model name)"
    )
    parser.add_argument(
        "--decoder-type",
        type=str,
        choices=["transducer", "ctc"],
        default="transducer",
        help="Decoder type for hybrid models (default: transducer)"
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Apply INT8 dynamic quantization"
    )
    args = parser.parse_args()

    # Import NeMo (requires nemo_toolkit[asr])
    try:
        import nemo.collections.asr as nemo_asr
    except ImportError:
        print("Error: NeMo toolkit not installed.")
        print("Install with: pip install 'nemo_toolkit[asr]'")
        return 1

    try:
        import onnx
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print("Error: onnx or onnxruntime not installed.")
        print("Install with: pip install onnx onnxruntime")
        return 1

    # Determine output directory
    output_dir = args.output_dir or args.model.replace("/", "_").replace("nvidia_", "")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading model: {args.model}")
    model = nemo_asr.models.ASRModel.from_pretrained(args.model)

    # Check if it's a hybrid model
    model_type = type(model).__name__
    print(f"Model type: {model_type}")

    is_hybrid = "Hybrid" in model_type
    if is_hybrid:
        print(f"Hybrid model detected, using decoder type: {args.decoder_type}")
        model.set_export_config({"decoder_type": args.decoder_type})

    # Check for streaming/cache-aware support
    if hasattr(model, 'encoder') and hasattr(model.encoder, 'streaming_cfg'):
        print("Cache-aware streaming model detected")
        # Enable cache support for streaming
        model.set_export_config({"cache_support": "True"})
    else:
        print("Warning: Model may not support cache-aware streaming")

    # Export tokens
    tokens_path = output_dir / "tokens.txt"
    print(f"Exporting tokens to: {tokens_path}")

    # Handle different vocabulary locations
    vocab = None
    if hasattr(model, 'joint') and hasattr(model.joint, 'vocabulary'):
        vocab = model.joint.vocabulary
    elif hasattr(model, 'decoder') and hasattr(model.decoder, 'vocabulary'):
        vocab = model.decoder.vocabulary
    elif hasattr(model, 'tokenizer'):
        vocab = model.tokenizer.vocab

    if vocab:
        with open(tokens_path, "w", encoding="utf-8") as f:
            for i, token in enumerate(vocab):
                # Handle special tokens
                if token == " ":
                    token = "▁"  # Use SentencePiece space marker
                f.write(f"{token} {i}\n")
        print(f"Exported {len(vocab)} tokens")
    else:
        print("Warning: Could not find vocabulary, tokens.txt not created")

    # Export ONNX
    onnx_path = output_dir / "model.onnx"
    print(f"Exporting ONNX to: {onnx_path}")

    try:
        model.export(str(onnx_path))
        print("ONNX export complete")
    except Exception as e:
        print(f"Export error: {e}")
        print("\nTrying component-wise export for transducer...")

        # For transducer models, export components separately
        if args.decoder_type == "transducer" or not is_hybrid:
            encoder_path = output_dir / "encoder.onnx"
            decoder_path = output_dir / "decoder.onnx"
            joiner_path = output_dir / "joiner.onnx"

            # This requires the sherpa-onnx export scripts
            print("\nFor transducer streaming models, use the sherpa-onnx export scripts:")
            print("https://github.com/k2-fsa/sherpa-onnx/tree/master/scripts/nemo/fast-conformer-hybrid-transducer-ctc")
            return 1

    # Quantize if requested
    if args.quantize:
        print("Applying INT8 quantization...")
        quantized_path = output_dir / "model.int8.onnx"
        quantize_dynamic(
            str(onnx_path),
            str(quantized_path),
            weight_type=QuantType.QInt8
        )
        print(f"Quantized model saved to: {quantized_path}")

    print("\n" + "=" * 50)
    print("Export complete!")
    print(f"Output directory: {output_dir}")
    print("\nFiles created:")
    for f in output_dir.iterdir():
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name}: {size_mb:.1f} MB")

    print("\nNext steps:")
    print(f"  1. Copy the output directory to nemo-onnx-js/")
    print(f"  2. Run: node transcribe-streaming.js audio.wav --model ./{output_dir.name}")

    return 0


if __name__ == "__main__":
    exit(main())
