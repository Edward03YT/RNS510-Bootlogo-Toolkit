"""
Tests for streaming hashing module (mapverify.hashing).
Validates known vectors, chunking, autodetection by length, and cancellation.
"""

import hashlib
import threading
import pytest
from mapverify.hashing import (
    hash_file,
    autodetect_algo,
    clean_hash,
    SUPPORTED_ALGOS,
)
from mapverify.common import OperationCancelledError


def test_clean_hash():
    assert clean_hash("  *d41d8cd98f00b204e9800998ecf8427e  ") == "d41d8cd98f00b204e9800998ecf8427e"
    assert clean_hash("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855") == (
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


def test_autodetect_algo():
    # 32 chars -> md5
    assert autodetect_algo("d41d8cd98f00b204e9800998ecf8427e") == "md5"
    assert autodetect_algo(" *d41d8cd98f00b204e9800998ecf8427e ") == "md5"

    # 40 chars -> sha1
    assert autodetect_algo("da39a3ee5e6b4b0d3255bfef95601890afd80709") == "sha1"

    # 64 chars -> sha256
    assert autodetect_algo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") == "sha256"

    # Invalid lengths or characters
    with pytest.raises(ValueError):
        autodetect_algo("abc123")
    with pytest.raises(ValueError):
        autodetect_algo("g" * 32)  # Non-hex character


def test_known_hash_vectors(tmp_path):
    empty_file = tmp_path / "empty.bin"
    empty_file.write_bytes(b"")

    data_file = tmp_path / "hello.txt"
    data_file.write_bytes(b"The quick brown fox jumps over the lazy dog")

    # Empty file vectors
    assert hash_file(empty_file, "md5") == "d41d8cd98f00b204e9800998ecf8427e"
    assert hash_file(empty_file, "sha1") == "da39a3ee5e6b4b0d3255bfef95601890afd80709"
    assert hash_file(empty_file, "sha256") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    # Known string vectors
    assert hash_file(data_file, "sha256") == "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
    assert hash_file(data_file, "md5") == "9e107d9d372bb6826bd81d3542a419d6"
    assert hash_file(data_file, "sha1") == "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"


def test_streaming_large_file(tmp_path):
    """
    Test streaming hash with small chunks (e.g. 1 MiB chunk over 5 MiB file)
    to confirm progress callback and multiple chunk updates.
    """
    large_file = tmp_path / "stream_test.dat"
    # Create 5 MiB file
    chunk = b"A" * (1024 * 1024)
    with open(large_file, "wb") as f:
        for _ in range(5):
            f.write(chunk)

    expected_hash = hashlib.sha256(b"A" * (5 * 1024 * 1024)).hexdigest()

    progress_calls = []

    def _prog(done, total, path):
        progress_calls.append(done)

    actual_hash = hash_file(
        large_file,
        algo="sha256",
        chunk_size=1024 * 1024,
        progress=_prog,
    )

    assert actual_hash == expected_hash
    assert len(progress_calls) >= 5
    assert progress_calls[-1] == 5 * 1024 * 1024


def test_hashing_cancellation(tmp_path):
    file_path = tmp_path / "cancel.bin"
    file_path.write_bytes(b"data" * 1000)

    cancel_evt = threading.Event()
    cancel_evt.set()

    with pytest.raises(OperationCancelledError):
        hash_file(file_path, cancel_event=cancel_evt)
