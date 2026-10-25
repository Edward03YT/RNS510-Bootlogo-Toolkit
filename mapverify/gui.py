"""
Dark-mode Tkinter Graphical User Interface for RNS 510 Map Source Verifier.
Implements a responsive, non-freezing multi-tab GUI matching the visual theme
of rns510_iso_viewer.py.
"""

import os
import sys
import threading
from typing import Optional, Dict, Any, List
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText

from mapverify.common import (
    __version__,
    mask_path,
    format_bytes,
)
from mapverify.i18n import t, set_current_lang, get_current_lang
from mapverify.recon import run_recon
from mapverify.manifest import create_manifest
from mapverify.verify import run_verify
from mapverify.compare import run_compare
from mapverify.isoscan import scan_iso
from mapverify.hashing import hash_file, autodetect_algo, clean_hash
from mapverify.archives import test_archive
from mapverify.cardtest import run_card_test, CardTestIO
from mapverify.report import (
    Report,
    build_recon_report,
    build_verify_report,
    build_compare_report,
    build_iso_report,
    build_hash_file_report,
    build_archive_test_report,
    build_card_test_report,
)

# Dark theme palette matching rns510_iso_viewer.py
BG_COLOR = "#141419"
CARD_BG = "#20202c"
PANEL_BG = "#0d0d12"
TEXT_COLOR = "#f0f0f5"
TEXT_MUTED = "#9d9da6"
ACCENT_COLOR = "#2a62d4"
BUTTON_BG = "#333346"
BUTTON_FG = "#ffffff"
SUCCESS_COLOR = "#27ae60"
WARNING_COLOR = "#e67e22"
DANGER_COLOR = "#c0392b"
FONT_FAMILY = "Segoe UI"


class MapVerifierGUI:
    def __init__(self, root: tk.Tk, initial_path: Optional[str] = None):
        self.root = root
        self.lang = "ro"
        set_current_lang(self.lang)

        self.cancel_event = threading.Event()
        self.active_thread: Optional[threading.Thread] = None
        self.last_report: Optional[Report] = None

        self.root.title(f"{t('tool_title', self.lang)} v{__version__}")
        self.root.geometry("980x820")
        self.root.minsize(860, 720)
        self.root.configure(bg=BG_COLOR)

        self._configure_styles()
        self._build_ui()

        if initial_path:
            self._handle_initial_path(initial_path)

    def _configure_styles(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")

        style.configure("TNotebook", background=BG_COLOR, borderwidth=0)
        style.configure(
            "TNotebook.Tab",
            background=CARD_BG,
            foreground=TEXT_COLOR,
            padding=[12, 6],
            font=(FONT_FAMILY, 10, "bold"),
            borderwidth=0,
        )
        style.map(
            "TNotebook.Tab",
            background=[("selected", ACCENT_COLOR), ("active", "#3d405b")],
            foreground=[("selected", "#ffffff")],
        )

        style.configure(
            "Horizontal.TProgressbar",
            troughcolor=PANEL_BG,
            background=ACCENT_COLOR,
            darkcolor=ACCENT_COLOR,
            lightcolor=ACCENT_COLOR,
            bordercolor=PANEL_BG,
        )

    def _build_ui(self) -> None:
        # 1. Top Header Frame
        header = tk.Frame(self.root, bg=BG_COLOR)
        header.pack(fill="x", padx=16, pady=(10, 6))

        top_row = tk.Frame(header, bg=BG_COLOR)
        top_row.pack(fill="x")

        self.title_lbl = tk.Label(
            top_row,
            text=f"🗺️ {t('tool_title', self.lang)}",
            font=(FONT_FAMILY, 16, "bold"),
            fg=TEXT_COLOR,
            bg=BG_COLOR,
        )
        self.title_lbl.pack(side="left")

        # Language toggle button
        self.btn_lang = tk.Button(
            top_row,
            text="🇷🇴 Română",
            font=(FONT_FAMILY, 9, "bold"),
            bg=BUTTON_BG,
            fg=BUTTON_FG,
            relief="flat",
            padx=12,
            pady=4,
            cursor="hand2",
            command=self._toggle_language,
        )
        self.btn_lang.pack(side="right")

        self.sub_lbl = tk.Label(
            header,
            text=t("tool_description", self.lang),
            font=(FONT_FAMILY, 10),
            fg=TEXT_MUTED,
            bg=BG_COLOR,
        )
        self.sub_lbl.pack(anchor="w", pady=(2, 0))

        # 2. Tabs Notebook
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="x", padx=16, pady=4)

        self._build_recon_tab()
        self._build_manifest_tab()
        self._build_verify_tab()
        self._build_compare_tab()
        self._build_iso_tab()
        self._build_hash_file_tab()
        self._build_archive_tab()
        self._build_card_test_tab()
        self._build_about_tab()

        # 3. Bottom Execution & Output Section
        bottom_frame = tk.Frame(self.root, bg=BG_COLOR)
        bottom_frame.pack(fill="both", expand=True, padx=16, pady=(6, 12))

        # Progress bar & Cancel
        prog_row = tk.Frame(bottom_frame, bg=BG_COLOR)
        prog_row.pack(fill="x", pady=4)

        self.progress_bar = ttk.Progressbar(
            prog_row,
            orient="horizontal",
            mode="determinate",
            style="Horizontal.TProgressbar",
        )
        self.progress_bar.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_cancel = tk.Button(
            prog_row,
            text="⏹️ Cancel",
            font=(FONT_FAMILY, 9, "bold"),
            bg=DANGER_COLOR,
            fg=BUTTON_FG,
            relief="flat",
            padx=12,
            pady=2,
            cursor="hand2",
            state="disabled",
            command=self._cancel_task,
        )
        self.btn_cancel.pack(side="right")

        self.progress_label = tk.Label(
            bottom_frame,
            text="Ready.",
            font=(FONT_FAMILY, 9),
            fg=TEXT_MUTED,
            bg=BG_COLOR,
            anchor="w",
        )
        self.progress_label.pack(fill="x", pady=(0, 4))

        # Status Banner
        self.status_banner = tk.Label(
            bottom_frame,
            text="ℹ️ Ready / Așteaptă selectarea comenzii",
            font=(FONT_FAMILY, 10, "bold"),
            bg=CARD_BG,
            fg=TEXT_COLOR,
            pady=4,
            relief="flat",
        )
        self.status_banner.pack(fill="x", pady=(0, 4))

        # Output Text Console
        self.output_text = ScrolledText(
            bottom_frame,
            wrap="none",
            bg=PANEL_BG,
            fg=TEXT_COLOR,
            insertbackground=TEXT_COLOR,
            font=("Consolas", 10),
            borderwidth=1,
            relief="flat",
        )
        self.output_text.pack(fill="both", expand=True, pady=(0, 6))

        # Save Report Buttons
        save_row = tk.Frame(bottom_frame, bg=BG_COLOR)
        save_row.pack(fill="x")

        self.btn_save_md = tk.Button(
            save_row,
            text="💾 Save Markdown (.md)",
            font=(FONT_FAMILY, 9),
            bg=BUTTON_BG,
            fg=BUTTON_FG,
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            state="disabled",
            command=lambda: self._export_report("md"),
        )
        self.btn_save_md.pack(side="left", padx=(0, 8))

        self.btn_save_json = tk.Button(
            save_row,
            text="💾 Save JSON (.json)",
            font=(FONT_FAMILY, 9),
            bg=BUTTON_BG,
            fg=BUTTON_FG,
            relief="flat",
            padx=10,
            pady=3,
            cursor="hand2",
            state="disabled",
            command=lambda: self._export_report("json"),
        )
        self.btn_save_json.pack(side="left")

    # -------------------------------------------------------------------------
    # TAB 1: RECON
    # -------------------------------------------------------------------------
    def _build_recon_tab(self) -> None:
        self.tab_recon = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_recon, text="🔍 Recon")

        self.recon_path_var = tk.StringVar()
        self.recon_depth_var = tk.IntVar(value=3)

        row1 = tk.Frame(self.tab_recon, bg=CARD_BG)
        row1.pack(fill="x", pady=4)
        tk.Label(row1, text="Folder / Disc:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(row1, textvariable=self.recon_path_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(row1, text="📁 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.recon_path_var)).pack(side="right")

        row2 = tk.Frame(self.tab_recon, bg=CARD_BG)
        row2.pack(fill="x", pady=4)
        tk.Label(row2, text="Depth:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Spinbox(row2, from_=1, to=10, textvariable=self.recon_depth_var, width=6, bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, font=(FONT_FAMILY, 10)).pack(side="left", padx=6)

        self.btn_run_recon = tk.Button(row2, text="🚀 Run Recon", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_recon)
        self.btn_run_recon.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 2: MANIFEST
    # -------------------------------------------------------------------------
    def _build_manifest_tab(self) -> None:
        self.tab_manifest = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_manifest, text="📋 Manifest")

        self.manifest_folder_var = tk.StringVar()
        self.manifest_out_var = tk.StringVar()
        self.manifest_algo_var = tk.StringVar(value="sha256")

        r1 = tk.Frame(self.tab_manifest, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Source Folder:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.manifest_folder_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📁 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.manifest_folder_var)).pack(side="right")

        r2 = tk.Frame(self.tab_manifest, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Output JSON:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.manifest_out_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r2, text="💾 Save As...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._save_file(self.manifest_out_var, [("JSON files", "*.json")])).pack(side="right")

        r3 = tk.Frame(self.tab_manifest, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Label(r3, text="Algorithm:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        algo_cb = ttk.Combobox(r3, textvariable=self.manifest_algo_var, values=["sha256", "sha1", "md5"], state="readonly", width=10)
        algo_cb.pack(side="left", padx=6)

        self.btn_run_manifest = tk.Button(r3, text="⚙️ Create Manifest", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_manifest)
        self.btn_run_manifest.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 3: VERIFY
    # -------------------------------------------------------------------------
    def _build_verify_tab(self) -> None:
        self.tab_verify = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_verify, text="🛡️ Verify")

        self.verify_folder_var = tk.StringVar()
        self.verify_manifest_var = tk.StringVar()
        self.verify_quick_var = tk.BooleanVar(value=False)

        r1 = tk.Frame(self.tab_verify, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Target Folder:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.verify_folder_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📁 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.verify_folder_var)).pack(side="right")

        r2 = tk.Frame(self.tab_verify, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Manifest File:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.verify_manifest_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r2, text="📄 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_file(self.verify_manifest_var, [("JSON files", "*.json")])).pack(side="right")

        r3 = tk.Frame(self.tab_verify, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Checkbutton(r3, text="Quick check (presence & size only, skip hashing)", variable=self.verify_quick_var, font=(FONT_FAMILY, 9), fg=TEXT_COLOR, bg=CARD_BG, selectcolor=PANEL_BG, activebackground=CARD_BG, activeforeground=TEXT_COLOR).pack(side="left")

        self.btn_run_verify = tk.Button(r3, text="🔍 Start Verification", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_verify)
        self.btn_run_verify.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 4: COMPARE
    # -------------------------------------------------------------------------
    def _build_compare_tab(self) -> None:
        self.tab_compare = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_compare, text="⚖️ Compare")

        self.cmp_a_var = tk.StringVar()
        self.cmp_b_var = tk.StringVar()
        self.cmp_quick_var = tk.BooleanVar(value=False)

        r1 = tk.Frame(self.tab_compare, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Reference (A):", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.cmp_a_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📁 Browse A...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.cmp_a_var)).pack(side="right")

        r2 = tk.Frame(self.tab_compare, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Target (B/SD):", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.cmp_b_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r2, text="📁 Browse B...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.cmp_b_var)).pack(side="right")

        r3 = tk.Frame(self.tab_compare, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Checkbutton(r3, text="Quick compare (size only)", variable=self.cmp_quick_var, font=(FONT_FAMILY, 9), fg=TEXT_COLOR, bg=CARD_BG, selectcolor=PANEL_BG, activebackground=CARD_BG, activeforeground=TEXT_COLOR).pack(side="left")

        self.btn_run_compare = tk.Button(r3, text="⚖️ Compare Trees", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_compare)
        self.btn_run_compare.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 5: ISO
    # -------------------------------------------------------------------------
    def _build_iso_tab(self) -> None:
        self.tab_iso = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_iso, text="💿 ISO Scan")

        self.iso_path_var = tk.StringVar()
        self.iso_against_var = tk.StringVar()
        self.iso_list_var = tk.BooleanVar(value=False)

        r1 = tk.Frame(self.tab_iso, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="ISO / Disc:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.iso_path_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="💿 Choose ISO...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_file(self.iso_path_var, [("ISO image files", "*.iso")])).pack(side="right")

        r2 = tk.Frame(self.tab_iso, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Against Folder:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.iso_against_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r2, text="📁 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.iso_against_var)).pack(side="right")

        r3 = tk.Frame(self.tab_iso, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Checkbutton(r3, text="List all members in ISO", variable=self.iso_list_var, font=(FONT_FAMILY, 9), fg=TEXT_COLOR, bg=CARD_BG, selectcolor=PANEL_BG, activebackground=CARD_BG, activeforeground=TEXT_COLOR).pack(side="left")

        self.btn_run_iso = tk.Button(r3, text="💿 Scan ISO", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_iso)
        self.btn_run_iso.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 6: HASH FILE
    # -------------------------------------------------------------------------
    def _build_hash_file_tab(self) -> None:
        self.tab_hash = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_hash, text="🔑 Hash File")

        self.hf_path_var = tk.StringVar()
        self.hf_expect_var = tk.StringVar()
        self.hf_algo_var = tk.StringVar(value="auto")

        r1 = tk.Frame(self.tab_hash, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Target File:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.hf_path_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📄 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_file(self.hf_path_var)).pack(side="right")

        r2 = tk.Frame(self.tab_hash, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Expected Hash:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r2, textvariable=self.hf_expect_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)

        r3 = tk.Frame(self.tab_hash, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Label(r3, text="Algorithm:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        ttk.Combobox(r3, textvariable=self.hf_algo_var, values=["auto", "sha256", "sha1", "md5"], state="readonly", width=10).pack(side="left", padx=6)

        self.btn_run_hash = tk.Button(r3, text="🔑 Verify Hash", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_hash_file)
        self.btn_run_hash.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 7: ARCHIVE TEST
    # -------------------------------------------------------------------------
    def _build_archive_tab(self) -> None:
        self.tab_archive = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_archive, text="📦 Archive")

        self.archive_path_var = tk.StringVar()

        r1 = tk.Frame(self.tab_archive, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Archive File:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.archive_path_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📦 Browse...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_file(self.archive_path_var, [("Archive files", "*.zip;*.7z;*.rar")])).pack(side="right")

        r2 = tk.Frame(self.tab_archive, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Supports .zip natively; .7z via py7zr; checks CRC internal integrity.", font=(FONT_FAMILY, 9), fg=TEXT_MUTED, bg=CARD_BG).pack(side="left")

        self.btn_run_archive = tk.Button(r2, text="📦 Test Archive CRC", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_archive_test)
        self.btn_run_archive.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 8: CARD TEST
    # -------------------------------------------------------------------------
    def _build_card_test_tab(self) -> None:
        self.tab_card = tk.Frame(self.notebook, bg=CARD_BG, padx=14, pady=12)
        self.notebook.add(self.tab_card, text="💾 Card Test")

        self.card_path_var = tk.StringVar()
        self.card_percent_var = tk.DoubleVar(value=90.0)
        self.card_size_mb_var = tk.StringVar(value="")
        self.card_yes_var = tk.BooleanVar(value=True)
        self.card_no_reinsert_var = tk.BooleanVar(value=False)

        r1 = tk.Frame(self.tab_card, bg=CARD_BG)
        r1.pack(fill="x", pady=4)
        tk.Label(r1, text="Drive / Folder:", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG, width=14, anchor="w").pack(side="left")
        tk.Entry(r1, textvariable=self.card_path_var, font=(FONT_FAMILY, 10), bg=PANEL_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR).pack(side="left", fill="x", expand=True, padx=6)
        tk.Button(r1, text="📁 Choose Card...", bg=BUTTON_BG, fg=BUTTON_FG, font=(FONT_FAMILY, 9), relief="flat", cursor="hand2", command=lambda: self._pick_folder(self.card_path_var)).pack(side="right")

        r2 = tk.Frame(self.tab_card, bg=CARD_BG)
        r2.pack(fill="x", pady=4)
        tk.Label(r2, text="Fill Percent (%):", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG).pack(side="left")
        tk.Spinbox(r2, from_=10.0, to=99.0, increment=5.0, textvariable=self.card_percent_var, width=6, bg=PANEL_BG, fg=TEXT_COLOR, font=(FONT_FAMILY, 10)).pack(side="left", padx=(4, 16))

        tk.Label(r2, text="Or Size (MB):", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG).pack(side="left")
        tk.Entry(r2, textvariable=self.card_size_mb_var, width=8, bg=PANEL_BG, fg=TEXT_COLOR, font=(FONT_FAMILY, 10)).pack(side="left", padx=4)

        r3 = tk.Frame(self.tab_card, bg=CARD_BG)
        r3.pack(fill="x", pady=4)
        tk.Checkbutton(r3, text="Skip reinsert (faster, but OS cache may hide fake card errors)", variable=self.card_no_reinsert_var, font=(FONT_FAMILY, 9), fg=TEXT_COLOR, bg=CARD_BG, selectcolor=PANEL_BG, activebackground=CARD_BG, activeforeground=TEXT_COLOR).pack(side="left")

        self.btn_run_card = tk.Button(r3, text="💾 Run Card Test", font=(FONT_FAMILY, 10, "bold"), bg=ACCENT_COLOR, fg=BUTTON_FG, relief="flat", padx=16, pady=4, cursor="hand2", command=self._start_card_test)
        self.btn_run_card.pack(side="right")

    # -------------------------------------------------------------------------
    # TAB 9: ABOUT
    # -------------------------------------------------------------------------
    def _build_about_tab(self) -> None:
        self.tab_about = tk.Frame(self.notebook, bg=CARD_BG, padx=16, pady=14)
        self.notebook.add(self.tab_about, text="ℹ️ About")

        about_text = ScrolledText(
            self.tab_about,
            wrap="word",
            bg=PANEL_BG,
            fg=TEXT_COLOR,
            font=(FONT_FAMILY, 10),
            borderwidth=0,
            relief="flat",
        )
        about_text.pack(fill="both", expand=True)

        content = (
            f"RNS 510 Map Source Verifier — v{__version__}\n"
            f"Open-Source Map Source Verification & Diagnostic Suite\n"
            f"License: GNU General Public License v3.0 (GPL-3.0)\n\n"
            f"===============================================================================\n"
            f"HONEST OPERATIONAL LIMITS (What this tool CAN and CANNOT do):\n"
            f"===============================================================================\n\n"
            f"1. The VW RNS 510 installs navigation maps onto its INTERNAL DRIVE (HDD or SSD).\n"
            f"   This tool CANNOT read, access, or verify what is inside your head unit.\n"
            f"   It strictly verifies the SOURCE media (folder, SD card, ISO image, archive)\n"
            f"   BEFORE you attempt a 1-hour installation in your car.\n\n"
            f"2. Without a reference manifest, the tool cannot know if a set of maps is\n"
            f"   'the right version'. It only determines if files are uncorrupted, whether\n"
            f"   two copies match byte-for-byte, and whether the layout has anomalies.\n\n"
            f"3. PRIVACY & INTEGRITY:\n"
            f"   - Strict zero network access. No telemetry, no phone-home.\n"
            f"   - Never downloads map data and SHIPS NO MAP FILES or 'known-good' sets.\n"
            f"   - User home directory paths and Windows usernames are strictly masked in reports.\n\n"
            f"4. SDCARD INTEGRITY:\n"
            f"   - Card testing is non-destructive and cleans up its test folder.\n"
            f"   - Results are indicative; H2testw and f3 are recognized reference benchmarks.\n"
        )
        about_text.insert("1.0", content)
        about_text.configure(state="disabled")

    # -------------------------------------------------------------------------
    # Helper & Event Handlers
    # -------------------------------------------------------------------------
    def _pick_folder(self, str_var: tk.StringVar) -> None:
        selected = filedialog.askdirectory(initialdir=str_var.get() or os.getcwd())
        if selected:
            str_var.set(os.path.normpath(selected))

    def _pick_file(self, str_var: tk.StringVar, filetypes=None) -> None:
        ft = filetypes or [("All files", "*.*")]
        selected = filedialog.askopenfilename(initialdir=os.path.dirname(str_var.get()) if str_var.get() else os.getcwd(), filetypes=ft)
        if selected:
            str_var.set(os.path.normpath(selected))

    def _save_file(self, str_var: tk.StringVar, filetypes=None) -> None:
        ft = filetypes or [("All files", "*.*")]
        selected = filedialog.asksaveasfilename(defaultextension=".json", filetypes=ft)
        if selected:
            str_var.set(os.path.normpath(selected))

    def _handle_initial_path(self, path: str) -> None:
        norm = os.path.normpath(path)
        if os.path.isdir(norm):
            self.recon_path_var.set(norm)
            self.manifest_folder_var.set(norm)
            self.verify_folder_var.set(norm)
            self.cmp_b_var.set(norm)
            self.card_path_var.set(norm)
            self.notebook.select(self.tab_recon)
        elif norm.lower().endswith(".iso"):
            self.iso_path_var.set(norm)
            self.notebook.select(self.tab_iso)
        elif norm.lower().endswith((".zip", ".7z", ".rar")):
            self.archive_path_var.set(norm)
            self.notebook.select(self.tab_archive)
        elif norm.lower().endswith(".json"):
            self.verify_manifest_var.set(norm)
            self.notebook.select(self.tab_verify)
        elif os.path.isfile(norm):
            self.hf_path_var.set(norm)
            self.notebook.select(self.tab_hash)

    def _toggle_language(self) -> None:
        self.lang = "en" if self.lang == "ro" else "ro"
        set_current_lang(self.lang)
        self.btn_lang.configure(text="🇬🇧 English" if self.lang == "en" else "🇷🇴 Română")
        self.root.title(f"{t('tool_title', self.lang)} v{__version__}")
        self.title_lbl.configure(text=f"🗺️ {t('tool_title', self.lang)}")
        self.sub_lbl.configure(text=t("tool_description", self.lang))

    def _set_ui_busy(self, busy: bool) -> None:
        state = "disabled" if busy else "normal"
        self.btn_cancel.configure(state="normal" if busy else "disabled")
        self.btn_run_recon.configure(state=state)
        self.btn_run_manifest.configure(state=state)
        self.btn_run_verify.configure(state=state)
        self.btn_run_compare.configure(state=state)
        self.btn_run_iso.configure(state=state)
        self.btn_run_hash.configure(state=state)
        self.btn_run_archive.configure(state=state)
        self.btn_run_card.configure(state=state)

        if busy:
            self.btn_save_md.configure(state="disabled")
            self.btn_save_json.configure(state="disabled")
            self.cancel_event.clear()
            self.output_text.delete("1.0", "end")
            self.progress_bar.configure(value=0)
        else:
            if self.last_report is not None:
                self.btn_save_md.configure(state="normal")
                self.btn_save_json.configure(state="normal")

    def _update_progress(self, done: int, total: int, current_path: str) -> None:
        def _cb():
            if total > 0:
                pct = min(100.0, (done / total) * 100.0)
                self.progress_bar.configure(value=pct)
                self.progress_label.configure(text=f"[{pct:.1f}%] {current_path}")
            else:
                self.progress_label.configure(text=f"Processed: {done:,} — {current_path}")
        self.root.after(0, _cb)

    def _set_status_banner(self, text: str, bg: str, fg: str = "#ffffff") -> None:
        def _cb():
            self.status_banner.configure(text=text, bg=bg, fg=fg)
        self.root.after(0, _cb)

    def _append_console(self, text: str) -> None:
        def _cb():
            self.output_text.insert("end", text + "\n")
            self.output_text.see("end")
        self.root.after(0, _cb)

    def _cancel_task(self) -> None:
        self.cancel_event.set()
        self.progress_label.configure(text="Cancelling operation...")
        self._set_status_banner("⏹️ Operation cancelled by user", WARNING_COLOR)

    def _export_report(self, fmt: str) -> None:
        if not self.last_report:
            return
        ext = ".md" if fmt == "md" else ".json"
        ft = [("Markdown file", "*.md")] if fmt == "md" else [("JSON file", "*.json")]
        save_path = filedialog.asksaveasfilename(defaultextension=ext, filetypes=ft)
        if save_path:
            try:
                if fmt == "md":
                    self.last_report.save_markdown(save_path, lang=self.lang)
                else:
                    self.last_report.save_json(save_path)
                messagebox.showinfo("Export", f"Report saved successfully:\n{save_path}")
            except Exception as e:
                messagebox.showerror("Export Error", f"Could not save report: {e}")

    # -------------------------------------------------------------------------
    # Threaded Execution Handlers
    # -------------------------------------------------------------------------
    def _start_recon(self) -> None:
        target = self.recon_path_var.get().strip()
        if not target or not os.path.isdir(target):
            messagebox.showwarning("Recon", "Please select a valid folder.")
            return

        depth = self.recon_depth_var.get()
        self._set_ui_busy(True)
        self._set_status_banner("⏳ Running Recon...", BUTTON_BG)

        def _work():
            try:
                res = run_recon(
                    target_path=target,
                    depth=depth,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                report = build_recon_report(res, {"command": "recon", "path": mask_path(target), "depth": depth})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                self._set_status_banner("✅ Recon Completed", SUCCESS_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_manifest(self) -> None:
        target = self.manifest_folder_var.get().strip()
        out_f = self.manifest_out_var.get().strip()
        algo = self.manifest_algo_var.get()
        if not target or not os.path.isdir(target):
            messagebox.showwarning("Manifest", "Please select a valid source folder.")
            return
        if not out_f:
            messagebox.showwarning("Manifest", "Please specify an output JSON file path.")
            return

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Hashing & Creating Manifest...", BUTTON_BG)

        def _work():
            try:
                man_data = create_manifest(
                    folder_path=target,
                    algo=algo,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                man_data.save(out_f)
                msg = f"[OK] Manifest generated successfully!\nFiles: {man_data.total_files:,}\nBytes: {man_data.total_bytes:,}\nSaved to: {out_f}"
                self._append_console(msg)
                self._set_status_banner("✅ Manifest Created", SUCCESS_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_verify(self) -> None:
        target = self.verify_folder_var.get().strip()
        manifest_f = self.verify_manifest_var.get().strip()
        quick = self.verify_quick_var.get()
        if not target or not os.path.isdir(target):
            messagebox.showwarning("Verify", "Please select a valid target folder.")
            return
        if not manifest_f or not os.path.isfile(manifest_f):
            messagebox.showwarning("Verify", "Please select a valid manifest JSON file.")
            return

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Verifying against manifest...", BUTTON_BG)

        def _work():
            try:
                res = run_verify(
                    target_path=target,
                    manifest=manifest_f,
                    quick=quick,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                report = build_verify_report(res, {"command": "verify", "path": mask_path(target), "manifest": mask_path(manifest_f), "quick": quick})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if res.has_problems:
                    self._set_status_banner(f"⚠️ Problems Detected ({res.summary_line()})", WARNING_COLOR)
                else:
                    self._set_status_banner("✅ Verification Passed (100% Match)", SUCCESS_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_compare(self) -> None:
        path_a = self.cmp_a_var.get().strip()
        path_b = self.cmp_b_var.get().strip()
        quick = self.cmp_quick_var.get()
        if not path_a or not os.path.isdir(path_a):
            messagebox.showwarning("Compare", "Please select folder A (reference).")
            return
        if not path_b or not os.path.isdir(path_b):
            messagebox.showwarning("Compare", "Please select folder B (target / SD card).")
            return

        # Show eject notice if full compare
        confirmed = False
        if not quick:
            ans = messagebox.askyesno(
                "Removable Media Cache Notice",
                "For a trustworthy result with an SD card or USB,\nsafely eject the card, reinsert it, then click Yes to continue.\n\nDid you reinsert the card?",
            )
            confirmed = ans

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Comparing folder trees...", BUTTON_BG)

        def _work():
            try:
                res = run_compare(
                    path_a=path_a,
                    path_b=path_b,
                    quick=quick,
                    user_confirmed_eject=confirmed,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                report = build_compare_report(res, {"command": "compare", "pathA": mask_path(path_a), "pathB": mask_path(path_b), "quick": quick})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if res.has_problems:
                    self._set_status_banner(f"⚠️ Differences Found ({res.summary_line()})", WARNING_COLOR)
                else:
                    self._set_status_banner("✅ Folders Identical (100% Match)", SUCCESS_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_iso(self) -> None:
        iso_p = self.iso_path_var.get().strip()
        against = self.iso_against_var.get().strip() or None
        list_f = self.iso_list_var.get()
        if not iso_p or not os.path.exists(iso_p):
            messagebox.showwarning("ISO Scan", "Please select an ISO file or mounted disc.")
            return

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Scanning ISO image...", BUTTON_BG)

        def _work():
            try:
                res = scan_iso(
                    target_path=iso_p,
                    against_folder=against,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                report = build_iso_report(res, {"command": "iso", "iso_path": mask_path(iso_p), "against": mask_path(against) if against else None})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if list_f and res.files:
                    self._append_console(f"\n[Files in ISO: {len(res.files)}]")
                    for f in res.files:
                        self._append_console(f"  {f['size']:>12,} bytes  {f['path']}")
                if res.has_problems:
                    self._set_status_banner("⚠️ ISO Issues Detected", WARNING_COLOR)
                else:
                    self._set_status_banner("✅ ISO Integrity Verified", SUCCESS_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_hash_file(self) -> None:
        fp = self.hf_path_var.get().strip()
        expect_h = self.hf_expect_var.get().strip()
        algo_choice = self.hf_algo_var.get().strip()
        if not fp or not os.path.isfile(fp):
            messagebox.showwarning("Hash File", "Please select a file to hash.")
            return
        if not expect_h:
            messagebox.showwarning("Hash File", "Please enter the expected hash.")
            return

        cleaned_exp = clean_hash(expect_h)
        if algo_choice == "auto":
            try:
                algo = autodetect_algo(cleaned_exp)
            except ValueError as ve:
                messagebox.showerror("Algorithm Error", str(ve))
                return
        else:
            algo = algo_choice

        self._set_ui_busy(True)
        self._set_status_banner(f"⏳ Computing {algo.upper()} hash...", BUTTON_BG)

        def _work():
            try:
                actual_h = hash_file(fp, algo=algo, progress=self._update_progress, cancel_event=self.cancel_event)
                match = (actual_h == cleaned_exp)
                data = {
                    "file_path": mask_path(fp),
                    "algo": algo,
                    "expected_hash": cleaned_exp,
                    "actual_hash": actual_h,
                    "match": match,
                }
                report = build_hash_file_report(data, {"command": "hash-file", "file": mask_path(fp), "algo": algo})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if match:
                    self._set_status_banner(f"✅ MATCH — {algo.upper()} Hash Verified", SUCCESS_COLOR)
                else:
                    self._set_status_banner(f"❌ MISMATCH — Hash does NOT match", DANGER_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_archive_test(self) -> None:
        ap = self.archive_path_var.get().strip()
        if not ap or not os.path.isfile(ap):
            messagebox.showwarning("Archive Test", "Please select an archive file.")
            return

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Testing archive member CRC...", BUTTON_BG)

        def _work():
            try:
                res = test_archive(ap, progress=self._update_progress, cancel_event=self.cancel_event)
                report = build_archive_test_report(res, {"command": "archive-test", "file": mask_path(ap)})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if res.status == "PASS":
                    self._set_status_banner(f"✅ PASS — All {res.total_members} members CRC OK", SUCCESS_COLOR)
                elif res.status == "FAIL":
                    self._set_status_banner(f"❌ FAIL — CRC errors in {len(res.bad_members)} members", DANGER_COLOR)
                else:
                    self._set_status_banner(f"⚠️ {res.status}: {res.message}", WARNING_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _start_card_test(self) -> None:
        target = self.card_path_var.get().strip()
        if not target or not os.path.isdir(target):
            messagebox.showwarning("Card Test", "Please select a valid card folder or drive.")
            return

        pct = self.card_percent_var.get()
        size_str = self.card_size_mb_var.get().strip()
        size_mb = int(size_str) if size_str.isdigit() else None
        no_reinsert = self.card_no_reinsert_var.get()

        ans = messagebox.askyesno(
            "Card Test Confirmation",
            f"Target: {target}\n"
            "This test writes test patterns inside '.mapverify_test/' and verifies them.\n"
            "It is non-destructive to existing files and cleans up automatically.\n\n"
            "Proceed?",
        )
        if not ans:
            return

        self._set_ui_busy(True)
        self._set_status_banner("⏳ Running Card Capacity & Integrity Test...", BUTTON_BG)

        def _reinsert_cb() -> bool:
            return messagebox.askyesno(
                "Safely Reinsert Card",
                "Write phase complete!\nFor accurate testing, safely eject the card, reinsert it, then click Yes.",
            )

        def _work():
            try:
                res = run_card_test(
                    target_path=target,
                    percent=pct,
                    size_mb=size_mb,
                    prompt_reinsert=_reinsert_cb if not no_reinsert else None,
                    reinserted=not no_reinsert,
                    progress=self._update_progress,
                    cancel_event=self.cancel_event,
                )
                report = build_card_test_report(res, {"command": "card-test", "target": mask_path(target)})
                self.last_report = report
                self._append_console(report.to_console(lang=self.lang))
                if res.verdict == "PASS":
                    self._set_status_banner("✅ PASS — Card Capacity & Data Integrity Verified", SUCCESS_COLOR)
                elif "FAIL" in res.verdict:
                    self._set_status_banner(f"❌ FAIL — {res.bad_blocks} bad blocks detected!", DANGER_COLOR)
                else:
                    self._set_status_banner(f"⚠️ {res.verdict}", WARNING_COLOR)
            except Exception as e:
                self._append_console(f"\n[ERROR]: {e}")
                self._set_status_banner(f"❌ Error: {e}", DANGER_COLOR)
            finally:
                self.root.after(0, lambda: self._set_ui_busy(False))

        threading.Thread(target=_work, daemon=True).start()


def launch_gui(initial_path: Optional[str] = None) -> None:
    """Launch the Map Verifier Graphical User Interface."""
    root = tk.Tk()
    app = MapVerifierGUI(root, initial_path=initial_path)
    root.mainloop()


if __name__ == "__main__":
    init_p = sys.argv[1] if len(sys.argv) > 1 else None
    launch_gui(initial_path=init_p)
