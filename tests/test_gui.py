"""
Tests for GUI initialization, tab handling, language toggle, and initial path routing.
"""

import os
import sys
import pytest
import tkinter as tk
from unittest.mock import patch, MagicMock

from mapverify.gui import MapVerifierGUI, launch_gui
from mapverify.cli import main
from mapverify.common import EXIT_OK


@pytest.fixture
def tk_root():
    """Create hidden Tk root for GUI tests and ensure it is destroyed."""
    try:
        root = tk.Tk()
        root.withdraw()
    except Exception:
        pytest.skip("Tkinter display not available")
    yield root
    try:
        root.destroy()
    except Exception:
        pass


def test_gui_initialization(tk_root):
    """Test that MapVerifierGUI constructs widgets without error."""
    app = MapVerifierGUI(tk_root)
    assert app.lang == "ro"
    assert app.notebook is not None
    assert app.btn_lang["text"] == "🇷🇴 Română"


def test_gui_language_toggle(tk_root):
    """Test switching languages in GUI."""
    app = MapVerifierGUI(tk_root)
    assert app.lang == "ro"
    app._toggle_language()
    assert app.lang == "en"
    assert "English" in app.btn_lang["text"]
    app._toggle_language()
    assert app.lang == "ro"


def test_gui_initial_path_directory(tk_root, tmp_path):
    """Test dropping a directory populates recon and verify tabs."""
    test_dir = tmp_path / "map_folder"
    test_dir.mkdir()
    app = MapVerifierGUI(tk_root, initial_path=str(test_dir))
    assert app.recon_path_var.get() == str(test_dir)
    assert app.verify_folder_var.get() == str(test_dir)


def test_gui_initial_path_iso(tk_root, tmp_path):
    """Test dropping an .iso file populates ISO tab."""
    iso_file = tmp_path / "maps.iso"
    iso_file.write_bytes(b"dummy iso")
    app = MapVerifierGUI(tk_root, initial_path=str(iso_file))
    assert app.iso_path_var.get() == str(iso_file)


def test_gui_initial_path_archive(tk_root, tmp_path):
    """Test dropping an archive populates Archive tab."""
    archive_file = tmp_path / "maps.zip"
    archive_file.write_bytes(b"PK\x05\x06" + b"\x00" * 18)
    app = MapVerifierGUI(tk_root, initial_path=str(archive_file))
    assert app.archive_path_var.get() == str(archive_file)


def test_gui_initial_path_manifest(tk_root, tmp_path):
    """Test dropping a .json manifest populates Verify tab."""
    json_file = tmp_path / "manifest.json"
    json_file.write_text('{"tool": "mapverify"}', encoding="utf-8")
    app = MapVerifierGUI(tk_root, initial_path=str(json_file))
    assert app.verify_manifest_var.get() == str(json_file)


def test_gui_cli_subcommand(monkeypatch):
    """Test invoking gui subcommand from CLI dispatches to launch_gui."""
    with patch("mapverify.gui.launch_gui") as mock_launch:
        code = main(["gui", "some_folder"])
        assert code == EXIT_OK
        mock_launch.assert_called_once_with(initial_path="some_folder")
