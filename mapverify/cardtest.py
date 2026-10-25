"""
SD Card verification module for detecting fake-capacity and failing media.
Performs deterministic, non-destructive write and read verification using
position-unique 1 MiB blocks derived from SHA-256.
Includes an injectable CardTestIO interface for unit testing simulated lying media.
"""

import os
import time
import shutil
import hashlib
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union, Tuple

from mapverify.common import (
    ProgressCallback,
    format_bytes,
    mask_path,
    check_cancelled,
)

BLOCK_SIZE = 1024 * 1024  # 1 MiB
FILE_SIZE = 256 * 1024 * 1024  # 256 MiB
MIN_FREE_SPACE_BYTES = 256 * 1024 * 1024  # 256 MiB


def generate_block(seed: bytes, file_idx: int, block_idx: int, size: int = BLOCK_SIZE) -> bytes:
    """
    Generate deterministic, position-unique block data.
    Expands sha256(seed || file_idx || block_idx) to target size.
    """
    key = seed + f":{file_idx}:{block_idx}".encode("utf-8")
    digest = hashlib.sha256(key).digest()  # 32 bytes
    repeat_count = (size + 31) // 32
    expanded = (digest * repeat_count)[:size]
    return expanded


class CardTestIO:
    """Standard filesystem I/O layer. Can be overridden in tests to simulate fake cards."""
    def get_free_space(self, path: str) -> int:
        return shutil.disk_usage(path).free

    def mkdir(self, path: str) -> None:
        os.makedirs(path, exist_ok=True)

    def open_write(self, path: str):
        return open(path, "wb")

    def open_read(self, path: str):
        return open(path, "rb")

    def fsync(self, fp) -> None:
        fp.flush()
        try:
            os.fsync(fp.fileno())
        except Exception:
            pass

    def remove_dir(self, path: str) -> None:
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=False)


@dataclass
class CardTestResult:
    target_path: str
    verdict: str  # "PASS", "FAIL (data mismatch)", "INCONCLUSIVE (user declined reinsert, cache may hide errors)"
    total_tested_bytes: int = 0
    total_blocks: int = 0
    bad_blocks: int = 0
    first_bad_block: Optional[Dict[str, Any]] = None  # file_index, block_index, byte_offset
    write_speed_mbps: float = 0.0
    read_speed_mbps: float = 0.0
    write_duration_seconds: float = 0.0
    read_duration_seconds: float = 0.0
    user_reinserted: bool = True
    cleaned_up: bool = True
    cleanup_error: Optional[str] = None
    test_dir_path: str = ""

    @property
    def is_pass(self) -> bool:
        return self.verdict.startswith("PASS")


def run_card_test(
    target_path: Union[str, Path],
    percent: float = 90.0,
    size_mb: Optional[int] = None,
    reinserted: bool = True,
    prompt_reinsert: Optional[Any] = None,
    seed: bytes = b"mapverify",
    io_layer: Optional[CardTestIO] = None,
    min_free_space_bytes: int = MIN_FREE_SPACE_BYTES,
    block_size: int = BLOCK_SIZE,
    max_file_size: int = FILE_SIZE,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> CardTestResult:
    """
    Execute full write-and-read card integrity test.
    Non-destructive; always cleans up test directory in finally block.
    """
    io = io_layer or CardTestIO()
    abs_target = os.path.abspath(str(target_path))

    if not os.path.exists(abs_target):
        raise FileNotFoundError(f"Target path does not exist: {target_path}")

    free_space = io.get_free_space(abs_target)
    if free_space < min_free_space_bytes:
        raise ValueError(
            f"Insufficient free space ({format_bytes(free_space)}). Minimum required is {format_bytes(min_free_space_bytes)}."
        )

    # Determine total test bytes
    if size_mb is not None and size_mb > 0:
        target_bytes = size_mb * 1024 * 1024
        if target_bytes > free_space:
            raise ValueError(f"Requested size ({size_mb} MB) exceeds available free space ({format_bytes(free_space)}).")
    else:
        target_bytes = int(free_space * (percent / 100.0))

    if target_bytes <= 0:
        raise ValueError("Target test size must be greater than zero.")

    test_dir = os.path.join(abs_target, ".mapverify_test")
    io.mkdir(test_dir)

    cleanup_ok = True
    cleanup_err = None

    write_start = time.time()
    total_written = 0
    test_files_info: List[Tuple[str, int, int]] = []  # (filepath, num_blocks, file_size)

    try:
        # 1. WRITE PHASE
        file_idx = 0
        remaining_bytes = target_bytes

        while remaining_bytes > 0:
            check_cancelled(cancel_event)
            current_file_size = min(remaining_bytes, max_file_size)
            num_blocks = (current_file_size + block_size - 1) // block_size

            filename = f"test_{file_idx:04d}.dat"
            filepath = os.path.join(test_dir, filename)

            with io.open_write(filepath) as fp:
                file_bytes_written = 0
                for b_idx in range(num_blocks):
                    check_cancelled(cancel_event)
                    this_block_len = min(block_size, current_file_size - file_bytes_written)
                    blk = generate_block(seed, file_idx, b_idx, size=this_block_len)
                    fp.write(blk)
                    file_bytes_written += len(blk)
                    total_written += len(blk)
                    if progress:
                        progress(total_written, target_bytes, f"Write {filename}")

                io.fsync(fp)

            test_files_info.append((filepath, num_blocks, current_file_size))
            remaining_bytes -= current_file_size
            file_idx += 1

        write_duration = max(time.time() - write_start, 0.001)
        write_speed = (total_written / (1024 * 1024)) / write_duration

        if prompt_reinsert is not None:
            reinserted = bool(prompt_reinsert())

        # 2. READ & VERIFY PHASE
        read_start = time.time()
        total_read = 0
        bad_blocks = 0
        first_bad = None
        total_blocks_count = 0
        absolute_byte_offset = 0

        for f_idx, (filepath, num_blocks, f_size) in enumerate(test_files_info):
            check_cancelled(cancel_event)
            with io.open_read(filepath) as fp:
                f_bytes_read = 0
                for b_idx in range(num_blocks):
                    check_cancelled(cancel_event)
                    total_blocks_count += 1
                    this_block_len = min(block_size, f_size - f_bytes_read)
                    actual_block = fp.read(this_block_len)
                    expected_block = generate_block(seed, f_idx, b_idx, size=this_block_len)

                    if actual_block != expected_block:
                        bad_blocks += 1
                        if first_bad is None:
                            first_bad = {
                                "file_index": f_idx,
                                "block_index": b_idx,
                                "byte_offset": absolute_byte_offset,
                            }

                    f_bytes_read += len(actual_block)
                    total_read += len(actual_block)
                    absolute_byte_offset += this_block_len
                    if progress:
                        progress(total_read, target_bytes, f"Verify {os.path.basename(filepath)}")

        read_duration = max(time.time() - read_start, 0.001)
        read_speed = (total_read / (1024 * 1024)) / read_duration

        if bad_blocks > 0:
            verdict = "FAIL (data mismatch)"
        elif not reinserted:
            verdict = "INCONCLUSIVE (user declined reinsert, cache may hide errors)"
        else:
            verdict = "PASS"

        return CardTestResult(
            target_path=mask_path(abs_target),
            verdict=verdict,
            total_tested_bytes=total_written,
            total_blocks=total_blocks_count,
            bad_blocks=bad_blocks,
            first_bad_block=first_bad,
            write_speed_mbps=round(write_speed, 2),
            read_speed_mbps=round(read_speed, 2),
            write_duration_seconds=round(write_duration, 2),
            read_duration_seconds=round(read_duration, 2),
            user_reinserted=reinserted,
            cleaned_up=True,
            test_dir_path=mask_path(test_dir),
        )

    finally:
        # Always delete .mapverify_test/ inside finally block
        try:
            io.remove_dir(test_dir)
        except Exception as e:
            cleanup_ok = False
            cleanup_err = str(e)
            print(f"\n[WARNING] Could not remove test directory: {test_dir}\nError: {e}")
