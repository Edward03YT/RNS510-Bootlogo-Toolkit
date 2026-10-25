"""
ISO image scanning and verification module.
Uses pycdlib to read ISO9660, Joliet, and UDF filesystems without extracting to disk.
Streams multi-gigabyte discs in chunks, detects truncation, reads every file,
and optionally compares ISO content against a local reference folder.
"""

import os
import io
import time
import hashlib
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union

import pycdlib

from mapverify.common import (
    CHUNK_SIZE,
    DEFAULT_IGNORE,
    ProgressCallback,
    should_ignore,
    normalize_rel_path,
    get_file_size,
    mask_path,
    check_cancelled,
)
from mapverify.compare import run_compare, CompareResult
from mapverify.hashing import hash_file


class StreamingHasher:
    """
    Streaming file-like receiver for pycdlib.get_file_from_iso_fp.
    Computes cryptographic hash and counts bytes without loading file into RAM.
    """
    def __init__(
        self,
        algo: str = "sha256",
        progress: Optional[ProgressCallback] = None,
        cancel_event: Optional[threading.Event] = None,
        file_path: str = "",
        total_hint: int = 0,
    ):
        self.hasher = hashlib.new(algo.lower())
        self.bytes_written = 0
        self.progress = progress
        self.cancel_event = cancel_event
        self.file_path = file_path
        self.total_hint = total_hint

    def write(self, data: bytes) -> int:
        check_cancelled(self.cancel_event)
        self.hasher.update(data)
        self.bytes_written += len(data)
        if self.progress:
            self.progress(self.bytes_written, self.total_hint, self.file_path)
        return len(data)

    def hexdigest(self) -> str:
        return self.hasher.hexdigest()


@dataclass
class IsoScanResult:
    target_path: str
    disk_size: int = 0
    implied_size: int = 0
    is_truncated: bool = False
    has_joliet: bool = False
    has_udf: bool = False
    has_rock_ridge: bool = False
    total_files: int = 0
    total_bytes: int = 0
    files: List[Dict[str, Any]] = field(default_factory=list)
    failed_files: List[Dict[str, Any]] = field(default_factory=list)
    comparison: Optional[CompareResult] = None
    is_mounted_disc: bool = False
    duration_seconds: float = 0.0

    @property
    def has_problems(self) -> bool:
        if self.is_truncated or self.failed_files:
            return True
        if self.comparison and self.comparison.has_problems:
            return True
        return False


def scan_iso(
    target_path: Union[str, Path],
    against_folder: Optional[Union[str, Path]] = None,
    algo: str = "sha256",
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> IsoScanResult:
    """
    Scan an ISO image (or mounted disc folder), verifying all files and volume descriptors.
    """
    start_time = time.time()
    abs_target = os.path.abspath(str(target_path))

    if not os.path.exists(abs_target):
        raise FileNotFoundError(f"Target not found: {target_path}")

    masked_target = mask_path(abs_target)

    # 1. Handle mounted disc / drive folder
    if os.path.isdir(abs_target):
        if against_folder:
            cmp_res = run_compare(
                path_a=against_folder,
                path_b=abs_target,
                algo=algo,
                progress=progress,
                cancel_event=cancel_event,
            )
        else:
            cmp_res = None

        duration = time.time() - start_time
        return IsoScanResult(
            target_path=masked_target,
            is_mounted_disc=True,
            comparison=cmp_res,
            duration_seconds=duration,
        )

    # 2. Raw ISO file scanning via pycdlib
    disk_size = os.path.getsize(abs_target)

    iso = pycdlib.PyCdlib()
    try:
        iso.open(abs_target)
    except Exception as e:
        return IsoScanResult(
            target_path=masked_target,
            disk_size=disk_size,
            is_truncated=True,
            failed_files=[{"path": "[ISO_HEADER]", "error": str(e)}],
            duration_seconds=time.time() - start_time,
        )

    # Volume descriptor sizes
    implied_size = 0
    try:
        if hasattr(iso, "pvd") and iso.pvd:
            implied_size = iso.pvd.space_size * iso.logical_block_size
    except Exception:
        implied_size = 0

    is_truncated = (disk_size < implied_size) if implied_size > 0 else False

    has_joliet = iso.has_joliet()
    has_udf = iso.has_udf()
    has_rr = iso.has_rock_ridge()

    files_list: List[Dict[str, Any]] = []
    failed_files: List[Dict[str, Any]] = []

    # Choose best filesystem layer to walk
    if has_joliet:
        walk_iter = iso.walk(joliet_path="/")
        path_arg_name = "joliet_path"
    elif has_udf:
        walk_iter = iso.walk(udf_path="/")
        path_arg_name = "udf_path"
    else:
        walk_iter = iso.walk(iso_path="/")
        path_arg_name = "iso_path"

    # Walk directory records in ISO
    discovered_iso_files: List[Dict[str, Any]] = []
    for dirname, dirlist, filelist in walk_iter:
        check_cancelled(cancel_event)
        for fname in filelist:
            check_cancelled(cancel_event)
            # Remove ISO9660 version suffix ';1' if present
            clean_display_name = fname.split(";")[0]
            if dirname == "/":
                iso_rel = clean_display_name
                iso_walk_path = f"/{fname}"
            else:
                iso_rel = f"{dirname.strip('/')}/{clean_display_name}"
                iso_walk_path = f"{dirname}/{fname}"

            discovered_iso_files.append({
                "rel_path": normalize_rel_path(iso_rel),
                "walk_path": iso_walk_path,
            })

    total_bytes = 0
    # Read every file completely through the library
    for item in discovered_iso_files:
        check_cancelled(cancel_event)
        rel_p = item["rel_path"]
        w_path = item["walk_path"]

        hasher = StreamingHasher(
            algo=algo,
            progress=progress,
            cancel_event=cancel_event,
            file_path=rel_p,
        )

        try:
            kwargs = {path_arg_name: w_path}
            iso.get_file_from_iso_fp(hasher, **kwargs)
            file_hash = hasher.hexdigest()
            file_size = hasher.bytes_written
            files_list.append({
                "path": rel_p,
                "size": file_size,
                "hash": file_hash,
            })
            total_bytes += file_size
        except Exception as e:
            failed_files.append({
                "path": rel_p,
                "error": str(e),
            })

    iso.close()

    files_list.sort(key=lambda x: x["path"])
    failed_files.sort(key=lambda x: x["path"])

    # 3. Optional comparison against a reference folder
    comparison_result = None
    if against_folder:
        abs_folder = os.path.abspath(str(against_folder))
        active_ignores = list(DEFAULT_IGNORE)
        folder_files: Dict[str, Dict[str, Any]] = {}

        for root, dirs, files in os.walk(abs_folder, topdown=True):
            check_cancelled(cancel_event)
            dirs[:] = [d for d in dirs if not should_ignore(d, active_ignores)]
            for fn in files:
                check_cancelled(cancel_event)
                if should_ignore(fn, active_ignores):
                    continue
                fp = os.path.join(root, fn)
                rel_fn = normalize_rel_path(os.path.relpath(fp, abs_folder))
                folder_files[rel_fn.lower()] = {
                    "path": rel_fn,
                    "full_path": fp,
                    "size": get_file_size(fp),
                }

        comparison_result = CompareResult(
            path_a=mask_path(abs_folder),
            path_b=masked_target,
            algo=algo,
        )

        iso_file_map = {f["path"].lower(): f for f in files_list}

        # Check folder files against ISO files
        for lower_k, f_info in folder_files.items():
            if lower_k not in iso_file_map:
                comparison_result.missing.append({
                    "path": f_info["path"],
                    "size_a": f_info["size"],
                })
                continue

            iso_entry = iso_file_map[lower_k]
            if f_info["size"] != iso_entry["size"]:
                comparison_result.size_mismatch.append({
                    "path": f_info["path"],
                    "size_a": f_info["size"],
                    "size_b": iso_entry["size"],
                })
                continue

            # Compute folder file hash
            folder_hash = hash_file(f_info["full_path"], algo=algo, cancel_event=cancel_event)
            if folder_hash != iso_entry["hash"]:
                comparison_result.hash_mismatch.append({
                    "path": f_info["path"],
                    "size": f_info["size"],
                    "hash_a": folder_hash,
                    "hash_b": iso_entry["hash"],
                })
            else:
                comparison_result.ok.append({
                    "path": f_info["path"],
                    "size": f_info["size"],
                    "hash": folder_hash,
                })

        # Extra files in ISO not in reference folder
        for lower_k, iso_entry in iso_file_map.items():
            if lower_k not in folder_files:
                comparison_result.extra.append({
                    "path": iso_entry["path"],
                    "size": iso_entry["size"],
                })

        for failed in failed_files:
            comparison_result.unreadable.append({
                "path": failed["path"],
                "source": "ISO",
                "error": failed["error"],
            })

    duration = time.time() - start_time
    return IsoScanResult(
        target_path=masked_target,
        disk_size=disk_size,
        implied_size=implied_size,
        is_truncated=is_truncated,
        has_joliet=has_joliet,
        has_udf=has_udf,
        has_rock_ridge=has_rr,
        total_files=len(files_list),
        total_bytes=total_bytes,
        files=files_list,
        failed_files=failed_files,
        comparison=comparison_result,
        duration_seconds=duration,
    )
