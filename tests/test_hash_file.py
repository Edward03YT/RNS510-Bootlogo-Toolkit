"""
Tests for hash-file command and CLI integration (mapverify.cli and mapverify.hashing).
"""

import hashlib
from pathlib import Path
from mapverify.cli import main
from mapverify.common import EXIT_OK, EXIT_PROBLEMS, EXIT_ERROR


def test_hash_file_match(tmp_path, capsys):
    f = tmp_path / "download.iso"
    f.write_bytes(b"ISO DUMMY CONTENT FOR HASH TEST")
    expected = hashlib.sha256(b"ISO DUMMY CONTENT FOR HASH TEST").hexdigest()

    # Pass with leading '*' and uppercase
    code = main(["hash-file", str(f), "--expect", f" *{expected.upper()} "])
    assert code == EXIT_OK

    captured = capsys.readouterr().out
    assert "MATCH" in captured


def test_hash_file_mismatch(tmp_path, capsys):
    f = tmp_path / "download.iso"
    f.write_bytes(b"REAL CONTENT")
    fake_sha256 = "0" * 64

    code = main(["hash-file", str(f), "--expect", fake_sha256])
    assert code == EXIT_PROBLEMS

    captured = capsys.readouterr().out
    assert "MISMATCH" in captured


def test_hash_file_autodetect_algo(tmp_path, capsys):
    f = tmp_path / "file.bin"
    f.write_bytes(b"abc")
    md5_val = hashlib.md5(b"abc").hexdigest()

    # 32 chars should autodetect md5
    code = main(["hash-file", str(f), "--expect", md5_val])
    assert code == EXIT_OK

    captured = capsys.readouterr().out
    assert "md5" in captured.lower()
    assert "MATCH" in captured


def test_hash_file_missing_target(tmp_path, capsys):
    code = main(["hash-file", str(tmp_path / "nonexistent.iso"), "--expect", "0" * 64])
    assert code == EXIT_ERROR
