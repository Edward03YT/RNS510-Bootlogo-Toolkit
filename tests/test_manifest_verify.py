"""
Tests for manifest creation and folder verification (mapverify.manifest and mapverify.verify).
Validates round trip, error category discrimination (flip byte, truncate, delete, extra, unreadable),
and --quick verification mode.
"""

from pathlib import Path
from unittest.mock import patch, mock_open

from mapverify.manifest import create_manifest, load_manifest
from mapverify.verify import run_verify


def test_manifest_round_trip_and_schema(tmp_path):
    root = tmp_path / "V17_WEST"
    root.mkdir()
    (root / "DATA1.BIN").write_bytes(b"HELLO WORLD")
    (root / "DATA2.BIN").write_bytes(b"SECOND FILE CONTENT")

    sub = root / "SUBDIR"
    sub.mkdir()
    (sub / "DATA3.BIN").write_bytes(b"THIRD FILE")

    manifest_file = tmp_path / "manifest.json"
    manifest_data = create_manifest(root, algo="sha256", workers=2)
    manifest_data.save(manifest_file)

    # Validate loaded schema
    loaded = load_manifest(manifest_file)
    assert loaded.tool == "mapverify"
    assert loaded.version == "0.1.0"
    assert loaded.algo == "sha256"
    assert loaded.root_name == "V17_WEST"
    assert loaded.total_files == 3
    assert len(loaded.files) == 3

    # Files must be sorted by path
    paths = [f["path"] for f in loaded.files]
    assert paths == sorted(paths)

    # Initial verification should be 100% OK
    res = run_verify(root, manifest_file)
    assert not res.has_problems
    assert len(res.ok) == 3
    assert len(res.missing) == 0
    assert len(res.extra) == 0
    assert len(res.size_mismatch) == 0
    assert len(res.hash_mismatch) == 0
    assert len(res.unreadable) == 0
    assert res.summary_line() == "3 ok"


def test_verify_categories_discrimination(tmp_path):
    """
    Test each problem category:
    - flip one byte -> hash_mismatch
    - truncate a file -> size_mismatch
    - delete a file -> missing
    - add an extra file -> extra
    - mock unreadable file -> unreadable
    """
    root = tmp_path / "source"
    root.mkdir()

    file_ok = root / "file_ok.bin"
    file_ok.write_bytes(b"good content 12345")

    file_flip = root / "file_flip.bin"
    file_flip.write_bytes(b"original content 1")

    file_trunc = root / "file_trunc.bin"
    file_trunc.write_bytes(b"this file will be truncated")

    file_del = root / "file_del.bin"
    file_del.write_bytes(b"this file will be deleted")

    file_unreadable = root / "file_unreadable.bin"
    file_unreadable.write_bytes(b"unreadable content")

    manifest_data = create_manifest(root, algo="sha256")

    # Now mutate the directory
    # 1. Flip one byte in file_flip (size remains same)
    file_flip.write_bytes(b"original content 2")

    # 2. Truncate file_trunc
    file_trunc.write_bytes(b"short")

    # 3. Delete file_del
    file_del.unlink()

    # 4. Add extra file
    file_extra = root / "extra_file.dat"
    file_extra.write_bytes(b"i am extra")

    # Verify without unreadable first
    res = run_verify(root, manifest_data)
    assert res.has_problems
    assert len(res.ok) == 2  # file_ok + file_unreadable (before mocking)
    assert len(res.hash_mismatch) == 1
    assert res.hash_mismatch[0]["path"] == "file_flip.bin"

    assert len(res.size_mismatch) == 1
    assert res.size_mismatch[0]["path"] == "file_trunc.bin"

    assert len(res.missing) == 1
    assert res.missing[0]["path"] == "file_del.bin"

    assert len(res.extra) == 1
    assert res.extra[0]["path"] == "extra_file.dat"

    # 5. Now test unreadable by patching open to raise PermissionError for file_unreadable
    original_open = open

    def fake_open(file, *args, **kwargs):
        if "file_unreadable.bin" in str(file):
            raise PermissionError("Access denied simulated")
        return original_open(file, *args, **kwargs)

    with patch("builtins.open", side_effect=fake_open):
        res_unreadable = run_verify(root, manifest_data)

    assert len(res_unreadable.unreadable) == 1
    assert res_unreadable.unreadable[0]["path"] == "file_unreadable.bin"
    assert "Access denied" in res_unreadable.unreadable[0]["error"]


def test_verify_quick_mode(tmp_path):
    root = tmp_path / "quick_test"
    root.mkdir()
    (root / "file.bin").write_bytes(b"12345")

    manifest_data = create_manifest(root, algo="sha256")

    # Flip one byte with same size
    (root / "file.bin").write_bytes(b"ABCDE")

    # Quick mode checks only presence and size -> should report OK
    res_quick = run_verify(root, manifest_data, quick=True)
    assert not res_quick.has_problems
    assert len(res_quick.ok) == 1

    # Full mode should catch the hash mismatch
    res_full = run_verify(root, manifest_data, quick=False)
    assert res_full.has_problems
    assert len(res_full.hash_mismatch) == 1
