"""
Tests for direct tree comparison module (mapverify.compare).
Validates identical trees, difference detection, case-insensitive path matching,
and eject notice handling.
"""

from pathlib import Path
from unittest.mock import patch
from mapverify.compare import run_compare


def test_compare_identical_trees(tmp_path):
    tree_a = tmp_path / "tree_a"
    tree_b = tmp_path / "tree_b"
    tree_a.mkdir()
    tree_b.mkdir()

    (tree_a / "f1.dat").write_bytes(b"HELLO")
    (tree_b / "f1.dat").write_bytes(b"HELLO")

    (tree_a / "sub").mkdir()
    (tree_b / "sub").mkdir()
    (tree_a / "sub" / "f2.bin").write_bytes(b"WORLD")
    (tree_b / "sub" / "f2.bin").write_bytes(b"WORLD")

    res = run_compare(tree_a, tree_b, user_confirmed_eject=True)
    assert not res.has_problems
    assert len(res.ok) == 2
    assert res.user_confirmed_eject is True
    assert "2 ok" in res.summary_line()


def test_compare_difference_categories(tmp_path):
    tree_a = tmp_path / "tree_a"
    tree_b = tmp_path / "tree_b"
    tree_a.mkdir()
    tree_b.mkdir()

    # OK file
    (tree_a / "ok.dat").write_bytes(b"same")
    (tree_b / "ok.dat").write_bytes(b"same")

    # Missing in B
    (tree_a / "missing_in_b.dat").write_bytes(b"only in a")

    # Extra in B
    (tree_b / "extra_in_b.dat").write_bytes(b"only in b")

    # Size mismatch
    (tree_a / "size_diff.dat").write_bytes(b"long data string")
    (tree_b / "size_diff.dat").write_bytes(b"short")

    # Hash mismatch (same size)
    (tree_a / "hash_diff.dat").write_bytes(b"12345")
    (tree_b / "hash_diff.dat").write_bytes(b"ABCDE")

    res = run_compare(tree_a, tree_b)
    assert res.has_problems
    assert len(res.ok) == 1
    assert len(res.missing) == 1
    assert res.missing[0]["path"] == "missing_in_b.dat"
    assert len(res.extra) == 1
    assert res.extra[0]["path"] == "extra_in_b.dat"
    assert len(res.size_mismatch) == 1
    assert res.size_mismatch[0]["path"] == "size_diff.dat"
    assert len(res.hash_mismatch) == 1
    assert res.hash_mismatch[0]["path"] == "hash_diff.dat"


def test_compare_case_insensitive_paths(tmp_path):
    """
    On FAT32/ISO/Windows, path case should match case-insensitively.
    e.g. DIR/FILE.DAT in A matches dir/file.dat in B.
    """
    tree_a = tmp_path / "tree_a"
    tree_b = tmp_path / "tree_b"
    tree_a.mkdir()
    tree_b.mkdir()

    # In tree_a: UPPERCASE
    dir_a = tree_a / "FOLDER"
    dir_a.mkdir()
    (dir_a / "FILE.DAT").write_bytes(b"content")

    # In tree_b: lowercase
    dir_b = tree_b / "folder"
    dir_b.mkdir()
    (dir_b / "file.dat").write_bytes(b"content")

    res = run_compare(tree_a, tree_b)
    assert not res.has_problems
    assert len(res.ok) == 1


def test_compare_quick_mode(tmp_path):
    tree_a = tmp_path / "tree_a"
    tree_b = tmp_path / "tree_b"
    tree_a.mkdir()
    tree_b.mkdir()

    (tree_a / "f.dat").write_bytes(b"12345")
    (tree_b / "f.dat").write_bytes(b"ABCDE")

    # Quick compare: checks presence & size only -> should be ok
    res_quick = run_compare(tree_a, tree_b, quick=True)
    assert not res_quick.has_problems
    assert len(res_quick.ok) == 1

    # Full compare: catches hash mismatch
    res_full = run_compare(tree_a, tree_b, quick=False)
    assert res_full.has_problems
    assert len(res_full.hash_mismatch) == 1
