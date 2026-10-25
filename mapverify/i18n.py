"""
Internationalization (i18n) dictionary and helper functions for Map Source Verifier.
Supports Romanian (ro, default) and English (en).
All code comments are written in English with no diacritics.
"""

from typing import Dict, Any

DEFAULT_LANG = "ro"
_current_lang = DEFAULT_LANG

TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "ro": {
        # General & Header
        "tool_title": "RNS 510 Map Source Verifier",
        "tool_description": "Instrument de verificare integritate surse hărți RNS 510",
        "command": "Comandă",
        "version": "Versiune",
        "date": "Data",
        "duration": "Durată",
        "verdict": "Verdict",
        "target": "Țintă scanată",
        "status_ok": "OK",
        "status_info_flags": "FLAGS_INFORMATIVE",
        "status_error": "EROARE",
        "status_cancelled": "ANULAT",
        "privacy_note": "Confidențialitate: căile absolute și numele de utilizator au fost mascate.",

        # Disclaimer / Limits (Section 0)
        "limits_title": "Limite operaționale și avertismente",
        "limit_internal_drive": "RNS 510 instalează hărțile pe unitatea sa internă (HDD/SSD). Acest instrument nu poate citi sau verifica datele din interiorul unității RNS 510. Verifică strict sursa de instalare (folder, card SD, ISO, arhivă).",
        "limit_manifest_needed": "Fără un manifest de referință, nu se poate ști dacă un set de hărți este 'versiunea corectă', ci doar dacă două copii sunt identice, dacă fișierele sunt citibile și dacă structura este suspectă.",
        "limit_no_maps_shipped": "Instrumentul nu descarcă date, nu include hărți și nu oferă manifeste 'cunoscute bune'. Utilizatorul generează propriile manifeste din sursele sale.",

        # Commands & Verdicts
        "cmd_manifest": "Generare manifest",
        "cmd_verify": "Verificare manifest",
        "cmd_compare": "Comparație directoare",
        "cmd_hash_file": "Verificare hash fișier",
        "cmd_archive_test": "Test integritate arhivă",
        "cmd_iso": "Scanare imagine ISO",
        "cmd_card_test": "Test integritate card SD",
        "verdict_match": "MATCH (POTRIVIRE)",
        "verdict_mismatch": "MISMATCH (NEPOTRIVIRE)",
        "verdict_pass": "PASS (INTEGRU)",
        "verdict_fail": "FAIL (CORUPT)",
        "verdict_unsupported": "UNSUPPORTED (NESUPORTAT)",

        # ISO scan
        "iso_title": "Raport scanare imagine ISO / Disc",
        "iso_disk_size": "Dimensiune fișier pe disc",
        "iso_implied_size": "Dimensiune declarată (PVD)",
        "iso_truncated_warning": "ATENȚIE: Imaginea ISO este trunchiată! Descărcare incompletă sau scriere neterminată.",
        "iso_read_errors": "Fișiere cu erori de citire:",

        # Card test
        "card_test_title": "Raport test capacitate și integritate card",
        "card_total_tested": "Capacitate totală testată",
        "card_write_speed": "Viteză de scriere",
        "card_read_speed": "Viteză de citire",
        "card_bad_blocks": "Blocuri corupte detectate",
        "card_first_bad": "Primul bloc corupt",
        "card_reference_note": "Notă: Rezultatele sunt indicative. H2testw și f3 sunt referințe consacrate.",

        # Manifest
        "manifest_saved": "Manifest generat cu succes în: {path}",
        "manifest_algo": "Algoritm utilizat",
        "manifest_workers": "Fire de execuție (workers)",

        # Verify & Compare
        "verify_title": "Raport verificare împotriva manifestului",
        "compare_title": "Raport comparație directă între directoare",
        "ref_path": "Director referință (A)",
        "target_path_b": "Director țintă (B)",
        "manifest_file": "Fișier manifest",
        "cat_ok": "Fișiere integre (OK)",
        "cat_missing": "Fișiere lipsă (Missing)",
        "cat_extra": "Fișiere în plus (Extra)",
        "cat_size_mismatch": "Diferențe de dimensiune (Size Mismatch)",
        "cat_hash_mismatch": "Diferențe de conținut/hash (Hash Mismatch)",
        "cat_unreadable": "Fișiere ilizibile / Erori I/O (Unreadable)",
        "expected_hash": "Hash așteptat",
        "actual_hash": "Hash calculat",
        "expected_size": "Dimensiune așteptată",
        "actual_size": "Dimensiune reală",
        "eject_notice_confirmed": "Notificare eject/reinsert card: Confirmată de utilizator",
        "eject_notice_skipped": "Notificare eject/reinsert card: Sărită (--no-prompt)",

        # Hash file
        "hash_file_title": "Verificare sumă de control fișier descărcat",
        "detected_algo": "Algoritm detectat automat",
        "hash_match_msg": "Suma de control corespunde perfect cu valoarea așteptată.",
        "hash_mismatch_msg": "ATENȚIE: Suma de control calculată diferă de valoarea așteptată!",

        # Archive test
        "archive_title": "Raport test integritate arhivă",
        "archive_type": "Tip arhivă",
        "archive_total_members": "Total fișiere în arhivă",
        "archive_tested_members": "Fișiere testate",
        "archive_bad_members": "Fișiere corupte (erori CRC)",
        "summary": "Rezumat general",
        "total_files": "Total fișiere",
        "total_dirs": "Total directoare",
        "total_size": "Dimensiune totală",
        "fingerprint": "Amprentă structură (SHA-256)",
        "fingerprint_desc": "Calculată peste lista sortată cale_relativă|dimensiune (fără citire conținut, independent de data creării).",

        # Tree
        "dir_tree": "Arbore directoare (până la adâncimea {depth})",
        "col_path": "Cale",
        "col_depth": "Adâncime",
        "col_direct_files": "Fișiere directe",
        "col_direct_size": "Dimensiune directă",
        "col_total_files": "Total fișiere",
        "col_total_size": "Dimensiune cumulată",

        # Histogram
        "extension_histogram": "Histogramă extensii fișiere",
        "col_extension": "Extensie",
        "col_count": "Număr fișiere",
        "col_bytes": "Total octeți",
        "col_percent": "% din total",
        "no_extension": "(fără extensie)",

        # Largest & Zero-byte files
        "largest_files": "Cele mai mari 20 de fișiere",
        "zero_byte_files": "Fișiere cu dimensiune zero (0 bytes)",
        "no_zero_byte_files": "Nu s-au găsit fișiere de dimensiune zero.",

        # Manifest candidates
        "manifest_candidates": "Fișiere ce par a fi manifeste sau sume de control (checksums)",
        "no_manifest_candidates": "Nu s-au găsit fișiere de tip manifest sau sume de control.",
        "preview_first_5_lines": "Primele 5 linii:",
        "file_too_large_preview": "Fișier mai mare de 64 KiB; previzualizarea a fost omisă.",

        # Informational flags
        "flags_title": "Observații și indicatori informativi (Flags)",
        "no_flags": "Niciun indicator suspect detectat.",
        "flag_over_4gb": "Fișiere mai mari de 4 GiB (sistemul FAT32 nu le poate stoca):",
        "flag_paths_over_240": "Căi mai lungi de 240 caractere (posibile probleme ISO9660/Joliet/MAX_PATH):",
        "flag_non_ascii": "Nume ce conțin caractere non-ASCII (posibile erori de codare):",
        "flag_case_collisions": "Nume ce diferă doar prin majuscule/minuscule (coliziune pe FAT32/NTFS):",
        "flag_non_iso9660": "Nume cu caractere în afara setului ISO9660 Level 1/2 (A-Z, a-z, 0-9, _, -, .):",
        "flag_card_sizes": "Compatibilitate cu capacități comune de carduri SD:",
        "card_fits": "Încap pe card de {card} ({percent:.1f}% utilizat)",
        "card_exceeds": "Depășește card de {card} (necesită card mai mare)",

        # Errors and cancellations
        "err_path_not_found": "Eroare: Calea specificată nu există: {path}",
        "err_not_a_dir": "Eroare: Calea specificată nu este un director: {path}",
        "err_permission_denied": "Eroare: Acces refuzat pentru calea: {path}",
        "err_cancelled": "Operațiunea a fost anulată de utilizator.",
        "err_io": "Eroare I/O: {error}",

        # Console truncation
        "truncated_console_note": "... și încă {count} elemente (lista completă se află în raportul salvat).",
    },
    "en": {
        # General & Header
        "tool_title": "RNS 510 Map Source Verifier",
        "tool_description": "RNS 510 map source integrity verification tool",
        "command": "Command",
        "version": "Version",
        "date": "Date",
        "duration": "Duration",
        "verdict": "Verdict",
        "target": "Scanned target",
        "status_ok": "OK",
        "status_info_flags": "INFO_FLAGS",
        "status_error": "ERROR",
        "status_cancelled": "CANCELLED",
        "privacy_note": "Privacy: absolute paths and usernames have been masked.",

        # Disclaimer / Limits (Section 0)
        "limits_title": "Operational limits and disclaimers",
        "limit_internal_drive": "The RNS 510 installs maps onto its internal drive (HDD/SSD). This tool cannot read or verify data inside the RNS 510 head unit. It strictly verifies the installation source (folder, SD card, ISO, archive).",
        "limit_manifest_needed": "Without a reference manifest it cannot know whether a map set is 'the right one', only whether two copies match, whether files are readable, and whether the set looks structurally suspicious.",
        "limit_no_maps_shipped": "This tool never downloads anything, ships no map data, and provides no 'known-good' manifests. Users generate manifests from their own sources.",

        # Commands & Verdicts
        "cmd_manifest": "Create manifest",
        "cmd_verify": "Verify manifest",
        "cmd_compare": "Compare trees",
        "cmd_hash_file": "Hash file check",
        "cmd_archive_test": "Archive integrity test",
        "cmd_iso": "ISO image scan",
        "cmd_card_test": "SD card integrity test",
        "verdict_match": "MATCH",
        "verdict_mismatch": "MISMATCH",
        "verdict_pass": "PASS",
        "verdict_fail": "FAIL",
        "verdict_unsupported": "UNSUPPORTED",

        # ISO scan
        "iso_title": "ISO / Disc Image Scan Report",
        "iso_disk_size": "File size on disk",
        "iso_implied_size": "Volume descriptor size (PVD)",
        "iso_truncated_warning": "WARNING: ISO image is truncated! File size on disk is smaller than volume descriptor size.",
        "iso_read_errors": "Files that failed reading from image:",

        # Card test
        "card_test_title": "Card Capacity & Integrity Test Report",
        "card_total_tested": "Total tested capacity",
        "card_write_speed": "Write speed",
        "card_read_speed": "Read speed",
        "card_bad_blocks": "Bad blocks detected",
        "card_first_bad": "First bad block",
        "card_reference_note": "Note: Results are indicative. H2testw and f3 are well-known references.",

        # Manifest
        "manifest_saved": "Manifest successfully generated at: {path}",
        "manifest_algo": "Hash algorithm",
        "manifest_workers": "Worker threads",

        # Verify & Compare
        "verify_title": "Manifest Verification Report",
        "compare_title": "Direct Tree Comparison Report",
        "ref_path": "Reference folder (A)",
        "target_path_b": "Target folder (B)",
        "manifest_file": "Manifest file",
        "cat_ok": "Files intact (OK)",
        "cat_missing": "Missing files",
        "cat_extra": "Extra files",
        "cat_size_mismatch": "Size mismatch",
        "cat_hash_mismatch": "Hash/content mismatch",
        "cat_unreadable": "Unreadable files / I/O errors",
        "expected_hash": "Expected hash",
        "actual_hash": "Actual hash",
        "expected_size": "Expected size",
        "actual_size": "Actual size",
        "eject_notice_confirmed": "Card eject/reinsert notice: Confirmed by user",
        "eject_notice_skipped": "Card eject/reinsert notice: Skipped (--no-prompt)",

        # Hash file
        "hash_file_title": "File Hash Verification",
        "detected_algo": "Autodetected algorithm",
        "hash_match_msg": "Hash matches the expected value.",
        "hash_mismatch_msg": "WARNING: Computed hash does NOT match expected value!",

        # Archive test
        "archive_title": "Archive Integrity Test Report",
        "archive_type": "Archive type",
        "archive_total_members": "Total archive members",
        "archive_tested_members": "Tested members",
        "archive_bad_members": "Corrupt members (CRC errors)",
        "summary": "General Summary",
        "total_files": "Total files",
        "total_dirs": "Total directories",
        "total_size": "Total size",
        "fingerprint": "Tree fingerprint (SHA-256)",
        "fingerprint_desc": "Calculated over the sorted relative_path|size lines (no content hashing, creation-order independent).",

        # Tree
        "dir_tree": "Directory tree (up to depth {depth})",
        "col_path": "Path",
        "col_depth": "Depth",
        "col_direct_files": "Direct files",
        "col_direct_size": "Direct size",
        "col_total_files": "Total files",
        "col_total_size": "Cumulative size",

        # Histogram
        "extension_histogram": "File extension histogram",
        "col_extension": "Extension",
        "col_count": "File count",
        "col_bytes": "Total bytes",
        "col_percent": "% of total",
        "no_extension": "(no extension)",

        # Largest & Zero-byte files
        "largest_files": "20 Largest files",
        "zero_byte_files": "Zero-byte files (0 bytes)",
        "no_zero_byte_files": "No zero-byte files found.",

        # Manifest candidates
        "manifest_candidates": "Files resembling manifests or checksums",
        "no_manifest_candidates": "No manifest or checksum files found.",
        "preview_first_5_lines": "First 5 lines:",
        "file_too_large_preview": "File larger than 64 KiB; preview skipped.",

        # Informational flags
        "flags_title": "Informational observations and flags",
        "no_flags": "No suspicious flags detected.",
        "flag_over_4gb": "Files larger than 4 GiB (FAT32 cannot store them):",
        "flag_paths_over_240": "Paths longer than 240 characters (potential ISO9660/Joliet/MAX_PATH issues):",
        "flag_non_ascii": "Names containing non-ASCII characters (potential encoding issues):",
        "flag_case_collisions": "Names differing only by letter case (collision on FAT32/NTFS):",
        "flag_non_iso9660": "Names with characters outside ISO9660 Level 1/2 charset (A-Z, a-z, 0-9, _, -, .):",
        "flag_card_sizes": "Compatibility with common SD card sizes:",
        "card_fits": "Fits on {card} card ({percent:.1f}% capacity used)",
        "card_exceeds": "Exceeds {card} card (requires larger card)",

        # Errors and cancellations
        "err_path_not_found": "Error: Specified path does not exist: {path}",
        "err_not_a_dir": "Error: Specified path is not a directory: {path}",
        "err_permission_denied": "Error: Access denied for path: {path}",
        "err_cancelled": "Operation cancelled by user.",
        "err_io": "I/O Error: {error}",

        # Console truncation
        "truncated_console_note": "... and {count} more items (full list available in saved report).",
    }
}


def set_current_lang(lang: str) -> None:
    """Set the active language code ('ro' or 'en')."""
    global _current_lang
    if lang in TRANSLATIONS:
        _current_lang = lang
    else:
        _current_lang = DEFAULT_LANG


def get_current_lang() -> str:
    """Get the active language code."""
    return _current_lang


def t(key: str, lang: str = "", **kwargs: Any) -> str:
    """
    Translate a key into the target language.
    Falls back to current language, then Romanian, then English, then key itself.
    """
    target_lang = lang or _current_lang
    if target_lang not in TRANSLATIONS:
        target_lang = DEFAULT_LANG

    text = TRANSLATIONS.get(target_lang, {}).get(key)
    if text is None:
        text = TRANSLATIONS.get("en", {}).get(key, key)

    if kwargs:
        try:
            return text.format(**kwargs)
        except Exception:
            return text
    return text
