"""
Folder comparison module: compares two trees directly (pathA = reference, pathB = target/SD).
Categorizes into: ok, missing, extra, size_mismatch, hash_mismatch, unreadable.
Includes cache-flushing eject/reinsert notice for removable media.
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

EJECT_NOTICE_EN = "For a trustworthy result, safely eject the card, reinsert it, then continue."
EJECT_NOTICE_RO = "Pentru un rezultat de încredere, deconectați în siguranță cardul, reintroduceți-l, apoi continuați."


@dataclass
class CompareResult:
    path_a: str
    path_b: str
    algo: str = "sha256"
    quick: bool = False
    duration_seconds: float = 0.0
    user_confirmed_eject: Optional[bool] = None
    ok: List[Dict[str, Any]] = field(default_factory=list)
    missing: List[Dict[str, Any]] = field(default_factory=list)
    extra: List[Dict[str, Any]] = field(default_factory=list)
    size_mismatch: List[Dict[str, Any]] = field(default_factory=list)
    hash_mismatch: List[Dict[str, Any]] = field(default_factory=list)
    unreadable: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def has_problems(self) -> bool:
        """True if any discrepancies or errors were detected."""
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


def _scan_tree(
    root_path: str,
    ignore_patterns: List[str],
    cancel_event: Optional[threading.Event],
) -> Dict[str, Dict[str, Any]]:
    """Scan a folder tree and return map of lower_rel_path -> {path, full_path, size}."""
    files_map: Dict[str, Dict[str, Any]] = {}
    for root, dirs, files in os.walk(root_path, topdown=True, followlinks=False):
        check_cancelled(cancel_event)
        dirs[:] = [d for d in dirs if not should_ignore(d, ignore_patterns)]

        for fname in files:
            check_cancelled(cancel_event)
            if should_ignore(fname, ignore_patterns):
                continue
            full_p = os.path.join(root, fname)
            rel_p = normalize_rel_path(os.path.relpath(full_p, root_path))
            lower_k = rel_p.lower()
            try:
                sz = get_file_size(full_p)
                err = None
            except Exception as e:
                sz = 0
                err = str(e)

            files_map[lower_k] = {
                "path": rel_p,
                "full_path": full_p,
                "size": sz,
                "error": err,
            }
    return files_map


def run_compare(
    path_a: Union[str, Path],
    path_b: Union[str, Path],
    quick: bool = False,
    algo: str = "sha256",
    user_confirmed_eject: Optional[bool] = None,
    ignore_patterns: Optional[List[str]] = None,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> CompareResult:
    """
    Directly compare folder A (reference) against folder B (target).
    """
    start_time = time.time()
    abs_a = os.path.abspath(str(path_a))
    abs_b = os.path.abspath(str(path_b))

    if not os.path.exists(abs_a):
        raise FileNotFoundError(f"Reference folder (A) not found: {path_a}")
    if not os.path.isdir(abs_a):
        raise NotADirectoryError(f"Reference path (A) is not a directory: {path_a}")

    if not os.path.exists(abs_b):
        raise FileNotFoundError(f"Target folder (B) not found: {path_b}")
    if not os.path.isdir(abs_b):
        raise NotADirectoryError(f"Target path (B) is not a directory: {path_b}")

    active_ignores = list(DEFAULT_IGNORE)
    if ignore_patterns:
        active_ignores.extend(ignore_patterns)

    # Scan trees A and B
    files_a = _scan_tree(abs_a, active_ignores, cancel_event)
    files_b = _scan_tree(abs_b, active_ignores, cancel_event)

    result = CompareResult(
        path_a=mask_path(abs_a),
        path_b=mask_path(abs_b),
        algo=algo,
        quick=quick,
        user_confirmed_eject=user_confirmed_eject,
    )

    total_items = len(files_a)
    processed = 0

    # Compare items from A against B
    for lower_k, info_a in files_a.items():
        check_cancelled(cancel_event)
        processed += 1
        if progress:
            progress(processed, total_items, info_a["path"])

        if info_a["error"]:
            result.unreadable.append({
                "path": info_a["path"],
                "source": "A",
                "error": info_a["error"],
            })
            continue

        if lower_k not in files_b:
            result.missing.append({
                "path": info_a["path"],
                "size_a": info_a["size"],
            })
            continue

        info_b = files_b[lower_k]
        if info_b["error"]:
            result.unreadable.append({
                "path": info_b["path"],
                "source": "B",
                "error": info_b["error"],
            })
            continue

        if info_a["size"] != info_b["size"]:
            result.size_mismatch.append({
                "path": info_a["path"],
                "size_a": info_a["size"],
                "size_b": info_b["size"],
            })
            continue

        if quick:
            result.ok.append({
                "path": info_a["path"],
                "size": info_a["size"],
            })
            continue

        # Full content comparison via hashing
        try:
            hash_a = hash_file(info_a["full_path"], algo=algo, cancel_event=cancel_event)
        except Exception as e:
            result.unreadable.append({"path": info_a["path"], "source": "A", "error": str(e)})
            continue

        try:
            hash_b = hash_file(info_b["full_path"], algo=algo, cancel_event=cancel_event)
        except Exception as e:
            result.unreadable.append({"path": info_b["path"], "source": "B", "error": str(e)})
            continue

        if hash_a != hash_b:
            result.hash_mismatch.append({
                "path": info_a["path"],
                "size": info_a["size"],
                "hash_a": hash_a,
                "hash_b": hash_b,
            })
        else:
            result.ok.append({
                "path": info_a["path"],
                "size": info_a["size"],
                "hash": hash_a,
            })

    # Extra items in B not in A
    for lower_k, info_b in files_b.items():
        if lower_k not in files_a:
            result.extra.append({
                "path": info_b["path"],
                "size": info_b["size"],
            })

    result.ok.sort(key=lambda x: x["path"])
    result.missing.sort(key=lambda x: x["path"])
    result.extra.sort(key=lambda x: x["path"])
    result.size_mismatch.sort(key=lambda x: x["path"])
    result.hash_mismatch.sort(key=lambda x: x["path"])
    result.unreadable.sort(key=lambda x: x["path"])

    result.duration_seconds = time.time() - start_time
    return result
