"""
Manifest creation, serialization, and validation module.
Creates diffable JSON manifests with streaming file hashing and multi-worker support.
"""

import os
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Union

from mapverify.common import (
    __version__,
    DEFAULT_IGNORE,
    ProgressCallback,
    should_ignore,
    normalize_rel_path,
    get_file_size,
    check_cancelled,
)
from mapverify.hashing import hash_file, SUPPORTED_ALGOS


@dataclass
class ManifestData:
    tool: str = "mapverify"
    version: str = __version__
    created: str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    algo: str = "sha256"
    root_name: str = ""
    total_files: int = 0
    total_bytes: int = 0
    files: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert manifest to standard dictionary matching spec schema."""
        return {
            "tool": self.tool,
            "version": self.version,
            "created": self.created,
            "algo": self.algo,
            "root_name": self.root_name,
            "total_files": self.total_files,
            "total_bytes": self.total_bytes,
            "files": sorted(self.files, key=lambda x: x["path"]),
        }

    def to_json(self, indent: int = 2) -> str:
        """Render manifest as formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def save(self, file_path: Union[str, Path]) -> None:
        """Save manifest to a JSON file."""
        with open(str(file_path), "w", encoding="utf-8") as f:
            f.write(self.to_json(indent=2))


def load_manifest(manifest_path: Union[str, Path]) -> ManifestData:
    """
    Load and validate a manifest file from disk.
    Raises FileNotFoundError if missing, ValueError if invalid schema.
    """
    path_str = str(manifest_path)
    if not os.path.exists(path_str):
        raise FileNotFoundError(f"Manifest file not found: {path_str}")

    try:
        with open(path_str, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in manifest file '{path_str}': {e}")

    # Validate required schema fields
    required = ("tool", "version", "algo", "root_name", "total_files", "total_bytes", "files")
    for key in required:
        if key not in data:
            raise ValueError(f"Manifest schema error: missing required key '{key}'")

    if not isinstance(data["files"], list):
        raise ValueError("Manifest schema error: 'files' must be a list")

    return ManifestData(
        tool=data.get("tool", "mapverify"),
        version=data.get("version", __version__),
        created=data.get("created", ""),
        algo=data.get("algo", "sha256"),
        root_name=data.get("root_name", ""),
        total_files=int(data.get("total_files", 0)),
        total_bytes=int(data.get("total_bytes", 0)),
        files=data.get("files", []),
    )


def create_manifest(
    folder_path: Union[str, Path],
    algo: str = "sha256",
    workers: Optional[int] = None,
    ignore_patterns: Optional[List[str]] = None,
    progress: Optional[ProgressCallback] = None,
    cancel_event: Optional[threading.Event] = None,
) -> ManifestData:
    """
    Hash every file in a folder and generate a ManifestData object.
    Uses worker threads for streaming hashing and reports cumulative progress.
    """
    abs_folder = os.path.abspath(str(folder_path))
    if not os.path.exists(abs_folder):
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    if not os.path.isdir(abs_folder):
        raise NotADirectoryError(f"Path is not a directory: {folder_path}")

    algo_lower = algo.lower()
    if algo_lower not in SUPPORTED_ALGOS:
        raise ValueError(f"Unsupported algorithm '{algo}'. Supported: {', '.join(SUPPORTED_ALGOS)}")

    root_name = os.path.basename(os.path.normpath(abs_folder)) or "ROOT"

    active_ignores = list(DEFAULT_IGNORE)
    if ignore_patterns:
        active_ignores.extend(ignore_patterns)

    # Step 1: Discover all files
    discovered: List[Dict[str, Any]] = []
    total_bytes = 0

    for root, dirs, files in os.walk(abs_folder, topdown=True, followlinks=False):
        check_cancelled(cancel_event)

        # Filter ignored dirs in place
        dirs[:] = [d for d in dirs if not should_ignore(d, active_ignores)]

        for fname in files:
            check_cancelled(cancel_event)
            if should_ignore(fname, active_ignores):
                continue

            full_p = os.path.join(root, fname)
            rel_p = normalize_rel_path(os.path.relpath(full_p, abs_folder))
            sz = get_file_size(full_p)
            discovered.append({
                "path": rel_p,
                "size": sz,
                "full_path": full_p,
            })
            total_bytes += sz

    # Sort files by path for deterministic order
    discovered.sort(key=lambda x: x["path"])
    total_files = len(discovered)

    # Step 2: Hash files with worker pool
    if workers is None or workers <= 0:
        max_workers = min(4, os.cpu_count() or 1)
    else:
        max_workers = workers

    progress_lock = threading.Lock()
    bytes_done = [0]
    files_result: List[Dict[str, Any]] = []
    errors: List[str] = []

    def _hash_worker(item: Dict[str, Any]) -> Dict[str, Any]:
        check_cancelled(cancel_event)

        def _worker_progress(chunk_done: int, file_total: int, curr_p: str):
            with progress_lock:
                current_total_done = bytes_done[0] + chunk_done
                if progress:
                    progress(current_total_done, total_bytes, item["path"])

        file_hash = hash_file(
            file_path=item["full_path"],
            algo=algo_lower,
            progress=_worker_progress,
            cancel_event=cancel_event,
            total_bytes_hint=item["size"],
        )

        with progress_lock:
            bytes_done[0] += item["size"]
            if progress:
                progress(bytes_done[0], total_bytes, item["path"])

        return {
            "path": item["path"],
            "size": item["size"],
            "hash": file_hash,
        }

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_hash_worker, item): item for item in discovered}
        for future in as_completed(futures):
            check_cancelled(cancel_event)
            try:
                res = future.result()
                files_result.append(res)
            except Exception as e:
                item = futures[future]
                errors.append(f"Error hashing {item['path']}: {e}")
                raise

    files_result.sort(key=lambda x: x["path"])

    return ManifestData(
        algo=algo_lower,
        root_name=root_name,
        total_files=total_files,
        total_bytes=total_bytes,
        files=files_result,
    )
