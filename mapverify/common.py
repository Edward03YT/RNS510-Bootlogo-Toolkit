"""
Common utilities for RNS 510 Map Source Verifier.
Includes path normalization, Windows long-path helpers, privacy masking,
ignore filtering, progress and cancellation types.
"""

import os
import sys
import fnmatch
import getpass
import tempfile
import threading
from pathlib import Path
from typing import Callable, List, Optional, Union, Dict, Any

# Tool version
__version__ = "0.1.0"

# Exit codes
EXIT_OK = 0
EXIT_PROBLEMS = 1
EXIT_ERROR = 2

# Streaming chunk size (4 MiB)
CHUNK_SIZE = 4 * 1024 * 1024

# Default ignore list
DEFAULT_IGNORE = [
    "System Volume Information",
    "$RECYCLE.BIN",
    "Thumbs.db",
    "desktop.ini",
    ".DS_Store",
]

# Progress callback type: (bytes_done, bytes_total, current_path)
ProgressCallback = Callable[[int, int, str], None]


class OperationCancelledError(Exception):
    """Raised when an operation is cancelled via threading.Event."""
    pass


def to_windows_long_path(path: Union[str, Path]) -> str:
    """
    Ensure Windows path supports > 260 characters by prefixing \\\\?\\ if needed.
    On non-Windows systems, returns normalized path string.
    """
    path_str = str(path)
    if os.name != "nt":
        return os.path.abspath(path_str)

    # Normalize slashes to backslashes for Windows API
    abs_path = os.path.abspath(path_str)
    if abs_path.startswith("\\\\?\\"):
        return abs_path

    # Handle UNC paths (e.g. \\server\share -> \\?\UNC\server\share)
    if abs_path.startswith("\\\\"):
        return "\\\\?\\UNC\\" + abs_path[2:]

    return "\\\\?\\" + abs_path


def normalize_rel_path(rel_path: Union[str, Path]) -> str:
    """
    Normalize relative path to use forward slashes and no leading/trailing slashes.
    """
    p = str(rel_path).replace("\\", "/").strip("/")
    return p if p else "."


def mask_path(path: Union[str, Path], root_dir: Optional[Union[str, Path]] = None) -> str:
    """
    Privacy sanitizer: strips or masks drive letters, user profile folders,
    Windows usernames, and temp folder prefixes.
    Ensures absolute system paths and usernames never leak into reports.
    """
    if path is None:
        return ""

    path_str = str(path)
    if not path_str:
        return ""

    # Normalize backslashes for uniform matching
    p_norm = path_str.replace("\\", "/")

    # Mask pytest / system temp directories
    try:
        temp_dir = tempfile.gettempdir().replace("\\", "/")
        if temp_dir and temp_dir in p_norm:
            p_norm = p_norm.replace(temp_dir, "<TEMP>")
    except Exception:
        pass

    # Mask user home folder
    try:
        home_dir = str(Path.home()).replace("\\", "/")
        if home_dir and home_dir in p_norm:
            p_norm = p_norm.replace(home_dir, "<USER_HOME>")
    except Exception:
        pass

    # Mask username if still present
    try:
        user = getpass.getuser()
        if user and user in p_norm:
            p_norm = p_norm.replace(f"Users/{user}", "Users/<USER>")
            p_norm = p_norm.replace(f"home/{user}", "home/<USER>")
            p_norm = p_norm.replace(user, "<USER>")
    except Exception:
        pass

    # If an absolute path is present (drive letter, leading slash, or masked prefix),
    # keep only the last 1-2 components for context without leaking hierarchy
    if len(p_norm) >= 2 and p_norm[1] == ":":
        parts = [part for part in p_norm.split("/") if part]
        if len(parts) > 2:
            p_norm = ".../" + "/".join(parts[-2:])
        else:
            p_norm = ".../" + parts[-1] if parts else "<ROOT>"
    elif p_norm.startswith("<USER_HOME>") or p_norm.startswith("<TEMP>"):
        parts = [part for part in p_norm.split("/") if part and not part.startswith("<")]
        if len(parts) > 1:
            p_norm = ".../" + "/".join(parts[-2:])
        elif parts:
            p_norm = ".../" + parts[-1]
        else:
            p_norm = "<TARGET>"
    elif p_norm.startswith("/") and not p_norm.startswith("<"):
        parts = [part for part in p_norm.split("/") if part]
        if len(parts) > 2:
            p_norm = ".../" + "/".join(parts[-2:])
        else:
            p_norm = ".../" + parts[-1] if parts else "<ROOT>"

    return p_norm


def should_ignore(name: str, ignore_patterns: List[str]) -> bool:
    """
    Case-insensitive check whether a file or folder name matches any ignore pattern.
    """
    name_lower = name.lower()
    for pattern in ignore_patterns:
        pat_lower = pattern.lower()
        if name_lower == pat_lower:
            return True
        if fnmatch.fnmatch(name_lower, pat_lower):
            return True
    return False


def get_file_size(file_path: Union[str, Path]) -> int:
    """
    Get file size in bytes using os.path.getsize.
    Can be patched in tests to simulate huge files without disk allocation.
    """
    return os.path.getsize(str(file_path))


def format_bytes(bytes_count: int) -> str:
    """
    Format bytes count into human readable units (B, KiB, MiB, GiB).
    """
    if bytes_count < 1024:
        return f"{bytes_count} B"
    elif bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.2f} KiB ({bytes_count:,} bytes)"
    elif bytes_count < 1024 * 1024 * 1024:
        return f"{bytes_count / (1024 * 1024):.2f} MiB ({bytes_count:,} bytes)"
    else:
        return f"{bytes_count / (1024 * 1024 * 1024):.2f} GiB ({bytes_count:,} bytes)"


def check_cancelled(cancel_event: Optional[threading.Event]) -> None:
    """Raise OperationCancelledError if cancellation event is set."""
    if cancel_event is not None and cancel_event.is_set():
        raise OperationCancelledError("Operation cancelled by user.")
