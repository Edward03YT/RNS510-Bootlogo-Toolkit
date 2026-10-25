"""
Report module for rendering verification, comparison, hashing, archive testing,
and reconnaissance results.
Supports three outputs: Console text, Markdown (.md), and JSON (.json).
Ensures strict privacy protection by masking absolute paths and usernames.
"""

import os
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Union

from mapverify.common import __version__, mask_path, format_bytes
from mapverify.i18n import t

CONSOLE_TRUNCATION_LIMIT = 200


@dataclass
class Report:
    command: str
    verdict: str  # e.g. "OK", "PROBLEMS_FOUND", "MATCH", "MISMATCH", "PASS", "FAIL"
    arguments: Dict[str, Any] = field(default_factory=dict)
    summary: Dict[str, Any] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)
    problems: List[Dict[str, Any]] = field(default_factory=list)
    created: str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to JSON-serializable dictionary with masked paths."""
        masked_args = {}
        for k, v in self.arguments.items():
            if isinstance(v, (str, os.PathLike)) and ("/" in str(v) or "\\" in str(v)):
                masked_args[k] = mask_path(str(v))
            else:
                masked_args[k] = v

        return {
            "tool": "mapverify",
            "version": __version__,
            "command": self.command,
            "created": self.created,
            "duration_seconds": round(self.duration_seconds, 3),
            "verdict": self.verdict,
            "arguments": masked_args,
            "summary": self.summary,
            "details": self.details,
            "problems": self.problems,
        }

    def to_json(self, indent: int = 2) -> str:
        """Render report as formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def save_json(self, file_path: str) -> None:
        """Save report to JSON file."""
        content = self.to_json()
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    def to_markdown(self, lang: str = "ro") -> str:
        """Render report in GitHub Flavored Markdown format."""
        lines: List[str] = []

        title_key = "recon_title"
        if self.command == "verify":
            title_key = "verify_title"
        elif self.command == "compare":
            title_key = "compare_title"
        elif self.command == "hash-file":
            title_key = "hash_file_title"
        elif self.command == "archive-test":
            title_key = "archive_title"
        elif self.command == "iso":
            title_key = "iso_title"
        elif self.command == "card-test":
            title_key = "card_test_title"

        # Title
        lines.append(f"# {t('tool_title', lang)} — {t(title_key, lang)}")
        lines.append("")

        # Metadata Header
        lines.append(f"- **{t('command', lang)}:** `{self.command}`")
        lines.append(f"- **{t('version', lang)}:** `{__version__}`")
        lines.append(f"- **{t('date', lang)}:** `{self.created}`")
        lines.append(f"- **{t('duration', lang)}:** `{self.duration_seconds:.2f}s`")
        lines.append(f"- **{t('verdict', lang)}:** **{self.verdict}**")
        lines.append(f"- *{t('privacy_note', lang)}*")
        lines.append("")

        # Section 0 Limits & Disclaimers
        lines.append(f"> [!NOTE]")
        lines.append(f"> **{t('limits_title', lang)}**")
        lines.append(f"> - {t('limit_internal_drive', lang)}")
        lines.append(f"> - {t('limit_manifest_needed', lang)}")
        lines.append(f"> - {t('limit_no_maps_shipped', lang)}")
        lines.append("")

        if self.command == "recon":
            self._render_recon_markdown(lines, lang)
        elif self.command in ("verify", "compare"):
            self._render_verify_compare_markdown(lines, lang)
        elif self.command == "hash-file":
            self._render_hash_file_markdown(lines, lang)
        elif self.command == "archive-test":
            self._render_archive_test_markdown(lines, lang)
        elif self.command == "iso":
            self._render_iso_markdown(lines, lang)
        elif self.command == "card-test":
            self._render_card_test_markdown(lines, lang)

        return "\n".join(lines)

    def _render_recon_markdown(self, lines: List[str], lang: str) -> None:
        total_b = self.summary.get("total_bytes", 0)
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        lines.append(f"| # | Metric | Value |")
        lines.append("|---|---|---|")
        lines.append(f"| 1 | **{t('target', lang)}** | `{self.summary.get('target_path', '')}` |")
        lines.append(f"| 2 | **{t('total_files', lang)}** | {self.summary.get('total_files', 0):,} |")
        lines.append(f"| 3 | **{t('total_dirs', lang)}** | {self.summary.get('total_directories', 0):,} |")
        lines.append(f"| 4 | **{t('total_size', lang)}** | {format_bytes(total_b)} |")
        lines.append(f"| 5 | **{t('fingerprint', lang)}** | `{self.summary.get('fingerprint', '')}` |")
        lines.append("")
        lines.append(f"> *{t('fingerprint_desc', lang)}*")
        lines.append("")

        # Tree Structure
        tree = self.details.get("tree", [])
        if tree:
            depth_arg = self.arguments.get("depth", 3)
            lines.append(f"## {t('dir_tree', lang, depth=depth_arg)}")
            lines.append("")
            lines.append(
                f"| {t('col_depth', lang)} | {t('col_path', lang)} | "
                f"{t('col_direct_files', lang)} | {t('col_direct_size', lang)} | "
                f"{t('col_total_files', lang)} | {t('col_total_size', lang)} |"
            )
            lines.append("|---|---|---|---|---|---|")
            for node in tree:
                p = node.get("path", ".")
                d = node.get("depth", 0)
                indent = "&nbsp;" * (d * 4)
                p_display = f"{indent}`{p}`" if p != "." else "`[ROOT]`"
                lines.append(
                    f"| {d} | {p_display} | "
                    f"{node.get('direct_files', 0):,} | {format_bytes(node.get('direct_bytes', 0))} | "
                    f"{node.get('total_files', 0):,} | {format_bytes(node.get('total_bytes', 0))} |"
                )
            lines.append("")

        # Extension Histogram Table
        hist = self.details.get("extension_histogram", {})
        if hist:
            lines.append(f"## {t('extension_histogram', lang)}")
            lines.append("")
            lines.append(
                f"| {t('col_extension', lang)} | {t('col_count', lang)} | "
                f"{t('col_bytes', lang)} | {t('col_percent', lang)} |"
            )
            lines.append("|---|---|---|---|")
            for ext, stats in hist.items():
                ext_name = t('no_extension', lang) if ext == "(none)" else f"`{ext}`"
                cnt = stats.get("count", 0)
                bts = stats.get("bytes", 0)
                pct = (bts / total_b * 100) if total_b > 0 else 0
                lines.append(f"| {ext_name} | {cnt:,} | {format_bytes(bts)} | {pct:.2f}% |")
            lines.append("")

        # 20 Largest Files
        largest = self.details.get("largest_files", [])
        if largest:
            lines.append(f"## {t('largest_files', lang)}")
            lines.append("")
            lines.append(f"| # | {t('col_path', lang)} | {t('col_bytes', lang)} |")
            lines.append("|---|---|---|")
            for idx, item in enumerate(largest, 1):
                lines.append(f"| {idx} | `{item.get('path')}` | {format_bytes(item.get('size', 0))} |")
            lines.append("")

        # Zero-Byte Files
        zero_files = self.details.get("zero_byte_files", [])
        lines.append(f"## {t('zero_byte_files', lang)}")
        lines.append("")
        if zero_files:
            lines.append(f"> [!WARNING]")
            lines.append(f"> {len(zero_files)} zero-byte files detected.")
            lines.append("")
            for zf in zero_files:
                lines.append(f"- `{zf.get('path')}`")
        else:
            lines.append(f"*{t('no_zero_byte_files', lang)}*")
        lines.append("")

        # Manifest Candidates
        manifests = self.details.get("manifest_candidates", [])
        lines.append(f"## {t('manifest_candidates', lang)}")
        lines.append("")
        if manifests:
            for mc in manifests:
                lines.append(f"### `{mc.get('path')}` ({format_bytes(mc.get('size', 0))})")
                if mc.get("first_5_lines"):
                    lines.append(f"{t('preview_first_5_lines', lang)}")
                    lines.append("```text")
                    for l in mc["first_5_lines"]:
                        lines.append(l)
                    lines.append("```")
                elif mc.get("note") == "file_larger_than_64k":
                    lines.append(f"*{t('file_too_large_preview', lang)}*")
                elif mc.get("error"):
                    lines.append(f"*Error reading file: {mc.get('error')}*")
                lines.append("")
        else:
            lines.append(f"*{t('no_manifest_candidates', lang)}*")
            lines.append("")

        # Informational Flags
        flags = self.details.get("flags", {})
        lines.append(f"## {t('flags_title', lang)}")
        lines.append("")

        has_flag = False
        if flags.get("files_over_4gb"):
            has_flag = True
            lines.append(f"### {t('flag_over_4gb', lang)}")
            for item in flags["files_over_4gb"]:
                lines.append(f"- `{item['path']}` — {format_bytes(item['size'])}")
            lines.append("")

        if flags.get("paths_over_240_chars"):
            has_flag = True
            lines.append(f"### {t('flag_paths_over_240', lang)}")
            for p in flags["paths_over_240_chars"]:
                lines.append(f"- `{p}` ({len(p)} chars)")
            lines.append("")

        if flags.get("non_ascii_names"):
            has_flag = True
            lines.append(f"### {t('flag_non_ascii', lang)}")
            for p in flags["non_ascii_names"]:
                lines.append(f"- `{p}`")
            lines.append("")

        if flags.get("case_collisions"):
            has_flag = True
            lines.append(f"### {t('flag_case_collisions', lang)}")
            for cc in flags["case_collisions"]:
                lines.append(f"- Directory `{cc['directory']}`: {', '.join(f'`{n}`' for n in cc['colliding_names'])}")
            lines.append("")

        if flags.get("non_iso9660_chars"):
            has_flag = True
            lines.append(f"### {t('flag_non_iso9660', lang)}")
            lines.append(f"*Total files with characters outside ISO9660: {len(flags['non_iso9660_chars'])}*")
            for p in flags["non_iso9660_chars"][:30]:
                lines.append(f"- `{p}`")
            if len(flags["non_iso9660_chars"]) > 30:
                lines.append(f"- ... and {len(flags['non_iso9660_chars']) - 30} more")
            lines.append("")

        card_comp = flags.get("card_comparison", {})
        if card_comp:
            lines.append(f"### {t('flag_card_sizes', lang)}")
            lines.append("")
            lines.append(f"| Card Size | Nominal Capacity | Fits? | Usage |")
            lines.append("|---|---|---|---|")
            for card_label, cinfo in card_comp.items():
                fits_icon = "✅ Yes" if cinfo["fits"] else "❌ No"
                lines.append(
                    f"| {card_label} | {format_bytes(cinfo['capacity_bytes'])} | "
                    f"{fits_icon} | {cinfo['percent_used']}% |"
                )
            lines.append("")

        if not has_flag:
            lines.append(f"*{t('no_flags', lang)}*")
            lines.append("")

    def _render_verify_compare_markdown(self, lines: List[str], lang: str) -> None:
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        summary_line = self.summary.get("summary_line", "")
        if summary_line:
            lines.append(f"> **Status:** `{summary_line}`")
            lines.append("")

        counts = self.summary.get("counts", {})
        lines.append("| Category | Count |")
        lines.append("|---|---|")
        for cat in ("ok", "missing", "extra", "size_mismatch", "hash_mismatch", "unreadable"):
            lines.append(f"| **{t('cat_' + cat, lang)}** | {counts.get(cat, 0):,} |")
        lines.append("")

        if self.command == "compare" and "user_confirmed_eject" in self.summary:
            confirmed = self.summary["user_confirmed_eject"]
            if confirmed is True:
                lines.append(f"- *{t('eject_notice_confirmed', lang)}*")
            elif confirmed is False or confirmed is None:
                lines.append(f"- *{t('eject_notice_skipped', lang)}*")
            lines.append("")

        # Render problem tables
        for cat in ("missing", "extra", "size_mismatch", "hash_mismatch", "unreadable"):
            items = self.details.get(cat, [])
            if items:
                lines.append(f"### {t('cat_' + cat, lang)} ({len(items)})")
                lines.append("")
                lines.append("| Path | Details |")
                lines.append("|---|---|")
                for it in items:
                    p = it.get("path", "")
                    details_str = ", ".join(f"{k}: {v}" for k, v in it.items() if k != "path")
                    lines.append(f"| `{p}` | {details_str} |")
                lines.append("")

    def _render_hash_file_markdown(self, lines: List[str], lang: str) -> None:
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        lines.append(f"- **{t('target', lang)}:** `{self.summary.get('file_path', '')}`")
        lines.append(f"- **{t('detected_algo', lang)}:** `{self.summary.get('algo', '')}`")
        lines.append(f"- **{t('expected_hash', lang)}:** `{self.summary.get('expected_hash', '')}`")
        lines.append(f"- **{t('actual_hash', lang)}:** `{self.summary.get('actual_hash', '')}`")
        lines.append(f"- **{t('verdict', lang)}:** `{self.verdict}`")
        lines.append("")
        if self.verdict == "MATCH":
            lines.append(f"> [!TIP]\n> {t('hash_match_msg', lang)}")
        else:
            lines.append(f"> [!WARNING]\n> {t('hash_mismatch_msg', lang)}")
        lines.append("")

    def _render_archive_test_markdown(self, lines: List[str], lang: str) -> None:
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        lines.append(f"- **{t('target', lang)}:** `{self.summary.get('file_path', '')}`")
        lines.append(f"- **{t('archive_type', lang)}:** `{self.summary.get('archive_type', '')}`")
        lines.append(f"- **{t('archive_total_members', lang)}:** {self.summary.get('total_members', 0)}")
        lines.append(f"- **{t('archive_tested_members', lang)}:** {self.summary.get('tested_members', 0)}")
        lines.append(f"- **{t('verdict', lang)}:** `{self.verdict}`")
        lines.append(f"- **Message:** {self.summary.get('message', '')}")
        lines.append("")
        bad = self.details.get("bad_members", [])
        if bad:
            lines.append(f"### {t('archive_bad_members', lang)} ({len(bad)})")
            for b in bad:
                lines.append(f"- `{b}`")
            lines.append("")

    def _render_iso_markdown(self, lines: List[str], lang: str) -> None:
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        lines.append(f"- **{t('target', lang)}:** `{self.summary.get('target_path', '')}`")
        if self.summary.get("is_mounted_disc"):
            lines.append(f"- *Target is a mounted disc directory.*")
        else:
            d_sz = self.summary.get('disk_size', 0)
            i_sz = self.summary.get('implied_size', 0)
            lines.append(f"- **{t('iso_disk_size', lang)}:** {format_bytes(d_sz)}")
            lines.append(f"- **{t('iso_implied_size', lang)}:** {format_bytes(i_sz)}")
            if self.summary.get("is_truncated"):
                lines.append(f"\n> [!WARNING]\n> {t('iso_truncated_warning', lang)}\n")
            lines.append(f"- **Layers:** Joliet: `{self.summary.get('has_joliet')}`, UDF: `{self.summary.get('has_udf')}`, RockRidge: `{self.summary.get('has_rock_ridge')}`")
            lines.append(f"- **{t('total_files', lang)}:** {self.summary.get('total_files', 0):,}")
            lines.append(f"- **{t('total_size', lang)}:** {format_bytes(self.summary.get('total_bytes', 0))}")
        lines.append("")

        failed = self.details.get("failed_files", [])
        if failed:
            lines.append(f"### {t('iso_read_errors', lang)} ({len(failed)})")
            lines.append("")
            for f in failed:
                lines.append(f"- `{f.get('path')}`: {f.get('error')}")
            lines.append("")

        cmp_summary = self.details.get("comparison_summary")
        if cmp_summary:
            lines.append(f"### {t('compare_title', lang)}")
            lines.append(f"- **Status:** `{cmp_summary}`")
            lines.append("")

    def _render_card_test_markdown(self, lines: List[str], lang: str) -> None:
        lines.append(f"## {t('summary', lang)}")
        lines.append("")
        lines.append(f"- **{t('target', lang)}:** `{self.summary.get('target_path', '')}`")
        lines.append(f"- **{t('verdict', lang)}:** **{self.verdict}**")
        lines.append(f"- **{t('card_total_tested', lang)}:** {format_bytes(self.summary.get('total_tested_bytes', 0))} ({self.summary.get('total_blocks', 0):,} blocks)")
        lines.append(f"- **{t('card_write_speed', lang)}:** {self.summary.get('write_speed_mbps', 0.0)} MB/s ({self.summary.get('write_duration_seconds', 0.0)}s)")
        lines.append(f"- **{t('card_read_speed', lang)}:** {self.summary.get('read_speed_mbps', 0.0)} MB/s ({self.summary.get('read_duration_seconds', 0.0)}s)")
        lines.append(f"- **{t('card_bad_blocks', lang)}:** {self.summary.get('bad_blocks', 0)}")
        if self.summary.get("first_bad_block"):
            fbb = self.summary["first_bad_block"]
            lines.append(f"- **{t('card_first_bad', lang)}:** File #{fbb.get('file_index')}, Block #{fbb.get('block_index')} (Offset: {fbb.get('byte_offset'):,} bytes)")
        lines.append("")
        lines.append(f"> [!NOTE]\n> {t('card_reference_note', lang)}\n")

    def save_markdown(self, file_path: str, lang: str = "ro") -> None:
        """Save report to Markdown file."""
        content = self.to_markdown(lang=lang)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    def to_console(self, lang: str = "ro") -> str:
        """Render report for console output with reasonable truncation."""
        lines: List[str] = []
        sep = "=" * 78
        subsep = "-" * 78

        title_key = "recon_title"
        if self.command == "verify":
            title_key = "verify_title"
        elif self.command == "compare":
            title_key = "compare_title"
        elif self.command == "hash-file":
            title_key = "hash_file_title"
        elif self.command == "archive-test":
            title_key = "archive_title"

        lines.append(sep)
        lines.append(f"  {t('tool_title', lang)} v{__version__} — {t(title_key, lang)}")
        lines.append(sep)
        lines.append(f" {t('command', lang)}:    {self.command}")
        lines.append(f" {t('verdict', lang)}:    {self.verdict}")
        lines.append(f" {t('duration', lang)}:   {self.duration_seconds:.2f}s")
        lines.append(subsep)

        if self.command == "recon":
            lines.append(f" {t('target', lang)}:    {self.summary.get('target_path', '')}")
            lines.append(f" {t('fingerprint', lang)}: {self.summary.get('fingerprint', '')}")
            lines.append(f" {t('total_files', lang)}: {self.summary.get('total_files', 0):,}")
            lines.append(f" {t('total_dirs', lang)}:  {self.summary.get('total_directories', 0):,}")
            lines.append(f" {t('total_size', lang)}:  {format_bytes(self.summary.get('total_bytes', 0))}")
            lines.append(subsep)

            # Directory tree (top level)
            tree = self.details.get("tree", [])
            if tree:
                depth_arg = self.arguments.get("depth", 3)
                lines.append(f"\n[{t('dir_tree', lang, depth=depth_arg)}]")
                for node in tree[:CONSOLE_TRUNCATION_LIMIT]:
                    p = node.get("path", ".")
                    d = node.get("depth", 0)
                    indent = "  " * d
                    f_count = node.get("direct_files", 0)
                    t_count = node.get("total_files", 0)
                    f_size = format_bytes(node.get("direct_bytes", 0))
                    t_size = format_bytes(node.get("total_bytes", 0))
                    lines.append(f"  {indent}- {p} (direct: {f_count} files, {f_size} | total: {t_count} files, {t_size})")
                if len(tree) > CONSOLE_TRUNCATION_LIMIT:
                    lines.append(f"  {t('truncated_console_note', lang, count=len(tree) - CONSOLE_TRUNCATION_LIMIT)}")

            # Extension histogram
            hist = self.details.get("extension_histogram", {})
            if hist:
                lines.append(f"\n[{t('extension_histogram', lang)}]")
                for ext, stats in list(hist.items())[:15]:
                    cnt = stats.get("count", 0)
                    sz = format_bytes(stats.get("bytes", 0))
                    lines.append(f"  {ext:<12} : {cnt:>6,} files  ({sz})")
                if len(hist) > 15:
                    lines.append(f"  ... ({len(hist) - 15} more extensions)")

            # Largest files
            largest = self.details.get("largest_files", [])
            if largest:
                lines.append(f"\n[{t('largest_files', lang)}]")
                for idx, item in enumerate(largest[:10], 1):
                    lines.append(f"  {idx:>2}. {format_bytes(item['size']):<20} {item['path']}")
                if len(largest) > 10:
                    lines.append(f"  ... ({len(largest) - 10} more files)")

            # Zero-byte files
            zero_files = self.details.get("zero_byte_files", [])
            if zero_files:
                lines.append(f"\n[! {t('zero_byte_files', lang)}: {len(zero_files)} !]")
                for zf in zero_files[:10]:
                    lines.append(f"  - {zf['path']}")
                if len(zero_files) > 10:
                    lines.append(f"  {t('truncated_console_note', lang, count=len(zero_files) - 10)}")

            # Manifest candidates
            manifests = self.details.get("manifest_candidates", [])
            if manifests:
                lines.append(f"\n[{t('manifest_candidates', lang)}: {len(manifests)}]")
                for mc in manifests:
                    lines.append(f"  * {mc['path']} ({format_bytes(mc.get('size', 0))})")
                    if mc.get("first_5_lines"):
                        for l in mc["first_5_lines"][:3]:
                            lines.append(f"      | {l}")

            # Flags
            flags = self.details.get("flags", {})
            flag_notes = []
            if flags.get("files_over_4gb"):
                flag_notes.append(f"{t('flag_over_4gb', lang)} {len(flags['files_over_4gb'])} file(s)")
            if flags.get("paths_over_240_chars"):
                flag_notes.append(f"{t('flag_paths_over_240', lang)} {len(flags['paths_over_240_chars'])} path(s)")
            if flags.get("non_ascii_names"):
                flag_notes.append(f"{t('flag_non_ascii', lang)} {len(flags['non_ascii_names'])} file(s)")
            if flags.get("case_collisions"):
                flag_notes.append(f"{t('flag_case_collisions', lang)} {len(flags['case_collisions'])} collision(s)")
            if flags.get("non_iso9660_chars"):
                flag_notes.append(f"{t('flag_non_iso9660', lang)} {len(flags['non_iso9660_chars'])} file(s)")

            card_comp = flags.get("card_comparison", {})
            if card_comp:
                fits_list = [c for c, d in card_comp.items() if d["fits"]]
                if fits_list:
                    flag_notes.append(f"Card fit: fits on {', '.join(fits_list)}")
                else:
                    flag_notes.append("Card fit: exceeds 32 GB card!")

            if flag_notes:
                lines.append(f"\n[{t('flags_title', lang)}]")
                for fn in flag_notes:
                    lines.append(f"  ! {fn}")

        elif self.command in ("verify", "compare"):
            summary_line = self.summary.get("summary_line", "")
            lines.append(f" Summary: {summary_line}")
            lines.append(subsep)

            for cat in ("missing", "size_mismatch", "hash_mismatch", "unreadable", "extra"):
                items = self.details.get(cat, [])
                if items:
                    lines.append(f"\n[{t('cat_' + cat, lang)}: {len(items)}]")
                    for it in items[:CONSOLE_TRUNCATION_LIMIT]:
                        p = it.get("path", "")
                        details_str = ", ".join(f"{k}: {v}" for k, v in it.items() if k != "path")
                        lines.append(f"  ! {p:<45} ({details_str})")
                    if len(items) > CONSOLE_TRUNCATION_LIMIT:
                        lines.append(f"  {t('truncated_console_note', lang, count=len(items) - CONSOLE_TRUNCATION_LIMIT)}")

        elif self.command == "hash-file":
            lines.append(f" {t('target', lang)}:         {self.summary.get('file_path', '')}")
            lines.append(f" {t('detected_algo', lang)}:  {self.summary.get('algo', '')}")
            lines.append(f" {t('expected_hash', lang)}:  {self.summary.get('expected_hash', '')}")
            lines.append(f" {t('actual_hash', lang)}:    {self.summary.get('actual_hash', '')}")
            lines.append(subsep)
            if self.verdict == "MATCH":
                lines.append(f"  [OK] {t('verdict_match', lang)}: {t('hash_match_msg', lang)}")
            else:
                lines.append(f"  [!FAIL] {t('verdict_mismatch', lang)}: {t('hash_mismatch_msg', lang)}")

        elif self.command == "archive-test":
            lines.append(f" {t('target', lang)}:         {self.summary.get('file_path', '')}")
            lines.append(f" {t('archive_type', lang)}:   {self.summary.get('archive_type', '')}")
            lines.append(f" {t('archive_total_members', lang)}: {self.summary.get('total_members', 0)}")
            lines.append(f" {t('archive_tested_members', lang)}: {self.summary.get('tested_members', 0)}")
            lines.append(f" Status:              {self.summary.get('status', '')}")
            lines.append(f" Message:             {self.summary.get('message', '')}")
            lines.append(subsep)
            bad = self.details.get("bad_members", [])
            if bad:
                lines.append(f"\n[{t('archive_bad_members', lang)}: {len(bad)}]")
                for b in bad[:CONSOLE_TRUNCATION_LIMIT]:
                    lines.append(f"  ! {b}")
                if len(bad) > CONSOLE_TRUNCATION_LIMIT:
                    lines.append(f"  {t('truncated_console_note', lang, count=len(bad) - CONSOLE_TRUNCATION_LIMIT)}")

        elif self.command == "iso":
            lines.append(f" {t('target', lang)}:         {self.summary.get('target_path', '')}")
            if self.summary.get("is_mounted_disc"):
                lines.append(f"  * Mounted disc / directory scan.")
            else:
                lines.append(f" {t('iso_disk_size', lang)}:   {format_bytes(self.summary.get('disk_size', 0))}")
                lines.append(f" {t('iso_implied_size', lang)}:{format_bytes(self.summary.get('implied_size', 0))}")
                if self.summary.get("is_truncated"):
                    lines.append(f"  [!WARNING] {t('iso_truncated_warning', lang)}")
                lines.append(f" Layers: Joliet={self.summary.get('has_joliet')}, UDF={self.summary.get('has_udf')}, RockRidge={self.summary.get('has_rock_ridge')}")
                lines.append(f" {t('total_files', lang)}:     {self.summary.get('total_files', 0):,}")
                lines.append(f" {t('total_size', lang)}:      {format_bytes(self.summary.get('total_bytes', 0))}")
            lines.append(subsep)

            failed = self.details.get("failed_files", [])
            if failed:
                lines.append(f"\n[{t('iso_read_errors', lang)}: {len(failed)}]")
                for f in failed[:CONSOLE_TRUNCATION_LIMIT]:
                    lines.append(f"  ! {f.get('path')}: {f.get('error')}")
                if len(failed) > CONSOLE_TRUNCATION_LIMIT:
                    lines.append(f"  {t('truncated_console_note', lang, count=len(failed) - CONSOLE_TRUNCATION_LIMIT)}")

            cmp_summary = self.details.get("comparison_summary")
            if cmp_summary:
                lines.append(f"\n[{t('compare_title', lang)}]")
                lines.append(f"  Summary: {cmp_summary}")

        elif self.command == "card-test":
            lines.append(f" {t('target', lang)}:            {self.summary.get('target_path', '')}")
            lines.append(f" {t('card_total_tested', lang)}: {format_bytes(self.summary.get('total_tested_bytes', 0))} ({self.summary.get('total_blocks', 0):,} blocks)")
            lines.append(f" {t('card_write_speed', lang)}:  {self.summary.get('write_speed_mbps', 0.0)} MB/s ({self.summary.get('write_duration_seconds', 0.0)}s)")
            lines.append(f" {t('card_read_speed', lang)}:   {self.summary.get('read_speed_mbps', 0.0)} MB/s ({self.summary.get('read_duration_seconds', 0.0)}s)")
            lines.append(f" {t('card_bad_blocks', lang)}:   {self.summary.get('bad_blocks', 0)}")
            if self.summary.get("first_bad_block"):
                fbb = self.summary["first_bad_block"]
                lines.append(f"  ! {t('card_first_bad', lang)}: File #{fbb.get('file_index')}, Block #{fbb.get('block_index')} (Offset {fbb.get('byte_offset'):,} bytes)")
            lines.append(subsep)
            lines.append(f"  * {t('card_reference_note', lang)}")

        lines.append(sep)
        return "\n".join(lines)


def build_recon_report(
    recon_result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build a standard Report object from ReconResult and CLI arguments."""
    flags = recon_result.flags or {}
    has_flags = any([
        flags.get("files_over_4gb"),
        flags.get("paths_over_240_chars"),
        flags.get("non_ascii_names"),
        flags.get("case_collisions"),
    ])

    verdict = "INFO_FLAGS" if has_flags else "OK"

    summary = {
        "root_name": recon_result.root_name,
        "target_path": recon_result.target_path,
        "total_files": recon_result.total_files,
        "total_directories": recon_result.total_directories,
        "total_bytes": recon_result.total_bytes,
        "fingerprint": recon_result.fingerprint,
    }

    details = {
        "tree": recon_result.tree,
        "extension_histogram": recon_result.extension_histogram,
        "largest_files": recon_result.largest_files,
        "zero_byte_files": recon_result.zero_byte_files,
        "manifest_candidates": recon_result.manifest_candidates,
        "flags": recon_result.flags,
        "errors": recon_result.errors,
    }

    return Report(
        command="recon",
        verdict=verdict,
        arguments=arguments,
        summary=summary,
        details=details,
        duration_seconds=recon_result.duration_seconds,
    )


def build_verify_report(
    verify_result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build a Report object from VerifyResult."""
    verdict = "PROBLEMS_FOUND" if verify_result.has_problems else "OK"

    summary = {
        "target_path": verify_result.target_path,
        "manifest_path": verify_result.manifest_path,
        "algo": verify_result.algo,
        "quick": verify_result.quick,
        "summary_line": verify_result.summary_line(),
        "counts": verify_result.counts,
    }

    details = {
        "ok": verify_result.ok,
        "missing": verify_result.missing,
        "extra": verify_result.extra,
        "size_mismatch": verify_result.size_mismatch,
        "hash_mismatch": verify_result.hash_mismatch,
        "unreadable": verify_result.unreadable,
    }

    problems = (
        verify_result.missing
        + verify_result.size_mismatch
        + verify_result.hash_mismatch
        + verify_result.unreadable
        + verify_result.extra
    )

    return Report(
        command="verify",
        verdict=verdict,
        arguments=arguments,
        summary=summary,
        details=details,
        problems=problems,
        duration_seconds=verify_result.duration_seconds,
    )


def build_compare_report(
    compare_result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build a Report object from CompareResult."""
    verdict = "PROBLEMS_FOUND" if compare_result.has_problems else "OK"

    summary = {
        "path_a": compare_result.path_a,
        "path_b": compare_result.path_b,
        "algo": compare_result.algo,
        "quick": compare_result.quick,
        "summary_line": compare_result.summary_line(),
        "user_confirmed_eject": compare_result.user_confirmed_eject,
        "counts": compare_result.counts,
    }

    details = {
        "ok": compare_result.ok,
        "missing": compare_result.missing,
        "extra": compare_result.extra,
        "size_mismatch": compare_result.size_mismatch,
        "hash_mismatch": compare_result.hash_mismatch,
        "unreadable": compare_result.unreadable,
    }

    problems = (
        compare_result.missing
        + compare_result.size_mismatch
        + compare_result.hash_mismatch
        + compare_result.unreadable
        + compare_result.extra
    )

    return Report(
        command="compare",
        verdict=verdict,
        arguments=arguments,
        summary=summary,
        details=details,
        problems=problems,
        duration_seconds=compare_result.duration_seconds,
    )


def build_hash_file_report(
    data: Dict[str, Any],
    arguments: Dict[str, Any],
) -> Report:
    """Build Report object for hash-file command."""
    verdict = "MATCH" if data.get("match") else "MISMATCH"
    return Report(
        command="hash-file",
        verdict=verdict,
        arguments=arguments,
        summary=data,
        details=data,
        problems=[] if data.get("match") else [data],
        duration_seconds=data.get("duration_seconds", 0.0),
    )


def build_archive_test_report(
    result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build Report object for archive-test command."""
    summary = {
        "file_path": result.file_path,
        "archive_type": result.archive_type,
        "status": result.status,
        "total_members": result.total_members,
        "tested_members": result.tested_members,
        "message": result.message,
    }
    details = {
        "bad_members": result.bad_members,
    }
    return Report(
        command="archive-test",
        verdict=result.status,
        arguments=arguments,
        summary=summary,
        details=details,
        problems=[{"bad_member": b} for b in result.bad_members],
        duration_seconds=result.duration_seconds,
    )


def build_iso_report(
    iso_result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build Report object for iso scan command."""
    verdict = "PROBLEMS_FOUND" if iso_result.has_problems else "OK"

    summary = {
        "target_path": iso_result.target_path,
        "disk_size": iso_result.disk_size,
        "implied_size": iso_result.implied_size,
        "is_truncated": iso_result.is_truncated,
        "has_joliet": iso_result.has_joliet,
        "has_udf": iso_result.has_udf,
        "has_rock_ridge": iso_result.has_rock_ridge,
        "total_files": iso_result.total_files,
        "total_bytes": iso_result.total_bytes,
        "is_mounted_disc": iso_result.is_mounted_disc,
    }

    details = {
        "files": iso_result.files,
        "failed_files": iso_result.failed_files,
    }

    problems = list(iso_result.failed_files)
    if iso_result.is_truncated:
        problems.append({"error": "image_truncated_on_disk"})

    if iso_result.comparison:
        details["comparison_summary"] = iso_result.comparison.summary_line()
        details["comparison_counts"] = iso_result.comparison.counts
        problems.extend(
            iso_result.comparison.missing
            + iso_result.comparison.size_mismatch
            + iso_result.comparison.hash_mismatch
            + iso_result.comparison.unreadable
            + iso_result.comparison.extra
        )

    return Report(
        command="iso",
        verdict=verdict,
        arguments=arguments,
        summary=summary,
        details=details,
        problems=problems,
        duration_seconds=iso_result.duration_seconds,
    )


def build_card_test_report(
    card_result: Any,
    arguments: Dict[str, Any],
) -> Report:
    """Build Report object for card-test command."""
    summary = {
        "target_path": card_result.target_path,
        "verdict": card_result.verdict,
        "total_tested_bytes": card_result.total_tested_bytes,
        "total_blocks": card_result.total_blocks,
        "bad_blocks": card_result.bad_blocks,
        "first_bad_block": card_result.first_bad_block,
        "write_speed_mbps": card_result.write_speed_mbps,
        "read_speed_mbps": card_result.read_speed_mbps,
        "write_duration_seconds": card_result.write_duration_seconds,
        "read_duration_seconds": card_result.read_duration_seconds,
        "user_reinserted": card_result.user_reinserted,
    }

    details = {
        "first_bad_block": card_result.first_bad_block,
        "test_dir_path": card_result.test_dir_path,
        "cleaned_up": card_result.cleaned_up,
        "cleanup_error": card_result.cleanup_error,
    }

    problems = [card_result.first_bad_block] if card_result.first_bad_block else []

    return Report(
        command="card-test",
        verdict=card_result.verdict,
        arguments=arguments,
        summary=summary,
        details=details,
        problems=problems,
        duration_seconds=card_result.write_duration_seconds + card_result.read_duration_seconds,
    )

