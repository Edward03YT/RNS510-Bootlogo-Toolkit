"""
Tests for CLI interface (mapverify.cli).
Validates exit codes (0, 1, 2), argument parsing, bilingual output, and file exports.
"""

from pathlib import Path
from mapverify.cli import main
from mapverify.common import EXIT_OK, EXIT_ERROR


def test_cli_exit_code_0_on_success(tmp_path, capsys):
    valid_folder = tmp_path / "valid_set"
    valid_folder.mkdir()
    (valid_folder / "DATA.DAT").write_bytes(b"content")

    code = main(["recon", str(valid_folder)])
    assert code == EXIT_OK

    captured = capsys.readouterr()
    assert "DATA.DAT" in captured.out
    assert "Rezumat general" in captured.out or "RNS 510" in captured.out


def test_cli_exit_code_2_on_nonexistent_path(tmp_path, capsys):
    missing_folder = tmp_path / "does_not_exist"
    code = main(["recon", str(missing_folder)])
    assert code == EXIT_ERROR

    captured = capsys.readouterr()
    assert "nu există" in captured.err or "does not exist" in captured.err


def test_cli_exit_code_2_on_file_not_dir(tmp_path, capsys):
    file_path = tmp_path / "a_file.txt"
    file_path.write_bytes(b"data")

    code = main(["recon", str(file_path)])
    assert code == EXIT_ERROR

    captured = capsys.readouterr()
    assert "nu este un director" in captured.err or "not a directory" in captured.err


def test_cli_bilingual_ro_and_en(tmp_path, capsys):
    folder = tmp_path / "map_bi"
    folder.mkdir()
    (folder / "file.dat").write_bytes(b"1")

    # Romanian (default)
    main(["--lang", "ro", "recon", str(folder)])
    out_ro = capsys.readouterr().out
    assert "Total fișiere" in out_ro
    assert "Total directoare" in out_ro

    # English
    main(["--lang", "en", "recon", str(folder)])
    out_en = capsys.readouterr().out
    assert "Total files" in out_en
    assert "Total directories" in out_en


def test_cli_save_md_and_json(tmp_path, capsys):
    folder = tmp_path / "map_export"
    folder.mkdir()
    (folder / "file.dat").write_bytes(b"123")

    md_file = tmp_path / "recon.md"
    json_file = tmp_path / "recon.json"

    code = main([
        "recon", str(folder),
        "--md", str(md_file),
        "--json", str(json_file),
    ])
    assert code == EXIT_OK
    assert md_file.exists()
    assert json_file.exists()

    md_content = md_file.read_text(encoding="utf-8")
    assert "# RNS 510 Map Source Verifier" in md_content

    json_content = json_file.read_text(encoding="utf-8")
    assert '"tool": "mapverify"' in json_content
