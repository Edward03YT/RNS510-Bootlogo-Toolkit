"""
Archive testing module: tests archives for internal CRC errors without extracting to disk.
Supports .zip natively, .7z via optional py7zr, and provides clear messaging for unsupported formats.
Never shells out.
"""

import os
import time
import zipfile
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union

from mapverify.common import (
    CHUNK_SIZE,
    ProgressCallback,
    mask_path,
    check_cancelled,
)


@dataclass
class ArchiveTestResult:
    file_path: str
    archive_type: str
    status: str  # "PASS", "FAIL", "UNSUPPORTED", "MISSING_DEPENDENCY", "ERROR"
    total_members: int = 0
    tested_members: int = 0
    bad_members: List[str] = field(default_factory=list)
    message: str = ""
    duration_seconds: float = 0.0

    @property
    def is_ok(self) -> bool:
        return self.status == "PASS"


def test_archive(
    file_path: Union[str, Path],
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> ArchiveTestResult:
    """
    Test integrity of an archive without extracting files to disk.
    """
    start_time = time.time()
    abs_path = os.path.abspath(str(file_path))

    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Archive file not found: {file_path}")
    if os.path.isdir(abs_path):
        raise IsADirectoryError(f"Target is a directory, not an archive file: {file_path}")

    ext = os.path.splitext(abs_path)[1].lower()
    masked_p = mask_path(abs_path)

    # 1. ZIP Archives
    if ext == ".zip" or zipfile.is_zipfile(abs_path):
        total_members = 0
        tested_members = 0
        bad_members = []

        try:
            with zipfile.ZipFile(abs_path, "r") as zf:
                infolist = zf.infolist()
                total_members = len(infolist)

                for idx, info in enumerate(infolist, 1):
                    check_cancelled(cancel_event)
                    if progress:
                        progress(idx, total_members, info.filename)

                    try:
                        # Stream member to verify CRC
                        with zf.open(info, "r") as member_file:
                            while True:
                                check_cancelled(cancel_event)
                                chunk = member_file.read(CHUNK_SIZE)
                                if not chunk:
                                    break
                        tested_members += 1
                    except zipfile.BadZipFile:
                        bad_members.append(info.filename)
                    except Exception:
                        bad_members.append(info.filename)

            duration = time.time() - start_time
            if bad_members:
                return ArchiveTestResult(
                    file_path=masked_p,
                    archive_type="zip",
                    status="FAIL",
                    total_members=total_members,
                    tested_members=tested_members,
                    bad_members=bad_members,
                    message=f"CRC verification failed for {len(bad_members)} of {total_members} members.",
                    duration_seconds=duration,
                )
            else:
                return ArchiveTestResult(
                    file_path=masked_p,
                    archive_type="zip",
                    status="PASS",
                    total_members=total_members,
                    tested_members=tested_members,
                    bad_members=[],
                    message=f"All {total_members} archive members passed CRC verification successfully.",
                    duration_seconds=duration,
                )
        except Exception as e:
            return ArchiveTestResult(
                file_path=masked_p,
                archive_type="zip",
                status="ERROR",
                message=f"Failed to read ZIP archive: {e}",
                duration_seconds=time.time() - start_time,
            )

    # 2. 7z Archives (optional py7zr)
    if ext == ".7z":
        try:
            import py7zr
        except ImportError:
            return ArchiveTestResult(
                file_path=masked_p,
                archive_type="7z",
                status="MISSING_DEPENDENCY",
                message=(
                    "Optional dependency 'py7zr' is not installed to test .7z archives.\n"
                    "Install it via: pip install py7zr  (or pip install .[7z])"
                ),
                duration_seconds=time.time() - start_time,
            )

        try:
            with py7zr.SevenZipFile(abs_path, mode="r") as sz:
                is_valid = sz.test()
                duration = time.time() - start_time
                if is_valid:
                    return ArchiveTestResult(
                        file_path=masked_p,
                        archive_type="7z",
                        status="PASS",
                        message="7z archive passed integrity test successfully.",
                        duration_seconds=duration,
                    )
                else:
                    return ArchiveTestResult(
                        file_path=masked_p,
                        archive_type="7z",
                        status="FAIL",
                        message="7z archive failed integrity check.",
                        duration_seconds=duration,
                    )
        except Exception as e:
            return ArchiveTestResult(
                file_path=masked_p,
                archive_type="7z",
                status="ERROR",
                message=f"Error testing 7z archive: {e}",
                duration_seconds=time.time() - start_time,
            )

    # 3. RAR and other unsupported formats
    if ext in (".rar", ".tar", ".gz", ".bz2", ".xz", ".iso"):
        return ArchiveTestResult(
            file_path=masked_p,
            archive_type=ext.lstrip("."),
            status="UNSUPPORTED",
            message=(
                f"Testing for '{ext}' archives is not supported in v1.\n"
                "Please verify this archive directly using 7-Zip, WinRAR, or the appropriate archiver."
            ),
            duration_seconds=time.time() - start_time,
        )

    return ArchiveTestResult(
        file_path=masked_p,
        archive_type="unknown",
        status="UNSUPPORTED",
        message=f"Unknown archive format for file: {masked_p}",
        duration_seconds=time.time() - start_time,
    )
