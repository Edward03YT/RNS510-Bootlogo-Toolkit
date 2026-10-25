"""
Verification module: compares a local folder against a pre-generated manifest.
Categorizes files into: ok, missing, extra, size_mismatch, hash_mismatch, unreadable.
Supports --quick mode for fast size/presence checking.
"""

import os
import time
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union

from mapverify.common import (
    DEFAULT_IGNORE,
    ProgressCallback,
    should_ignore,
    normalize_rel_path,
    get_file_size,
    mask_path,
    check_cancelled,
)
from mapverify.hashing import hash_file
from mapverify.manifest import ManifestData, load_manifest


@dataclass
class VerifyResult:
    target_path: str
    manifest_path: str
    algo: str
    quick: bool = False
    duration_seconds: float = 0.0
    ok: List[Dict[str, Any]] = field(default_factory=list)
    missing: List[Dict[str, Any]] = field(default_factory=list)
    extra: List[Dict[str, Any]] = field(default_factory=list)
    size_mismatch: List[Dict[str, Any]] = field(default_factory=list)
    hash_mismatch: List[Dict[str, Any]] = field(default_factory=list)
    unreadable: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def has_problems(self) -> bool:
        """True if any missing, extra, size_mismatch, hash_mismatch, or unreadable items exist."""
        return bool(
            self.missing
            or self.extra
            or self.size_mismatch
            or self.hash_mismatch
            or self.unreadable
        )

    @property
    def counts(self) -> Dict[str, int]:
        return {
            "ok": len(self.ok),
            "missing": len(self.missing),
            "extra": len(self.extra),
            "size_mismatch": len(self.size_mismatch),
            "hash_mismatch": len(self.hash_mismatch),
            "unreadable": len(self.unreadable),
        }

    def summary_line(self) -> str:
        """Summary line formatted as: '1230 ok, 2 missing, 1 hash mismatch'."""
        parts = [f"{len(self.ok)} ok"]
        if self.missing:
            parts.append(f"{len(self.missing)} missing")
        if self.extra:
            parts.append(f"{len(self.extra)} extra")
        if self.size_mismatch:
            parts.append(f"{len(self.size_mismatch)} size mismatch")
        if self.hash_mismatch:
            parts.append(f"{len(self.hash_mismatch)} hash mismatch")
        if self.unreadable:
            parts.append(f"{len(self.unreadable)} unreadable")
        return ", ".join(parts)


def run_verify(
    target_path: Union[str, Path],
    manifest: Union[str, Path, ManifestData],
    quick: bool = False,
    ignore_patterns: Optional[List[str]] = None,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> VerifyResult:
    """
    Verify a target folder against a manifest.
    """
    start_time = time.time()
    abs_target = os.path.abspath(str(target_path))

    if not os.path.exists(abs_target):
        raise FileNotFoundError(f"Target folder not found: {target_path}")
    if not os.path.isdir(abs_target):
        raise NotADirectoryError(f"Target path is not a directory: {target_path}")

    # Load manifest if path given
    if isinstance(manifest, ManifestData):
        manifest_data = manifest
        manifest_p_masked = "<MEMORY>"
    else:
        manifest_data = load_manifest(manifest)
        manifest_p_masked = mask_path(str(manifest))

    active_ignores = list(DEFAULT_IGNORE)
    if ignore_patterns:
        active_ignores.extend(ignore_patterns)

    # Build manifest lookup: normalize paths with lowercase key for case-insensitive matching
    # key: lower_rel_path -> { "path": orig_path, "size": size, "hash": hash }
    manifest_map: Dict[str, Dict[str, Any]] = {}
    for entry in manifest_data.files:
        p_norm = normalize_rel_path(entry["path"])
        manifest_map[p_norm.lower()] = {
            "path": p_norm,
            "size": entry["size"],
            "hash": entry["hash"].lower(),
        }

    # Discover all actual files on disk
    disk_files: Dict[str, Dict[str, Any]] = {}  # lower_p -> {"path": rel_p, "full_path": full_p}
    for root, dirs, files in os.walk(abs_target, topdown=True, followlinks=False):
        check_cancelled(cancel_event)
        dirs[:] = [d for d in dirs if not should_ignore(d, active_ignores)]

        for fname in files:
            check_cancelled(cancel_event)
            if should_ignore(fname, active_ignores):
                continue
            full_p = os.path.join(root, fname)
            rel_p = normalize_rel_path(os.path.relpath(full_p, abs_target))
            disk_files[rel_p.lower()] = {
                "path": rel_p,
                "full_path": full_p,
            }

    result = VerifyResult(
        target_path=mask_path(abs_target),
        manifest_path=manifest_p_masked,
        algo=manifest_data.algo,
        quick=quick,
    )

    total_items = len(manifest_map)
    processed = 0

    # 1. Check each manifest entry against disk
    for lower_p, man_entry in manifest_map.items():
        check_cancelled(cancel_event)
        processed += 1
        if progress:
            progress(processed, total_items, man_entry["path"])

        if lower_p not in disk_files:
            result.missing.append({
                "path": man_entry["path"],
                "expected_size": man_entry["size"],
                "expected_hash": man_entry["hash"],
            })
            continue

        disk_info = disk_files[lower_p]
        full_p = disk_info["full_path"]

        # Check readable and size
        try:
            actual_size = get_file_size(full_p)
        except Exception as e:
            result.unreadable.append({
                "path": disk_info["path"],
                "error": str(e),
            })
            continue

        if actual_size != man_entry["size"]:
            result.size_mismatch.append({
                "path": disk_info["path"],
                "expected_size": man_entry["size"],
                "actual_size": actual_size,
            })
            continue

        if quick:
            # Quick mode: presence and size matched, skip hash
            result.ok.append({
                "path": disk_info["path"],
                "size": actual_size,
            })
            continue

        # Full verification: compute hash
        try:
            actual_hash = hash_file(
                full_p,
                algo=manifest_data.algo,
                cancel_event=cancel_event,
                total_bytes_hint=actual_size,
            )
        except Exception as e:
            result.unreadable.append({
                "path": disk_info["path"],
                "error": str(e),
            })
            continue

        if actual_hash.lower() != man_entry["hash"]:
            result.hash_mismatch.append({
                "path": disk_info["path"],
                "expected_hash": man_entry["hash"],
                "actual_hash": actual_hash,
                "size": actual_size,
            })
        else:
            result.ok.append({
                "path": disk_info["path"],
                "size": actual_size,
                "hash": actual_hash,
            })

    # 2. Check for extra files on disk not present in manifest
    for lower_p, disk_info in disk_files.items():
        if lower_p not in manifest_map:
            try:
                sz = get_file_size(disk_info["full_path"])
            except Exception:
                sz = 0
            result.extra.append({
                "path": disk_info["path"],
                "size": sz,
            })

    # Sort each category by path for deterministic report
    result.ok.sort(key=lambda x: x["path"])
    result.missing.sort(key=lambda x: x["path"])
    result.extra.sort(key=lambda x: x["path"])
    result.size_mismatch.sort(key=lambda x: x["path"])
    result.hash_mismatch.sort(key=lambda x: x["path"])
    result.unreadable.sort(key=lambda x: x["path"])

    result.duration_seconds = time.time() - start_time
    return result
