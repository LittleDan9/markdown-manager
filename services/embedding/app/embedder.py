"""Sentence-transformers embedding service — ONNX Runtime accelerated.

Uses optimum ORTModelForFeatureExtraction for ~2-3x faster CPU inference,
inspired by TurboQuant's quantization-first approach.  Falls back to
vanilla sentence-transformers if ONNX export/load fails.
"""
import logging
import os
import shutil
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
_ONNX_MODEL_DIR = Path("/embedding/.onnx_cache") / MODEL_NAME

_model: SentenceTransformer | None = None
_using_onnx = False


def _export_onnx_model() -> bool:
    """Export the sentence-transformers model to ONNX with dynamic quantization.

    Returns True if ONNX model is ready, False on failure.
    """
    try:
        from optimum.onnxruntime import ORTModelForFeatureExtraction
        from optimum.onnxruntime.configuration import AutoQuantizationConfig
        from optimum.onnxruntime import ORTQuantizer

        if (_ONNX_MODEL_DIR / "model.onnx").exists():
            logger.info("ONNX model already exported at %s", _ONNX_MODEL_DIR)
            return True

        logger.info("Exporting %s to ONNX with INT8 dynamic quantization…", MODEL_NAME)
        _ONNX_MODEL_DIR.mkdir(parents=True, exist_ok=True)

        # Export to ONNX
        ort_model = ORTModelForFeatureExtraction.from_pretrained(
            f"sentence-transformers/{MODEL_NAME}", export=True
        )
        ort_model.save_pretrained(_ONNX_MODEL_DIR)

        # Copy tokenizer files from the original model
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(f"sentence-transformers/{MODEL_NAME}")
        tokenizer.save_pretrained(_ONNX_MODEL_DIR)

        # Apply dynamic INT8 quantization
        quantizer = ORTQuantizer.from_pretrained(_ONNX_MODEL_DIR)
        qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
        quantizer.quantize(save_dir=_ONNX_MODEL_DIR, quantization_config=qconfig)

        # Replace the original model.onnx with the quantized one if it exists
        quantized_path = _ONNX_MODEL_DIR / "model_quantized.onnx"
        original_path = _ONNX_MODEL_DIR / "model.onnx"
        if quantized_path.exists():
            shutil.move(str(quantized_path), str(original_path))

        logger.info("ONNX INT8 model exported to %s", _ONNX_MODEL_DIR)
        return True
    except Exception:
        logger.exception("ONNX export failed — will use vanilla sentence-transformers")
        return False


def load_model() -> SentenceTransformer:
    """Load the embedding model (called once at startup).

    Attempts ONNX Runtime backend first for faster inference,
    falls back to vanilla PyTorch if ONNX export/load fails.
    """
    global _model, _using_onnx
    if _model is not None:
        return _model

    onnx_ready = _export_onnx_model()
    if onnx_ready:
        try:
            logger.info("Loading ONNX-accelerated model from %s", _ONNX_MODEL_DIR)
            _model = SentenceTransformer(
                str(_ONNX_MODEL_DIR),
                backend="onnx",
                model_kwargs={"file_name": "model.onnx"},
            )
            _using_onnx = True
            logger.info("ONNX model loaded — dim=%d (INT8 quantized)", EMBEDDING_DIM)
            return _model
        except Exception:
            logger.exception("Failed to load ONNX model — falling back to PyTorch")

    logger.info("Loading PyTorch model: %s", MODEL_NAME)
    _model = SentenceTransformer(MODEL_NAME)
    _using_onnx = False
    logger.info("PyTorch model loaded — dim=%d", EMBEDDING_DIM)
    return _model


def get_model() -> SentenceTransformer:
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() during startup.")
    return _model


def is_using_onnx() -> bool:
    """Return True if the ONNX backend is active."""
    return _using_onnx


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of 384-dim float vectors."""
    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return embeddings.tolist()
