"""
Reconnaissance module for inspecting map source folder/disc structures.
Analyzes directory hierarchies, file extensions, large/zero files,
manifest candidates, and informational flags without making assumptions
about internal map layout.
"""

import os
import sys
import time
import hashlib
import string
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple

from mapverify.common import (
    DEFAULT_IGNORE,
    ProgressCallback,
    should_ignore,
    normalize_rel_path,
    get_file_size,
    mask_path,
    check_cancelled,
)

# Common card capacities in bytes (decimal and binary reference)
COMMON_CARD_SIZES = [
    ("4 GB", 4_000_000_000),
    ("8 GB", 8_000_000_000),
    ("16 GB", 16_000_000_000),
    ("32 GB", 32_000_000_000),
]

# Set of characters permitted in ISO9660 Level 1/2 file and directory names
ISO9660_CHARS: Set[str] = set(string.ascii_letters + string.digits + "_-.")

# Checksum / manifest candidate indicators
CHECKSUM_EXTENSIONS = (".md5", ".sha1", ".sha256", ".crc", ".sfv", ".chk")
CHECKSUM_KEYWORDS = ("checksum", "manifest", "version", "readme")


@dataclass
class DirStats:
    rel_path: str
    depth: int
    direct_files: int = 0
    direct_bytes: int = 0
    total_files: int = 0
    total_bytes: int = 0


@dataclass
class ReconResult:
    root_name: str
    target_path: str
    total_files: int = 0
    total_directories: int = 0
    total_bytes: int = 0
    fingerprint: str = ""
    duration_seconds: float = 0.0
    tree: List[Dict[str, Any]] = field(default_factory=list)
    extension_histogram: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    largest_files: List[Dict[str, Any]] = field(default_factory=list)
    zero_byte_files: List[Dict[str, Any]] = field(default_factory=list)
    manifest_candidates: List[Dict[str, Any]] = field(default_factory=list)
    flags: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert recon result to dictionary representation."""
        return {
            "root_name": self.root_name,
            "target_path": self.target_path,
            "total_files": self.total_files,
            "total_directories": self.total_directories,
            "total_bytes": self.total_bytes,
            "fingerprint": self.fingerprint,
            "duration_seconds": round(self.duration_seconds, 3),
            "tree": self.tree,
            "extension_histogram": self.extension_histogram,
            "largest_files": self.largest_files,
            "zero_byte_files": self.zero_byte_files,
            "manifest_candidates": self.manifest_candidates,
            "flags": self.flags,
            "errors": self.errors,
        }


def _is_manifest_candidate(filename: str) -> bool:
    """Check if filename looks like a checksum, manifest, or readme file."""
    lower = filename.lower()
    if lower.endswith(CHECKSUM_EXTENSIONS):
        return True
    return any(keyword in lower for keyword in CHECKSUM_KEYWORDS)


def _read_first_5_lines(file_path: str, max_bytes: int = 65536) -> Tuple[Optional[List[str]], Optional[str]]:
    """
    Safely read first 5 lines of a text file up to max_bytes without loading large files.
    """
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(max_bytes)
        
        # Decode text with fallback
        try:
            text = chunk.decode("utf-8")
        except UnicodeDecodeError:
            text = chunk.decode("latin-1", errors="replace")

        lines = [line.strip("\r\n") for line in text.splitlines()]
        return lines[:5], None
    except Exception as e:
        return None, str(e)


def run_recon(
    target_path: str,
    depth: int = 3,
    ignore_patterns: Optional[List[str]] = None,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> ReconResult:
    """
    Scan target folder or drive and produce structure reconnaissance report.
    """
    start_time = time.time()
    abs_target = os.path.abspath(target_path)

    if not os.path.exists(abs_target):
        raise FileNotFoundError(f"Path does not exist: {target_path}")
    if not os.path.isdir(abs_target):
        raise NotADirectoryError(f"Path is not a directory: {target_path}")

    active_ignores = list(DEFAULT_IGNORE)
    if ignore_patterns:
        active_ignores.extend(ignore_patterns)

    root_name = os.path.basename(os.path.normpath(abs_target))
    if not root_name:
        root_name = "ROOT"

    masked_target = mask_path(abs_target)

    all_files: List[Tuple[str, int, str]] = []  # (rel_path, size, full_path)
    dir_stats_map: Dict[str, DirStats] = {}
    errors: List[str] = []

    # Initialize root directory in stats map
    dir_stats_map["."] = DirStats(rel_path=".", depth=0)

    # Walk directory tree
    for root, dirs, files in os.walk(abs_target, topdown=True, followlinks=False):
        check_cancelled(cancel_event)

        # Compute relative directory path
        rel_dir = os.path.relpath(root, abs_target)
        rel_dir_norm = normalize_rel_path(rel_dir)
        dir_depth = 0 if rel_dir_norm == "." else rel_dir_norm.count("/") + 1

        # Filter out ignored directories in-place
        ignored_dirs = [d for d in dirs if should_ignore(d, active_ignores)]
        for d in ignored_dirs:
            dirs.remove(d)

        if rel_dir_norm not in dir_stats_map:
            dir_stats_map[rel_dir_norm] = DirStats(rel_path=rel_dir_norm, depth=dir_depth)

        current_dir_stats = dir_stats_map[rel_dir_norm]

        # Scan files in current directory
        for filename in files:
            check_cancelled(cancel_event)

            if should_ignore(filename, active_ignores):
                continue

            full_file_path = os.path.join(root, filename)
            rel_file_path = normalize_rel_path(os.path.relpath(full_file_path, abs_target))

            try:
                size = get_file_size(full_file_path)
            except Exception as e:
                errors.append(f"Cannot get size for {mask_path(rel_file_path)}: {e}")
                continue

            all_files.append((rel_file_path, size, full_file_path))
            current_dir_stats.direct_files += 1
            current_dir_stats.direct_bytes += size

            if progress is not None:
                progress(len(all_files), 0, rel_file_path)

    # Compute recursive directory totals
    for d_path, stats in dir_stats_map.items():
        if d_path == ".":
            prefix = ""
        else:
            prefix = d_path + "/"

        total_f = 0
        total_b = 0
        for f_rel, f_size, _ in all_files:
            if d_path == "." or f_rel.startswith(prefix):
                total_f += 1
                total_b += f_size
        stats.total_files = total_f
        stats.total_bytes = total_b

    # Filter tree entries up to max depth
    tree_entries = []
    for d_path in sorted(dir_stats_map.keys()):
        stats = dir_stats_map[d_path]
        if stats.depth <= depth:
            tree_entries.append({
                "path": stats.rel_path,
                "depth": stats.depth,
                "direct_files": stats.direct_files,
                "direct_bytes": stats.direct_bytes,
                "total_files": stats.total_files,
                "total_bytes": stats.total_bytes,
            })

    # Overall totals
    total_files = len(all_files)
    total_directories = len(dir_stats_map)
    total_bytes = sum(f[1] for f in all_files)

    # Stable fingerprint: SHA-256 over sorted relative_path|size lines
    fingerprint_lines: List[str] = []
    for rel_path, size, _ in sorted(all_files, key=lambda x: x[0]):
        fingerprint_lines.append(f"{rel_path}|{size}\n")

    if fingerprint_lines:
        hasher = hashlib.sha256("".join(fingerprint_lines).encode("utf-8"))
        fingerprint = hasher.hexdigest()
    else:
        fingerprint = hashlib.sha256(b"").hexdigest()

    # Extension histogram
    extension_counts: Dict[str, Dict[str, Any]] = {}
    for rel_path, size, _ in all_files:
        ext = os.path.splitext(rel_path)[1].lower()
        if not ext:
            ext = "(none)"
        if ext not in extension_counts:
            extension_counts[ext] = {"count": 0, "bytes": 0}
        extension_counts[ext]["count"] += 1
        extension_counts[ext]["bytes"] += size

    # Sort histogram by bytes descending, then count descending
    sorted_histogram = dict(
        sorted(
            extension_counts.items(),
            key=lambda item: (item[1]["bytes"], item[1]["count"]),
            reverse=True,
        )
    )

    # 20 largest files
    sorted_by_size = sorted(all_files, key=lambda x: (x[1], x[0]), reverse=True)
    largest_files = [
        {"path": item[0], "size": item[1]}
        for item in sorted_by_size[:20]
    ]

    # Zero-byte files
    zero_byte_files = [
        {"path": item[0], "size": 0}
        for item in all_files
        if item[1] == 0
    ]

    # Manifest and checksum candidate files
    manifest_candidates = []
    for rel_path, size, full_path in all_files:
        filename = os.path.basename(rel_path)
        if _is_manifest_candidate(filename):
            entry: Dict[str, Any] = {"path": rel_path, "size": size}
            if size <= 65536:
                lines, err = _read_first_5_lines(full_path)
                if err:
                    entry["error"] = err
                else:
                    entry["first_5_lines"] = lines
            else:
                entry["first_5_lines"] = None
                entry["note"] = "file_larger_than_64k"
            manifest_candidates.append(entry)

    # Informational flags analysis
    flags: Dict[str, Any] = {}

    # 1. Files larger than 4 GiB (FAT32 limitation: 4 GiB = 4,294,967,296 bytes)
    over_4gb = [
        {"path": item[0], "size": item[1]}
        for item in all_files
        if item[1] > 4 * 1024 * 1024 * 1024
    ]
    flags["files_over_4gb"] = over_4gb

    # 2. Paths longer than 240 characters
    paths_over_240 = [
        item[0]
        for item in all_files
        if len(item[0]) > 240
    ]
    flags["paths_over_240_chars"] = paths_over_240

    # 3. Non-ASCII file or directory names
    non_ascii_files = [
        item[0]
        for item in all_files
        if any(ord(c) > 127 for c in item[0])
    ]
    flags["non_ascii_names"] = non_ascii_files

    # 4. Names that differ only by case within the same directory
    case_collisions: List[Dict[str, Any]] = []
    # Group files by parent directory
    dir_files: Dict[str, List[str]] = {}
    for rel_path, _, _ in all_files:
        parent = os.path.dirname(rel_path) or "."
        dir_files.setdefault(parent, []).append(os.path.basename(rel_path))

    for parent_dir, fnames in dir_files.items():
        seen: Dict[str, List[str]] = {}
        for fname in fnames:
            seen.setdefault(fname.lower(), []).append(fname)
        for _, original_names in seen.items():
            if len(original_names) > 1:
                case_collisions.append({
                    "directory": parent_dir,
                    "colliding_names": sorted(original_names),
                })
    flags["case_collisions"] = case_collisions

    # 5. Names with characters outside ISO9660 Level 1/2 charset (A-Z a-z 0-9 _ - .)
    non_iso9660 = []
    for rel_path, _, _ in all_files:
        parts = rel_path.split("/")
        has_invalid = False
        for part in parts:
            if any(ch not in ISO9660_CHARS for ch in part):
                has_invalid = True
                break
        if has_invalid:
            non_iso9660.append(rel_path)
    flags["non_iso9660_chars"] = non_iso9660

    # 6. Total size vs common card sizes
    card_comparison: Dict[str, Dict[str, Any]] = {}
    for label, capacity in COMMON_CARD_SIZES:
        fits = total_bytes <= capacity
        percent_used = (total_bytes / capacity) * 100 if capacity > 0 else 0
        card_comparison[label] = {
            "capacity_bytes": capacity,
            "fits": fits,
            "percent_used": round(percent_used, 2),
        }
    flags["card_comparison"] = card_comparison

    duration = time.time() - start_time

    return ReconResult(
        root_name=root_name,
        target_path=masked_target,
        total_files=total_files,
        total_directories=total_directories,
        total_bytes=total_bytes,
        fingerprint=fingerprint,
        duration_seconds=duration,
        tree=tree_entries,
        extension_histogram=sorted_histogram,
        largest_files=largest_files,
        zero_byte_files=zero_byte_files,
        manifest_candidates=manifest_candidates,
        flags=flags,
        errors=errors,
    )
