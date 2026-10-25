"""
Tests for SD card integrity test module (mapverify.cardtest).
Validates deterministic block verification, cleanup on success and error,
lying card simulation with injectable IO, and inconclusive reinsert results.
"""

import os
import pytest
from pathlib import Path

from mapverify.cardtest import (
    run_card_test,
    CardTestIO,
    generate_block,
    BLOCK_SIZE,
)
from mapverify.cli import main
from mapverify.common import EXIT_OK, EXIT_PROBLEMS, EXIT_ERROR


class LyingCardIO(CardTestIO):
    """
    Simulated failing/fake SD card IO:
    Returns corrupted data for any read beyond corrupt_after_bytes.
    """
    def __init__(self, corrupt_after_bytes: int):
        super().__init__()
        self.corrupt_after_bytes = corrupt_after_bytes
        self.total_read = 0

    def open_read(self, path: str):
        real_fp = super().open_read(path)
        lying_self = self

        class LyingReader:
            def __init__(self, fp):
                self.fp = fp

            def read(self, size=-1):
                data = self.fp.read(size)
                if not data:
                    return data
                res = bytearray(data)
                for i in range(len(res)):
                    if lying_self.total_read + i >= lying_self.corrupt_after_bytes:
                        res[i] = res[i] ^ 0xFF
                lying_self.total_read += len(res)
                return bytes(res)

            def __enter__(self):
                self.fp.__enter__()
                return self

            def __exit__(self, *args):
                return self.fp.__exit__(*args)

        return LyingReader(real_fp)


def test_generate_block_deterministic_and_unique():
    """Verify that blocks with different block/file indices never match."""
    seed = b"test_seed_123"
    blk0_0 = generate_block(seed, 0, 0, size=1024)
    blk0_1 = generate_block(seed, 0, 1, size=1024)
    blk1_0 = generate_block(seed, 1, 0, size=1024)

    assert len(blk0_0) == 1024
    assert blk0_0 != blk0_1
    assert blk0_0 != blk1_0

    # Same parameters must produce identical output
    assert blk0_0 == generate_block(seed, 0, 0, size=1024)


def test_cardtest_pass_and_cleanup(tmp_path):
    """
    Test running with small size on real filesystem returns PASS
    and always deletes .mapverify_test/.
    """
    test_dir = tmp_path / ".mapverify_test"

    # Run with small size (512 KiB = 2 blocks of 256 KiB)
    res = run_card_test(
        target_path=tmp_path,
        size_mb=1,
        reinserted=True,
        min_free_space_bytes=1024,
        block_size=256 * 1024,
        max_file_size=512 * 1024,
    )

    assert res.verdict == "PASS"
    assert res.bad_blocks == 0
    assert res.total_blocks > 0
    assert res.cleaned_up is True
    # Test directory must be deleted
    assert not test_dir.exists()


def test_cardtest_lying_card_simulation(tmp_path):
    """
    Test that an injected lying IO returns FAIL with the exact first bad block offset.
    """
    # Fail at offset 512 KiB (block index 2)
    fail_offset = 512 * 1024
    lying_io = LyingCardIO(corrupt_after_bytes=fail_offset)

    res = run_card_test(
        target_path=tmp_path,
        size_mb=1,
        reinserted=True,
        io_layer=lying_io,
        min_free_space_bytes=1024,
        block_size=256 * 1024,
        max_file_size=1024 * 1024,
    )

    assert "FAIL" in res.verdict
    assert res.bad_blocks > 0
    assert res.first_bad_block is not None
    assert res.first_bad_block["byte_offset"] == fail_offset
    assert res.first_bad_block["block_index"] == 2

    # Cleanup must still have happened
    assert not (tmp_path / ".mapverify_test").exists()


def test_cardtest_cleanup_on_exception(tmp_path):
    """
    Verify that if an error occurs mid-test, .mapverify_test/ is still cleaned up.
    """
    test_dir = tmp_path / ".mapverify_test"

    class FailingWriteIO(CardTestIO):
        def open_write(self, path: str):
            raise IOError("Simulated disk error during write phase")

    with pytest.raises(IOError):
        run_card_test(
            target_path=tmp_path,
            size_mb=1,
            io_layer=FailingWriteIO(),
            min_free_space_bytes=1024,
        )

    assert not test_dir.exists()


def test_cardtest_inconclusive_when_not_reinserted(tmp_path):
    res = run_card_test(
        target_path=tmp_path,
        size_mb=1,
        reinserted=False,
        min_free_space_bytes=1024,
        block_size=256 * 1024,
        max_file_size=512 * 1024,
    )

    assert "INCONCLUSIVE" in res.verdict
    assert res.bad_blocks == 0
    assert not (tmp_path / ".mapverify_test").exists()


def test_cardtest_insufficient_space(tmp_path):
    # Free space check should raise ValueError if below minimum threshold
    with pytest.raises(ValueError) as exc:
        run_card_test(
            target_path=tmp_path,
            min_free_space_bytes=100 * 1024 * 1024 * 1024 * 1024,  # 100 TB
        )
    assert "Insufficient free space" in str(exc.value)
