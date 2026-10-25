"""
Tests for reconnaissance module (mapverify.recon).
Validates structural metrics, flags, stability of fingerprint,
and graceful handling of limits without network or real map dependencies.
"""

import os
import threading
from pathlib import Path
from unittest.mock import patch

import pytest

from mapverify.recon import run_recon, ReconResult
from mapverify.common import OperationCancelledError


def test_recon_counts_and_hierarchy(tmp_path):
    root = tmp_path / "map_source"
    root.mkdir()

    # Create directory structure
    dir1 = root / "DIR1"
    dir1.mkdir()
    dir2 = dir1 / "SUBDIR2"
    dir2.mkdir()

    # Create files with known sizes
    (root / "root_file.bin").write_bytes(b"12345")  # 5 bytes
    (dir1 / "file1.dat").write_bytes(b"1234567890")  # 10 bytes
    (dir2 / "file2.dat").write_bytes(b"123456789012345")  # 15 bytes

    result = run_recon(str(root), depth=3)

    assert result.total_files == 3
    assert result.total_directories == 3  # ., DIR1, DIR1/SUBDIR2
    assert result.total_bytes == 30

    # Verify tree details
    tree_by_path = {node["path"]: node for node in result.tree}
    assert "." in tree_by_path
    assert "DIR1" in tree_by_path
    assert "DIR1/SUBDIR2" in tree_by_path

    assert tree_by_path["."]["direct_files"] == 1
    assert tree_by_path["."]["total_files"] == 3
    assert tree_by_path["."]["total_bytes"] == 30

    assert tree_by_path["DIR1"]["direct_files"] == 1
    assert tree_by_path["DIR1"]["total_files"] == 2
    assert tree_by_path["DIR1"]["total_bytes"] == 25


def test_recon_extension_histogram(tmp_path):
    root = tmp_path / "hist_test"
    root.mkdir()

    (root / "a.iso").write_bytes(b"A" * 100)
    (root / "b.iso").write_bytes(b"B" * 50)
    (root / "c.idx").write_bytes(b"C" * 20)
    (root / "README").write_bytes(b"R" * 10)  # No extension

    result = run_recon(str(root))
    hist = result.extension_histogram

    assert ".iso" in hist
    assert hist[".iso"]["count"] == 2
    assert hist[".iso"]["bytes"] == 150

    assert ".idx" in hist
    assert hist[".idx"]["count"] == 1
    assert hist[".idx"]["bytes"] == 20

    assert "(none)" in hist
    assert hist["(none)"]["count"] == 1
    assert hist["(none)"]["bytes"] == 10


def test_recon_zero_byte_detection(tmp_path):
    root = tmp_path / "zero_test"
    root.mkdir()

    (root / "empty.txt").write_bytes(b"")
    (root / "normal.txt").write_bytes(b"content")

    result = run_recon(str(root))
    assert len(result.zero_byte_files) == 1
    assert result.zero_byte_files[0]["path"] == "empty.txt"
    assert result.zero_byte_files[0]["size"] == 0


def test_recon_4gb_flag_via_size_lookup_patch(tmp_path):
    """
    Test the 4 GiB flag by patching the size lookup helper
    rather than allocating a 4+ GiB file on disk.
    """
    root = tmp_path / "huge_test"
    root.mkdir()
    huge_file = root / "MAP_DATA.DAT"
    huge_file.write_bytes(b"placeholder")

    # 4 GiB is 4,294,967,296 bytes. Simulate a 5 GiB file.
    simulated_size = 5 * 1024 * 1024 * 1024

    with patch("mapverify.recon.get_file_size", return_value=simulated_size):
        result = run_recon(str(root))

    assert len(result.flags["files_over_4gb"]) == 1
    flagged = result.flags["files_over_4gb"][0]
    assert flagged["path"] == "MAP_DATA.DAT"
    assert flagged["size"] == simulated_size


def test_recon_fingerprint_stability(tmp_path):
    """
    Fingerprint is stable and independent of file content and creation order.
    """
    tree_a = tmp_path / "tree_a"
    tree_a.mkdir()
    tree_b = tmp_path / "tree_b"
    tree_b.mkdir()

    # Tree A: file 1 then file 2, content "ABCDE" (5 bytes) and "1234567890" (10 bytes)
    (tree_a / "f1.dat").write_bytes(b"ABCDE")
    (tree_a / "f2.dat").write_bytes(b"0123456789")

    # Tree B: reverse creation order, DIFFERENT content but identical sizes
    (tree_b / "f2.dat").write_bytes(b"XXXXXXXXXX")  # 10 bytes
    (tree_b / "f1.dat").write_bytes(b"YYYYY")       # 5 bytes

    res_a = run_recon(str(tree_a))
    res_b = run_recon(str(tree_b))

    assert res_a.fingerprint != ""
    assert res_a.fingerprint == res_b.fingerprint

    # Changing a size must change the fingerprint
    tree_c = tmp_path / "tree_c"
    tree_c.mkdir()
    (tree_c / "f1.dat").write_bytes(b"ABCDE_modified")  # 14 bytes
    (tree_c / "f2.dat").write_bytes(b"0123456789")
    res_c = run_recon(str(tree_c))

    assert res_c.fingerprint != res_a.fingerprint


def test_recon_non_ascii_flag(tmp_path):
    root = tmp_path / "ascii_test"
    root.mkdir()
    # File with Romanian diacritics
    (root / "hărți_v17.dat").write_bytes(b"test")
    (root / "standard.dat").write_bytes(b"test")

    result = run_recon(str(root))
    assert len(result.flags["non_ascii_names"]) == 1
    assert "hărți_v17.dat" in result.flags["non_ascii_names"][0]


def test_recon_case_collision_flag(tmp_path):
    """
    Test detection of names that differ only by case within a directory.
    Simulated to ensure reliability across all OS filesystems (Windows/Linux/macOS).
    """
    root = tmp_path / "case_test"
    root.mkdir()
    (root / "file.txt").write_bytes(b"1")

    # Mock os.walk to yield colliding filenames ["file.txt", "FILE.TXT"]
    with patch("os.walk") as mock_walk:
        mock_walk.return_value = [
            (str(root), [], ["file.txt", "FILE.TXT"])
        ]
        with patch("mapverify.recon.get_file_size", return_value=10):
            result = run_recon(str(root))

    assert len(result.flags["case_collisions"]) == 1
    collision = result.flags["case_collisions"][0]
    assert sorted(collision["colliding_names"]) == ["FILE.TXT", "file.txt"]


def test_recon_manifest_candidates_and_preview(tmp_path):
    root = tmp_path / "manifest_test"
    root.mkdir()

    md5_file = root / "checksum.md5"
    md5_file.write_text("line1\nline2\nline3\nline4\nline5\nline6\nline7\n", encoding="utf-8")

    readme_file = root / "README.TXT"
    readme_file.write_text("RNS 510 Map Update\nVersion 17\nNotes here\n", encoding="utf-8")

    result = run_recon(str(root))
    candidates = {c["path"]: c for c in result.manifest_candidates}

    assert "checksum.md5" in candidates
    assert len(candidates["checksum.md5"]["first_5_lines"]) == 5
    assert candidates["checksum.md5"]["first_5_lines"][0] == "line1"
    assert candidates["checksum.md5"]["first_5_lines"][4] == "line5"

    assert "README.TXT" in candidates
    assert candidates["README.TXT"]["first_5_lines"][0] == "RNS 510 Map Update"


def test_recon_paths_over_240_chars(tmp_path):
    root = tmp_path / "long_path_test"
    root.mkdir()

    # Build a deep path over 240 chars
    long_dir = root / ("A" * 120) / ("B" * 120)
    long_dir.mkdir(parents=True)
    long_file = long_dir / "target.bin"
    long_file.write_bytes(b"data")

    result = run_recon(str(root))
    assert len(result.flags["paths_over_240_chars"]) == 1
    assert "target.bin" in result.flags["paths_over_240_chars"][0]


def test_recon_non_iso9660_chars(tmp_path):
    root = tmp_path / "iso_chars_test"
    root.mkdir()

    # Space, bracket, and plus are outside standard ISO9660 level 1/2 charset
    (root / "My Map (Disc 1)+v2.dat").write_bytes(b"data")
    (root / "VALID_NAME-01.DAT").write_bytes(b"data")

    result = run_recon(str(root))
    assert len(result.flags["non_iso9660_chars"]) == 1
    assert "My Map (Disc 1)+v2.dat" in result.flags["non_iso9660_chars"][0]


def test_recon_card_comparison(tmp_path):
    root = tmp_path / "card_test"
    root.mkdir()
    (root / "file.dat").write_bytes(b"X" * 1000)

    result = run_recon(str(root))
    card_info = result.flags["card_comparison"]

    assert "4 GB" in card_info
    assert "8 GB" in card_info
    assert "16 GB" in card_info
    assert "32 GB" in card_info
    assert card_info["4 GB"]["fits"] is True


def test_recon_ignore_default_patterns(tmp_path):
    root = tmp_path / "ignore_test"
    root.mkdir()

    (root / "Thumbs.db").write_bytes(b"thumb")
    (root / "desktop.ini").write_bytes(b"ini")
    (root / "good_file.dat").write_bytes(b"good")

    rec_dir = root / "$RECYCLE.BIN"
    rec_dir.mkdir()
    (rec_dir / "recycled.bin").write_bytes(b"junk")

    result = run_recon(str(root))
    assert result.total_files == 1
    assert result.total_directories == 1  # only root .


def test_recon_cancellation(tmp_path):
    root = tmp_path / "cancel_test"
    root.mkdir()
    (root / "file1.dat").write_bytes(b"1")

    cancel_evt = threading.Event()
    cancel_evt.set()

    with pytest.raises(OperationCancelledError):
        run_recon(str(root), cancel_event=cancel_evt)
