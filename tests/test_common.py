"""
Tests for common utilities, path normalization, privacy masking, and ignore logic.
"""

import os
import getpass
import tempfile
from pathlib import Path
from unittest.mock import patch

from mapverify.common import (
    to_windows_long_path,
    normalize_rel_path,
    mask_path,
    should_ignore,
    format_bytes,
    DEFAULT_IGNORE,
)


def test_normalize_rel_path():
    assert normalize_rel_path("folder\\sub\\file.txt") == "folder/sub/file.txt"
    assert normalize_rel_path("/folder/sub/file.txt/") == "folder/sub/file.txt"
    assert normalize_rel_path("") == "."
    assert normalize_rel_path(".") == "."


def test_should_ignore_default():
    assert should_ignore("Thumbs.db", DEFAULT_IGNORE) is True
    assert should_ignore("THUMBS.DB", DEFAULT_IGNORE) is True
    assert should_ignore("desktop.ini", DEFAULT_IGNORE) is True
    assert should_ignore(".DS_Store", DEFAULT_IGNORE) is True
    assert should_ignore("System Volume Information", DEFAULT_IGNORE) is True
    assert should_ignore("$RECYCLE.BIN", DEFAULT_IGNORE) is True
    assert should_ignore("normal_map_file.dat", DEFAULT_IGNORE) is False


def test_should_ignore_custom_patterns():
    custom = ["*.tmp", "temp_*"]
    assert should_ignore("data.tmp", custom) is True
    assert should_ignore("DATA.TMP", custom) is True
    assert should_ignore("temp_01", custom) is True
    assert should_ignore("valid.dat", custom) is False


def test_format_bytes():
    assert format_bytes(500) == "500 B"
    assert "KiB" in format_bytes(2048)
    assert "MiB" in format_bytes(5 * 1024 * 1024)
    assert "GiB" in format_bytes(4 * 1024 * 1024 * 1024)


def test_mask_path_privacy(tmp_path):
    # Test that tmp_path or username is masked
    sample_path = tmp_path / "maps" / "data.dat"
    masked = mask_path(sample_path)
    assert str(tmp_path) not in masked
    assert "<TEMP>" in masked or ".../" in masked

    # Test username masking
    username = getpass.getuser()
    fake_path = f"C:\\Users\\{username}\\Desktop\\MyMap"
    masked_user = mask_path(fake_path)
    assert username not in masked_user


def test_windows_long_path():
    short_path = "C:\\short\\path"
    long_res = to_windows_long_path(short_path)
    if os.name == "nt":
        assert long_res.startswith("\\\\?\\")
    else:
        assert isinstance(long_res, str)
