"""
Command line interface for RNS 510 Map Source Verifier.
Implements subcommands: recon, manifest, verify, compare, hash-file, archive-test.
Handles bilingual output, progress reporting, and standardized exit codes (0/1/2).
"""

import os
import sys
import time
import argparse
from typing import List, Optional

from mapverify.common import (
    __version__,
    EXIT_OK,
    EXIT_PROBLEMS,
    EXIT_ERROR,
    mask_path,
)
from mapverify.i18n import t, set_current_lang, get_current_lang
from mapverify.recon import run_recon
from mapverify.manifest import create_manifest
from mapverify.verify import run_verify
from mapverify.compare import (
    run_compare,
    EJECT_NOTICE_EN,
    EJECT_NOTICE_RO,
)
from mapverify.hashing import hash_file, autodetect_algo, clean_hash
from mapverify.archives import test_archive
from mapverify.isoscan import scan_iso
from mapverify.cardtest import run_card_test, CardTestIO
from mapverify.report import (
    build_recon_report,
    build_verify_report,
    build_compare_report,
    build_hash_file_report,
    build_archive_test_report,
    build_iso_report,
    build_card_test_report,
)

# Windows UTF-8 console output support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _create_progress_reporter(label: str = "Processing"):
    """Create a throttled console progress reporter for interactive TTYs."""
    last_update = [0.0]
    is_tty = hasattr(sys.stderr, "isatty") and sys.stderr.isatty()

    def _progress(done: int, total: int, current: str):
        if not is_tty:
            return
        now = time.time()
        if now - last_update[0] >= 0.15:
            last_update[0] = now
            trunc_path = current if len(current) <= 45 else "..." + current[-42:]
            if total > 0:
                line = f"\r[{label}] {done:,}/{total:,} — {trunc_path}"
            else:
                line = f"\r[{label}] {done:,} items — {trunc_path}"
            sys.stderr.write(line.ljust(79)[:79])
            sys.stderr.flush()

    def _clear():
        if is_tty and last_update[0] > 0.0:
            sys.stderr.write("\r" + " " * 79 + "\r")
            sys.stderr.flush()

    return _progress, _clear


def _save_reports(report, args, lang: str) -> Optional[int]:
    """Helper to save markdown and json reports if requested."""
    if getattr(args, "md", None):
        try:
            report.save_markdown(args.md, lang=lang)
            print(f"\n[OK] Markdown report saved to: {args.md}")
        except Exception as e:
            sys.stderr.write(f"\nError saving markdown report: {e}\n")
            return EXIT_ERROR

    if getattr(args, "json", None):
        try:
            report.save_json(args.json)
            print(f"[OK] JSON report saved to: {args.json}")
        except Exception as e:
            sys.stderr.write(f"\nError saving JSON report: {e}\n")
            return EXIT_ERROR
    return None


# -----------------------------------------------------------------------------
# Subcommand: recon
# -----------------------------------------------------------------------------
def cmd_recon(args: argparse.Namespace) -> int:
    target_path = args.path
    depth = args.depth
    lang = args.lang

    if not os.path.exists(target_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=target_path)}\n")
        return EXIT_ERROR
    if not os.path.isdir(target_path):
        sys.stderr.write(f"\n{t('err_not_a_dir', lang, path=target_path)}\n")
        return EXIT_ERROR

    ignore_list = []
    if getattr(args, "ignore", None):
        for item in args.ignore:
            ignore_list.extend([x.strip() for x in item.split(",") if x.strip()])

    progress_cb, clear_progress = _create_progress_reporter("Recon")

    try:
        recon_result = run_recon(
            target_path=target_path,
            depth=depth,
            ignore_patterns=ignore_list,
            progress=progress_cb,
        )
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "recon",
        "path": mask_path(target_path),
        "depth": depth,
        "lang": lang,
    }
    if ignore_list:
        arguments_dict["ignore"] = ignore_list

    report = build_recon_report(recon_result, arguments_dict)
    print(report.to_console(lang=lang))

    err = _save_reports(report, args, lang)
    return err if err is not None else EXIT_OK


# -----------------------------------------------------------------------------
# Subcommand: manifest
# -----------------------------------------------------------------------------
def cmd_manifest(args: argparse.Namespace) -> int:
    target_path = args.path
    output_file = args.output
    algo = args.algo
    workers = args.workers
    lang = args.lang

    if not os.path.exists(target_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=target_path)}\n")
        return EXIT_ERROR
    if not os.path.isdir(target_path):
        sys.stderr.write(f"\n{t('err_not_a_dir', lang, path=target_path)}\n")
        return EXIT_ERROR

    progress_cb, clear_progress = _create_progress_reporter("Manifest")

    try:
        manifest_data = create_manifest(
            folder_path=target_path,
            algo=algo,
            workers=workers,
            progress=progress_cb,
        )
        clear_progress()
        manifest_data.save(output_file)
        print(f"\n[OK] {t('manifest_saved', lang, path=output_file)}")
        print(f"     Total: {manifest_data.total_files:,} files, {manifest_data.total_bytes:,} bytes ({algo})")
        return EXIT_OK
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR


# -----------------------------------------------------------------------------
# Subcommand: verify
# -----------------------------------------------------------------------------
def cmd_verify(args: argparse.Namespace) -> int:
    target_path = args.path
    manifest_path = args.manifest
    quick = args.quick
    lang = args.lang

    if not os.path.exists(target_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=target_path)}\n")
        return EXIT_ERROR
    if not os.path.exists(manifest_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=manifest_path)}\n")
        return EXIT_ERROR

    progress_cb, clear_progress = _create_progress_reporter("Verify")

    try:
        verify_result = run_verify(
            target_path=target_path,
            manifest=manifest_path,
            quick=quick,
            progress=progress_cb,
        )
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "verify",
        "path": mask_path(target_path),
        "manifest": mask_path(manifest_path),
        "quick": quick,
        "lang": lang,
    }

    report = build_verify_report(verify_result, arguments_dict)
    print(report.to_console(lang=lang))

    _save_reports(report, args, lang)
    return EXIT_PROBLEMS if verify_result.has_problems else EXIT_OK


# -----------------------------------------------------------------------------
# Subcommand: compare
# -----------------------------------------------------------------------------
def cmd_compare(args: argparse.Namespace) -> int:
    path_a = args.pathA
    path_b = args.pathB
    quick = args.quick
    no_prompt = args.no_prompt
    lang = args.lang

    if not os.path.exists(path_a):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=path_a)}\n")
        return EXIT_ERROR
    if not os.path.exists(path_b):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=path_b)}\n")
        return EXIT_ERROR

    user_confirmed = None
    if not quick and not no_prompt:
        notice = EJECT_NOTICE_RO if lang == "ro" else EJECT_NOTICE_EN
        print(f"\n[NOTICE / ATENTIE]: {notice}")
        prompt_txt = "Press Enter to continue..." if lang == "en" else "Apasati Enter pentru a continua..."
        try:
            input(prompt_txt)
            user_confirmed = True
        except (KeyboardInterrupt, EOFError):
            sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
            return EXIT_ERROR
    elif no_prompt:
        user_confirmed = False

    progress_cb, clear_progress = _create_progress_reporter("Compare")

    try:
        compare_result = run_compare(
            path_a=path_a,
            path_b=path_b,
            quick=quick,
            user_confirmed_eject=user_confirmed,
            progress=progress_cb,
        )
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "compare",
        "pathA": mask_path(path_a),
        "pathB": mask_path(path_b),
        "quick": quick,
        "no_prompt": no_prompt,
        "lang": lang,
    }

    report = build_compare_report(compare_result, arguments_dict)
    print(report.to_console(lang=lang))

    _save_reports(report, args, lang)
    return EXIT_PROBLEMS if compare_result.has_problems else EXIT_OK


# -----------------------------------------------------------------------------
# Subcommand: hash-file
# -----------------------------------------------------------------------------
def cmd_hash_file(args: argparse.Namespace) -> int:
    file_path = args.file
    expected_input = args.expect
    algo_arg = args.algo
    lang = args.lang

    if not os.path.exists(file_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=file_path)}\n")
        return EXIT_ERROR
    if os.path.isdir(file_path):
        sys.stderr.write(f"\nTarget is a directory, not a file: {file_path}\n")
        return EXIT_ERROR

    clean_expected = clean_hash(expected_input)
    if algo_arg:
        algo = algo_arg.lower()
    else:
        try:
            algo = autodetect_algo(clean_expected)
        except ValueError as ve:
            sys.stderr.write(f"\nError detecting hash algorithm: {ve}\n")
            return EXIT_ERROR

    start_time = time.time()
    progress_cb, clear_progress = _create_progress_reporter("Hashing")

    try:
        actual_hash = hash_file(file_path, algo=algo, progress=progress_cb)
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    duration = time.time() - start_time
    matches = actual_hash == clean_expected

    data = {
        "file_path": mask_path(file_path),
        "algo": algo,
        "expected_hash": clean_expected,
        "actual_hash": actual_hash,
        "match": matches,
        "duration_seconds": duration,
    }

    arguments_dict = {
        "command": "hash-file",
        "file": mask_path(file_path),
        "expect": clean_expected,
        "algo": algo,
        "lang": lang,
    }

    report = build_hash_file_report(data, arguments_dict)
    print(report.to_console(lang=lang))

    _save_reports(report, args, lang)
    return EXIT_OK if matches else EXIT_PROBLEMS


# -----------------------------------------------------------------------------
# Subcommand: archive-test
# -----------------------------------------------------------------------------
def cmd_archive_test(args: argparse.Namespace) -> int:
    file_path = args.file
    lang = args.lang

    if not os.path.exists(file_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=file_path)}\n")
        return EXIT_ERROR
    if os.path.isdir(file_path):
        sys.stderr.write(f"\nTarget is a directory, not an archive: {file_path}\n")
        return EXIT_ERROR

    progress_cb, clear_progress = _create_progress_reporter("Archive")

    try:
        archive_res = test_archive(file_path, progress=progress_cb)
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "archive-test",
        "file": mask_path(file_path),
        "lang": lang,
    }

    report = build_archive_test_report(archive_res, arguments_dict)
    print(report.to_console(lang=lang))

    _save_reports(report, args, lang)

    if archive_res.status == "PASS":
        return EXIT_OK
    elif archive_res.status == "FAIL":
        return EXIT_PROBLEMS
    else:  # UNSUPPORTED, MISSING_DEPENDENCY, ERROR
        return EXIT_ERROR


# -----------------------------------------------------------------------------
# Subcommand: iso
# -----------------------------------------------------------------------------
def cmd_iso(args: argparse.Namespace) -> int:
    iso_path = args.iso_path
    against = getattr(args, "against", None)
    list_files = getattr(args, "list", False)
    lang = args.lang

    if not os.path.exists(iso_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=iso_path)}\n")
        return EXIT_ERROR

    progress_cb, clear_progress = _create_progress_reporter("ISO")

    try:
        iso_result = scan_iso(
            target_path=iso_path,
            against_folder=against,
            progress=progress_cb,
        )
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "iso",
        "iso_path": mask_path(iso_path),
        "against": mask_path(against) if against else None,
        "list": list_files,
        "lang": lang,
    }

    report = build_iso_report(iso_result, arguments_dict)
    print(report.to_console(lang=lang))

    if list_files and iso_result.files:
        print(f"\n[Files in ISO: {len(iso_result.files)}]")
        for f in iso_result.files:
            print(f"  {f['size']:>12,} bytes  {f['path']}")

    _save_reports(report, args, lang)
    return EXIT_PROBLEMS if iso_result.has_problems else EXIT_OK


# -----------------------------------------------------------------------------
# Subcommand: card-test
# -----------------------------------------------------------------------------
def cmd_card_test(args: argparse.Namespace) -> int:
    target_path = args.drive_or_folder
    percent = args.percent
    size_mb = args.size_mb
    yes_skip = args.yes
    no_reinsert = args.no_reinsert
    lang = args.lang

    if not os.path.exists(target_path):
        sys.stderr.write(f"\n{t('err_path_not_found', lang, path=target_path)}\n")
        return EXIT_ERROR
    if not os.path.isdir(target_path):
        sys.stderr.write(f"\n{t('err_not_a_dir', lang, path=target_path)}\n")
        return EXIT_ERROR

    io = CardTestIO()
    try:
        free_space = io.get_free_space(target_path)
    except Exception as e:
        sys.stderr.write(f"\nCannot get free space for target: {e}\n")
        return EXIT_ERROR

    if free_space < 256 * 1024 * 1024:
        sys.stderr.write(
            f"\nError: Insufficient free space ({free_space / (1024*1024):.1f} MB). Minimum required is 256 MB.\n"
        )
        return EXIT_ERROR

    # Confirmation
    if not yes_skip:
        print(f"\n[Card Test] Target: {target_path} (Free space: {free_space / (1024*1024*1024):.2f} GB)")
        print("Test will write temporary files inside '.mapverify_test/' and clean them up.")
        try:
            ans = input("Proceed with card capacity & integrity test? [y/N]: ").strip().lower()
            if ans not in ("y", "yes"):
                print("Aborted by user.")
                return EXIT_OK
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            return EXIT_OK

    progress_cb, clear_progress = _create_progress_reporter("CardTest")

    def _reinsert_prompt() -> bool:
        clear_progress()
        prompt_msg = (
            "Safely eject and reinsert the card, then press Enter."
            if lang == "en"
            else "Deconectați în siguranță și reintroduceți cardul, apoi apăsați Enter."
        )
        print(f"\n[NOTICE / ATENȚIE]: {prompt_msg}")
        try:
            input()
            return True
        except (KeyboardInterrupt, EOFError):
            return False

    reinsert_cb = None if no_reinsert else _reinsert_prompt

    try:
        card_result = run_card_test(
            target_path=target_path,
            percent=percent,
            size_mb=size_mb,
            prompt_reinsert=reinsert_cb,
            reinserted=not no_reinsert,
            progress=progress_cb,
        )
    except KeyboardInterrupt:
        clear_progress()
        sys.stderr.write(f"\n{t('err_cancelled', lang)}\n")
        return EXIT_ERROR
    except Exception as e:
        clear_progress()
        sys.stderr.write(f"\n{t('err_io', lang, error=str(e))}\n")
        return EXIT_ERROR
    finally:
        clear_progress()

    arguments_dict = {
        "command": "card-test",
        "drive_or_folder": mask_path(target_path),
        "percent": percent,
        "size_mb": size_mb,
        "no_reinsert": no_reinsert,
        "lang": lang,
    }

    report = build_card_test_report(card_result, arguments_dict)
    print(report.to_console(lang=lang))

    _save_reports(report, args, lang)

    if card_result.verdict == "PASS":
        return EXIT_OK
    elif "FAIL" in card_result.verdict:
        return EXIT_PROBLEMS
    else:  # INCONCLUSIVE or other
        return EXIT_ERROR


def create_parser() -> argparse.ArgumentParser:
    """Build the command line argument parser with all subcommands."""
    parser = argparse.ArgumentParser(
        prog="map_verify",
        description="RNS 510 Map Source Verifier — Verify installation sources before installing on head unit.",
    )
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    parser.add_argument(
        "--lang",
        choices=["ro", "en"],
        default="ro",
        help="Language for CLI output (default: ro).",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # Command: recon
    p_recon = subparsers.add_parser("recon", help="Read-only structure reconnaissance.")
    p_recon.add_argument("path", help="Path to folder, mounted SD card, or disc.")
    p_recon.add_argument("--depth", type=int, default=3, help="Directory tree depth (default: 3).")
    p_recon.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_recon.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")
    p_recon.add_argument("--ignore", action="append", help="Patterns to ignore.")

    # Command: manifest
    p_man = subparsers.add_parser("manifest", help="Hash every file and write a manifest JSON.")
    p_man.add_argument("path", help="Path to source folder.")
    p_man.add_argument("-o", "--output", required=True, help="Output manifest file (e.g. manifest.json).")
    p_man.add_argument("--algo", choices=["sha256", "sha1", "md5"], default="sha256", help="Algorithm (default: sha256).")
    p_man.add_argument("--workers", type=int, default=None, help="Worker threads (default: min(4, CPU)).")

    # Command: verify
    p_ver = subparsers.add_parser("verify", help="Compare a folder against a manifest.")
    p_ver.add_argument("path", help="Path to folder to verify.")
    p_ver.add_argument("--manifest", required=True, help="Path to reference manifest.json.")
    p_ver.add_argument("--quick", action="store_true", help="Check only presence and size (skip hashing).")
    p_ver.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_ver.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: compare
    p_cmp = subparsers.add_parser("compare", help="Compare two trees directly (pathA = reference, pathB = target).")
    p_cmp.add_argument("pathA", help="Reference folder.")
    p_cmp.add_argument("pathB", help="Target folder (e.g. SD card copy).")
    p_cmp.add_argument("--quick", action="store_true", help="Quick compare (presence and size only).")
    p_cmp.add_argument("--no-prompt", action="store_true", help="Skip card eject/reinsert confirmation prompt.")
    p_cmp.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_cmp.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: hash-file
    p_hf = subparsers.add_parser("hash-file", help="Hash a file and compare with expected value.")
    p_hf.add_argument("file", help="File to hash.")
    p_hf.add_argument("--expect", required=True, help="Expected hash string.")
    p_hf.add_argument("--algo", choices=["sha256", "sha1", "md5"], default=None, help="Algorithm (auto-detected if omitted).")
    p_hf.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_hf.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: archive-test
    p_at = subparsers.add_parser("archive-test", help="Test archive internal member CRC without extracting.")
    p_at.add_argument("file", help="Archive file (.zip, .7z).")
    p_at.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_at.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: iso
    p_iso = subparsers.add_parser("iso", help="Verify ISO image or mounted disc.")
    p_iso.add_argument("iso_path", help="Path to .iso file or mounted disc.")
    p_iso.add_argument("--against", help="Folder to compare against.")
    p_iso.add_argument("--list", action="store_true", help="List all files in ISO.")
    p_iso.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_iso.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: card-test
    p_card = subparsers.add_parser("card-test", help="Test card capacity and detect fake or failing media.")
    p_card.add_argument("drive_or_folder", help="Drive letter or folder on card.")
    p_card.add_argument("--percent", type=float, default=90.0, help="Percentage of free space to test (default: 90).")
    p_card.add_argument("--size-mb", type=int, default=None, help="Specific size in MB to test.")
    p_card.add_argument("--yes", action="store_true", help="Skip confirmation prompt.")
    p_card.add_argument("--no-reinsert", action="store_true", help="Skip eject and reinsert step.")
    p_card.add_argument("--json", metavar="out.json", help="Save report as JSON file.")
    p_card.add_argument("--md", metavar="out.md", help="Save report as Markdown file.")

    # Command: gui
    p_gui = subparsers.add_parser("gui", help="Launch the Graphical User Interface (GUI).")
    p_gui.add_argument("path", nargs="?", default=None, help="Optional initial path (folder, ISO, archive, file).")

    return parser


def cmd_gui(args) -> int:
    """Launch the Map Verifier Graphical User Interface."""
    try:
        from mapverify.gui import launch_gui
        launch_gui(initial_path=getattr(args, "path", None))
        return EXIT_OK
    except Exception as e:
        sys.stderr.write(f"Error launching GUI: {e}\n")
        return EXIT_ERROR


def main(argv: Optional[List[str]] = None) -> int:
    """Entry point for CLI execution."""
    parser = create_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return EXIT_ERROR

    if hasattr(args, "lang"):
        set_current_lang(args.lang)

    command_handlers = {
        "recon": cmd_recon,
        "manifest": cmd_manifest,
        "verify": cmd_verify,
        "compare": cmd_compare,
        "hash-file": cmd_hash_file,
        "archive-test": cmd_archive_test,
        "iso": cmd_iso,
        "card-test": cmd_card_test,
        "gui": cmd_gui,
    }

    handler = command_handlers.get(args.command)
    if handler:
        return handler(args)

    sys.stderr.write(f"Unknown command: {args.command}\n")
    return EXIT_ERROR


if __name__ == "__main__":
    sys.exit(main())
