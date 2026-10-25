"""
Tests for report rendering module (mapverify.report).
Validates JSON schema, Markdown tables, console formatting, and privacy masking.
"""

import json
import getpass
from mapverify.recon import run_recon
from mapverify.report import build_recon_report, Report


def test_report_privacy_no_tmp_path_or_username(tmp_path):
    """
    Critical privacy check: Reports must NEVER contain the tmp_path absolute prefix
    or user profile path / Windows username.
    """
    root = tmp_path / "target_map_folder"
    root.mkdir()
    (root / "DATA.BIN").write_bytes(b"12345")

    recon_res = run_recon(str(root))
    report = build_recon_report(
        recon_res,
        arguments={"command": "recon", "path": str(root), "depth": 3, "lang": "ro"},
    )

    json_output = report.to_json()
    md_output = report.to_markdown(lang="ro")
    console_output = report.to_console(lang="ro")

    # Assert tmp_path is never leaked in any output format
    str_tmp = str(tmp_path)
    assert str_tmp not in json_output
    assert str_tmp not in md_output
    assert str_tmp not in console_output

    # Assert system username is never leaked
    username = getpass.getuser()
    if username and len(username) > 2:
        assert f"Users/{username}" not in json_output
        assert f"Users\\{username}" not in json_output
        assert f"Users/{username}" not in md_output
        assert f"Users/{username}" not in console_output


def test_report_json_schema(tmp_path):
    root = tmp_path / "schema_folder"
    root.mkdir()
    (root / "test.bin").write_bytes(b"ABC")

    recon_res = run_recon(str(root))
    report = build_recon_report(recon_res, {"command": "recon", "path": str(root)})

    data = json.loads(report.to_json())

    # Check top-level JSON keys
    assert data["tool"] == "mapverify"
    assert "version" in data
    assert data["command"] == "recon"
    assert "created" in data
    assert "duration_seconds" in data
    assert "verdict" in data
    assert "arguments" in data
    assert "summary" in data
    assert "details" in data
    assert "problems" in data

    # Check summary metrics
    summary = data["summary"]
    assert summary["total_files"] == 1
    assert summary["total_bytes"] == 3
    assert "fingerprint" in summary


def test_report_markdown_sections_and_limits(tmp_path):
    root = tmp_path / "md_folder"
    root.mkdir()
    (root / "a.bin").write_bytes(b"hello")

    recon_res = run_recon(str(root))
    report = build_recon_report(recon_res, {"command": "recon", "path": str(root)})

    md_ro = report.to_markdown(lang="ro")
    md_en = report.to_markdown(lang="en")

    # Verify honest limits are present (Section 0)
    assert "HDD/SSD" in md_ro or "instalează" in md_ro
    assert "internal drive" in md_en

    # Verify tables
    assert "| Metric | Value |" in md_ro
    assert "| Extensie |" in md_ro
    assert "| Extension |" in md_en


def test_report_console_truncation():
    """Verify console truncates items past CONSOLE_TRUNCATION_LIMIT."""
    tree_nodes = [{"path": f"dir_{i}", "depth": 1, "direct_files": 1, "direct_bytes": 10, "total_files": 1, "total_bytes": 10} for i in range(250)]
    report = Report(
        command="recon",
        verdict="OK",
        summary={"total_files": 250, "total_directories": 250, "total_bytes": 2500, "fingerprint": "abc"},
        details={"tree": tree_nodes},
    )

    console_out = report.to_console()
    assert "... și încă 50 elemente" in console_out or "50 more" in console_out
