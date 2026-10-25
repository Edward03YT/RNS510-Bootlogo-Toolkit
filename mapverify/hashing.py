"""
Streaming file hashing and algorithm autodetection module.
Supports SHA-256, SHA-1, and MD5 with 4 MiB chunks.
Never loads whole files into RAM.
"""

import os
import hashlib
import threading
from pathlib import Path
from typing import Optional, Union, Tuple

from mapverify.common import (
    CHUNK_SIZE,
    ProgressCallback,
    check_cancelled,
    to_windows_long_path,
)

SUPPORTED_ALGOS = ("sha256", "sha1", "md5")

# Hex length mapping for algorithm autodetection
HASH_LENGTH_TO_ALGO = {
    32: "md5",
    40: "sha1",
    64: "sha256",
}


def clean_hash(hash_str: str) -> str:
    """
    Clean and normalize a hash string:
    strip whitespace, strip leading '*' (common in md5sum / sha256sum outputs),
    and convert to lowercase.
    """
    cleaned = hash_str.strip()
    if cleaned.startswith("*"):
        cleaned = cleaned[1:].strip()
    return cleaned.lower()


def autodetect_algo(hash_str: str) -> str:
    """
    Detect algorithm by hex string length:
    32 -> md5, 40 -> sha1, 64 -> sha256.
    Raises ValueError if length does not match any known algorithm.
    """
    cleaned = clean_hash(hash_str)
    algo = HASH_LENGTH_TO_ALGO.get(len(cleaned))
    if not algo:
        raise ValueError(
            f"Cannot detect algorithm for hash of length {len(cleaned)} (expected 32 for MD5, 40 for SHA-1, 64 for SHA-256): '{hash_str}'"
        )
    # Check that all characters are valid hexadecimal digits
    if not all(c in "0123456789abcdef" for c in cleaned):
        raise ValueError(f"Invalid hexadecimal characters in hash string: '{hash_str}'")
    return algo


def hash_file(
    file_path: Union[str, Path],
    algo: str = "sha256",
    chunk_size: int = CHUNK_SIZE,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
    bytes_done_offset: int = 0,
    total_bytes_hint: int = 0,
) -> str:
    """
    Stream file data in 4 MiB chunks and calculate cryptographic hash.
    Safe for multi-gigabyte ISOs and archives.
    """
    algo_lower = algo.lower()
    if algo_lower not in SUPPORTED_ALGOS:
        raise ValueError(f"Unsupported hash algorithm '{algo}'. Supported: {', '.join(SUPPORTED_ALGOS)}")

    hasher = hashlib.new(algo_lower)
    safe_path = to_windows_long_path(file_path)

    file_size = total_bytes_hint if total_bytes_hint > 0 else os.path.getsize(safe_path)
    current_done = bytes_done_offset

    with open(safe_path, "rb") as f:
        while True:
            check_cancelled(cancel_event)
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
            current_done += len(chunk)
            if progress is not None:
                progress(current_done, file_size, str(file_path))

    return hasher.hexdigest()
