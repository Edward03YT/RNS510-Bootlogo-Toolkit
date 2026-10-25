"""
Tests for ISO scanning module (mapverify.isoscan).
Builds tiny test ISOs using pycdlib, verifies completeness, truncation detection,
and --against folder comparisons.
"""

import io
import os
from pathlib import Path
import pycdlib
import pytest

from mapverify.isoscan import scan_iso
from mapverify.cli import main
from mapverify.common import EXIT_OK, EXIT_PROBLEMS, EXIT_ERROR


def _build_test_iso(iso_path: Path, files: dict) -> None:
    """Helper to build a small valid ISO with Joliet filesystem using pycdlib."""
    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, joliet=3)

    created_dirs = set()
    for idx, (rel_path, content) in enumerate(files.items(), 1):
        rel_clean = rel_path.lstrip("/")
        parts = rel_clean.split("/")
        if len(parts) > 1:
            for i in range(1, len(parts)):
                dir_p = "/" + "/".join(parts[:i])
                if dir_p not in created_dirs:
                    iso_dir = f"/DIR_{len(created_dirs)+1:02d}"
                    iso.add_directory(iso_dir, joliet_path=dir_p)
                    created_dirs.add(dir_p)

        iso_9660_name = f"/F_{idx:02d}.DAT;1"
        joliet_name = "/" + rel_clean
        iso.add_fp(
            io.BytesIO(content),
            len(content),
            iso_path=iso_9660_name,
            joliet_path=joliet_name,
        )

    iso.write(str(iso_path))
    iso.close()


def test_isoscan_valid_iso(tmp_path):
    iso_file = tmp_path / "valid.iso"
    _build_test_iso(iso_file, {
        "readme.txt": b"Hello from ISO!",
        "data/map.bin": b"1234567890",
    })

    res = scan_iso(iso_file)
    assert not res.has_problems
    assert not res.is_truncated
    assert res.total_files == 2
    assert len(res.failed_files) == 0
    assert res.has_joliet is True


def test_isoscan_truncated_iso(tmp_path):
    iso_file = tmp_path / "truncated.iso"
    _build_test_iso(iso_file, {
        "file1.dat": b"A" * 10000,
    })

    # Read bytes and truncate the file to 50%
    data = iso_file.read_bytes()
    truncated_data = data[: len(data) // 2]
    iso_file.write_bytes(truncated_data)

    # Scanning truncated image should detect truncation or read errors
    res = scan_iso(iso_file)
    assert res.has_problems
    assert res.is_truncated is True or len(res.failed_files) > 0


def test_isoscan_against_folder_matching_and_mismatch(tmp_path):
    iso_file = tmp_path / "maps.iso"
    _build_test_iso(iso_file, {
        "version.txt": b"VERSION 1.0",
        "data.dat": b"DATA PAYLOAD",
    })

    # 1. Matching folder
    folder_match = tmp_path / "folder_match"
    folder_match.mkdir()
    (folder_match / "version.txt").write_bytes(b"VERSION 1.0")
    (folder_match / "data.dat").write_bytes(b"DATA PAYLOAD")

    res_match = scan_iso(iso_file, against_folder=folder_match)
    assert not res_match.has_problems
    assert res_match.comparison is not None
    assert not res_match.comparison.has_problems
    assert len(res_match.comparison.ok) == 2

    # 2. Mismatched folder (same size 12 bytes, different content)
    folder_mismatch = tmp_path / "folder_mismatch"
    folder_mismatch.mkdir()
    (folder_mismatch / "version.txt").write_bytes(b"VERSION 1.0")
    (folder_mismatch / "data.dat").write_bytes(b"DIFF PAYLOAD")

    res_mismatch = scan_iso(iso_file, against_folder=folder_mismatch)
    assert res_mismatch.has_problems
    assert res_mismatch.comparison.has_problems
    assert len(res_mismatch.comparison.hash_mismatch) == 1


def test_isoscan_mounted_disc_directory(tmp_path):
    disc_dir = tmp_path / "mounted_disc"
    disc_dir.mkdir()
    (disc_dir / "VERSION.TXT").write_bytes(b"DISC V1")

    res = scan_iso(disc_dir)
    assert res.is_mounted_disc is True


def test_isoscan_cli(tmp_path, capsys):
    iso_file = tmp_path / "cli_test.iso"
    _build_test_iso(iso_file, {"info.txt": b"CLI ISO INFO"})

    code = main(["iso", str(iso_file), "--list"])
    assert code == EXIT_OK

    captured = capsys.readouterr().out
    assert "info.txt" in captured
    assert "OK" in captured
