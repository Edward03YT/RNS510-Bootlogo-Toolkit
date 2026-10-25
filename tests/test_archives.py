"""
Tests for archive testing module (mapverify.archives).
Validates .zip member CRC checking, corruption detection, and unsupported format handling.
"""

import zipfile
from pathlib import Path
from mapverify.archives import test_archive as run_archive_test
from mapverify.cli import main
from mapverify.common import EXIT_OK, EXIT_PROBLEMS, EXIT_ERROR


def test_archive_valid_zip(tmp_path):
    zip_path = tmp_path / "valid.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("file1.txt", "Hello World! This is file 1.")
        zf.writestr("sub/file2.bin", b"Binary data in subdirectory.")

    res = run_archive_test(zip_path)
    assert res.status == "PASS"
    assert res.total_members == 2
    assert res.tested_members == 2
    assert len(res.bad_members) == 0


def test_archive_corrupted_zip_member(tmp_path):
    """
    Create a zip file, then corrupt a member's compressed payload to trigger CRC failure.
    """
    zip_path = tmp_path / "corrupted.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.writestr("good.txt", b"A" * 100)
        zf.writestr("bad.txt", b"B" * 100)

    # Read binary bytes and mutate bytes belonging to "bad.txt" payload
    data = bytearray(zip_path.read_bytes())
    # Locate "BBBB" payload and alter it
    idx = data.find(b"BBBB")
    assert idx != -1
    data[idx:idx + 4] = b"XXXX"  # Corrupt data while CRC in header remains for "BBBB"
    zip_path.write_bytes(data)

    res = run_archive_test(zip_path)
    assert res.status == "FAIL"
    assert "bad.txt" in res.bad_members


def test_archive_unsupported_rar(tmp_path):
    rar_path = tmp_path / "archive.rar"
    rar_path.write_bytes(b"Rar!\x1a\x07\x00dummy")

    res = run_archive_test(rar_path)
    assert res.status == "UNSUPPORTED"
    assert "not supported in v1" in res.message


def test_archive_cli_exit_codes(tmp_path, capsys):
    # Valid ZIP -> exit 0
    zip_path = tmp_path / "test.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("member.txt", "data")

    code_ok = main(["archive-test", str(zip_path)])
    assert code_ok == EXIT_OK

    # RAR -> exit 2 (unsupported)
    rar_path = tmp_path / "test.rar"
    rar_path.write_bytes(b"dummy")
    code_rar = main(["archive-test", str(rar_path)])
    assert code_rar == EXIT_ERROR
