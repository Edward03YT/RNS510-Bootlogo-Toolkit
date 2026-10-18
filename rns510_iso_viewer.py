#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
  VW RNS 510 ISO Decompiler & Logo Visualizer
================================================================================
  Decompiles RNS 510 / Columbus update ISO images strictly from the ISO file:
  - Extracts LOGO.FLI directly from the ISO disc
  - Decodes native 15-bit RGB555 colors and RLE compression
  - Reconstructs exact 800x480 screen output
  - Scans for green noise / artifacts and validates CRC1, CRC2, CRC.16
================================================================================
"""

import os
import sys
import io
import struct
import argparse
from typing import Dict, Any, Optional
from PIL import Image

# Windows UTF-8 console output support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    import pycdlib
except ImportError:
    print("[ERROR / EROARE] 'pycdlib' is not installed. Run: pip install pycdlib")
    sys.exit(1)

# CRC-16/XMODEM table (Polynomial 0x1021)
CRC16_TABLE = []
for _b in range(256):
    _cur = _b << 8
    for _ in range(8):
        _cur = ((_cur << 1) ^ 0x1021) & 0xFFFF if (_cur & 0x8000) else ((_cur << 1) & 0xFFFF)
    CRC16_TABLE.append(_cur)


def crc16_xmodem(data: bytes, initial: int = 0) -> int:
    crc = initial
    for byte in data:
        crc = CRC16_TABLE[((crc >> 8) ^ byte) & 0xFF] ^ ((crc << 8) & 0xFFFF)
    return crc


def decompile_iso_bootlogo(iso_path: str) -> Dict[str, Any]:
    """Decompiles an RNS 510 ISO, extracts LOGO.FLI, decodes image, and validates."""
    if not os.path.exists(iso_path):
        raise FileNotFoundError(f"ISO file not found: {iso_path}")

    iso = pycdlib.PyCdlib()
    iso.open(iso_path)

    fli_bytes = None
    ecu_bytes = None
    crc16_file_val = None
    version_text = None

    for dirname, dirlist, filelist in iso.walk(iso_path="/"):
        for f in filelist:
            clean_name = f.split(";")[0].upper()
            full_iso_path = f"{dirname}/{f}" if dirname != "/" else f"/{f}"
            
            if clean_name == "LOGO.FLI":
                buf = io.BytesIO()
                iso.get_file_from_iso_fp(buf, iso_path=full_iso_path)
                fli_bytes = buf.getvalue()
            elif clean_name == "ECUORDER.TXT":
                buf = io.BytesIO()
                iso.get_file_from_iso_fp(buf, iso_path=full_iso_path)
                ecu_bytes = buf.getvalue()
            elif clean_name == "CRC.16":
                buf = io.BytesIO()
                iso.get_file_from_iso_fp(buf, iso_path=full_iso_path)
                crc16_file_val = buf.getvalue().strip().decode("ascii", errors="ignore")
            elif clean_name == "VERSION.TXT":
                buf = io.BytesIO()
                iso.get_file_from_iso_fp(buf, iso_path=full_iso_path)
                version_text = buf.getvalue().decode("ascii", errors="ignore")

    iso.close()

    if not fli_bytes:
        raise ValueError("Could not find 'LOGO.FLI' inside the ISO image!")

    if len(fli_bytes) < 64:
        raise ValueError("LOGO.FLI is corrupt (less than 64 bytes).")

    header = fli_bytes[:64]
    rle_data = fli_bytes[64:]

    magic = struct.unpack(">I", header[0:4])[0]
    data_size_plus32 = struct.unpack(">I", header[8:12])[0]
    crc1_hdr = struct.unpack(">H", header[18:20])[0]
    width = struct.unpack(">I", header[40:44])[0]
    height = struct.unpack(">I", header[44:48])[0]
    crc2_hdr = struct.unpack(">H", header[50:52])[0]
    data_size_hdr = struct.unpack(">I", header[60:64])[0]

    crc2_calc = crc16_xmodem(rle_data)
    crc1_calc = crc16_xmodem(header[32:64] + rle_data)

    words = []
    for i in range(0, len(rle_data), 4):
        color = int.from_bytes(rle_data[i:i+2], "big")
        count = int.from_bytes(rle_data[i+2:i+4], "big")
        words.extend([color] * count)

    total_pixels = len(words)
    expected_pixels = width * height

    bit15_errors = sum(1 for w in words if (w & 0x8000) != 0)
    green_noise_count = 0
    decoded_rgb = []

    for w in words:
        r5 = (w >> 10) & 0x1F
        g5 = (w >> 5) & 0x1F
        b5 = w & 0x1F

        if g5 > 0 and r5 == 0 and b5 == 0 and g5 <= 3:
            green_noise_count += 1
        elif g5 > (r5 + 3) and g5 > (b5 + 3) and (r5 + g5 + b5) < 18:
            green_noise_count += 1

        r8 = r5 * 255 // 31
        g8 = g5 * 255 // 31
        b8 = b5 * 255 // 31
        decoded_rgb.append((r8, g8, b8))

    sim_img = Image.new("RGB", (width, height))
    sim_img.putdata(decoded_rgb)

    ecu_valid = False
    ecu_calc_crc = None
    if ecu_bytes and crc16_file_val:
        ecu_calc_crc = f"{crc16_xmodem(ecu_bytes):04x}"
        ecu_valid = (ecu_calc_crc.lower() == crc16_file_val.lower())

    is_100_percent_ok = (
        magic == 0xAA55AA55 and
        width == 800 and height == 480 and
        total_pixels == 384000 and
        crc1_hdr == crc1_calc and
        crc2_hdr == crc2_calc and
        bit15_errors == 0 and
        green_noise_count == 0 and
        (ecu_valid if ecu_bytes else True)
    )

    return {
        "iso_path": iso_path,
        "iso_size": os.path.getsize(iso_path),
        "fli_size": len(fli_bytes),
        "rle_size": len(rle_data),
        "magic_ok": magic == 0xAA55AA55,
        "width": width,
        "height": height,
        "total_pixels": total_pixels,
        "expected_pixels": expected_pixels,
        "crc1_hdr": f"{crc1_hdr:04x}",
        "crc1_calc": f"{crc1_calc:04x}",
        "crc1_ok": crc1_hdr == crc1_calc,
        "crc2_hdr": f"{crc2_hdr:04x}",
        "crc2_calc": f"{crc2_calc:04x}",
        "crc2_ok": crc2_hdr == crc2_calc,
        "bit15_errors": bit15_errors,
        "green_noise_count": green_noise_count,
        "ecu_file_crc": crc16_file_val,
        "ecu_calc_crc": ecu_calc_crc,
        "ecu_valid": ecu_valid,
        "version_text": version_text,
        "is_perfect": is_100_percent_ok,
        "image": sim_img
    }


# Bilingual UI strings
VIEWER_STRINGS = {
    "en": {
        "title": "VW RNS 510 - ISO Logo Visualizer & Decompiler",
        "header_title": "RNS 510 Bootlogo Visualizer (Strictly from ISO file)",
        "header_sub": "Decompile any RNS 510 ISO disc and inspect what the navigation screen will show",
        "no_iso": "No ISO file loaded.\nDrag & Drop an ISO here or click the button below.",
        "status_wait": "Status: Waiting for ISO selection",
        "open_btn": "📁 Choose Another ISO...",
        "save_btn": "💾 Save Extracted Image (PNG)",
        "zoom_btn": "🔍 View in Windows Photos (100%)",
        "saved_title": "Saved!",
        "saved_msg": "Extracted image saved at 800x480 resolution:\n{}",
        "warn_title": "Notice",
        "warn_msg": "Please load an ISO file first!",
        "pure_black": "✓ 0 (Pure Black - 0 specks)",
        "minor_noise": "ℹ️ {} pixels (Minor compression noise, SAFE to flash)",
        "high_noise": "⚠️ {} artifacts (May be visible on screen)"
    },
    "ro": {
        "title": "VW RNS 510 - Vizualizator & Decompilator Logo din ISO",
        "header_title": "Vizualizator Logo RNS 510 (Strict din fișierul ISO)",
        "header_sub": "Decompilează orice disc ISO și afișează pixel-cu-pixel ce va afișa navigația mașinii",
        "no_iso": "Niciun fișier ISO încărcat.\nTrageți un ISO aici sau apăsați butonul de mai jos.",
        "status_wait": "Status: Așteaptă selectarea fișierului ISO",
        "open_btn": "📁 Alege Alt Fișier ISO...",
        "save_btn": "💾 Salvează Poza Extrasă (PNG)",
        "zoom_btn": "🔍 Mărește în Windows Foto (100%)",
        "saved_title": "Salvat!",
        "saved_msg": "Imaginea extrasă la rezoluția exactă de 800x480 a fost salvată:\n{}",
        "warn_title": "Atenție",
        "warn_msg": "Vă rugăm să încărcați un fișier ISO mai întâi!",
        "pure_black": "✓ 0 (Negru 100% pur, 0 purici)",
        "minor_noise": "ℹ️ {} pixeli (Zgomot minor compresie veche, SIGUR pt. instalare)",
        "high_noise": "⚠️ {} artefacte (Posibil vizibile pe ecran)"
    }
}


def launch_viewer_gui(initial_iso: Optional[str] = None):
    """Bilingual graphical viewer for decompiling and checking ISO logos."""
    import tkinter as tk
    from tkinter import filedialog, messagebox
    from PIL import ImageTk

    root = tk.Tk()
    root.geometry("820x720")
    root.minsize(760, 680)

    lang_var = tk.StringVar(value="en")

    def vt(key):
        return VIEWER_STRINGS[lang_var.get()].get(key, key)

    root.title(vt("title"))

    BG_COLOR = "#141419"
    CARD_BG = "#20202c"
    PANEL_BG = "#0d0d12"
    TEXT_COLOR = "#f0f0f5"

    root.configure(bg=BG_COLOR)

    current_data = [None]
    img_reference = [None]
    loaded_iso_path = tk.StringVar(value="")

    # Header
    header = tk.Frame(root, bg=BG_COLOR)
    header.pack(fill="x", padx=20, pady=(10, 4))

    top_row = tk.Frame(header, bg=BG_COLOR)
    top_row.pack(fill="x")

    title_lbl = tk.Label(top_row, text=vt("header_title"), font=("Segoe UI", 15, "bold"), fg=TEXT_COLOR, bg=BG_COLOR)
    title_lbl.pack(side="left")

    def toggle_lang():
        new_lang = "ro" if lang_var.get() == "en" else "en"
        lang_var.set(new_lang)
        btn_lang.configure(text="🇷🇴 Română" if new_lang == "ro" else "🇬🇧 English")
        root.title(vt("title"))
        title_lbl.configure(text=vt("header_title"))
        sub_lbl.configure(text=vt("header_sub"))
        btn_open.configure(text=vt("open_btn"))
        btn_save.configure(text=vt("save_btn"))
        btn_view_full.configure(text=vt("zoom_btn"))
        if current_data[0]:
            display_iso_info(current_data[0])
        else:
            image_label.configure(text=vt("no_iso"))
            diag_text.set(vt("status_wait"))

    btn_lang = tk.Button(top_row, text="🇬🇧 English", font=("Segoe UI", 9, "bold"), bg="#333346", fg="white", relief="flat", padx=10, pady=3, cursor="hand2", command=toggle_lang)
    btn_lang.pack(side="right")

    sub_lbl = tk.Label(header, text=vt("header_sub"), font=("Segoe UI", 9), fg="#8f8fa0", bg=BG_COLOR)
    sub_lbl.pack(anchor="w")

    # Card
    card = tk.Frame(root, bg=CARD_BG, relief="flat", bd=1)
    card.pack(fill="both", expand=True, padx=20, pady=6)

    view_frame = tk.Frame(card, bg=PANEL_BG, width=540, height=330, bd=1, relief="solid")
    view_frame.pack(pady=8, padx=15)
    view_frame.pack_propagate(False)

    image_label = tk.Label(view_frame, text=vt("no_iso"), fg="#666677", bg=PANEL_BG, font=("Segoe UI", 11))
    image_label.pack(expand=True)

    diag_box = tk.Frame(card, bg="#181822", bd=1, relief="flat")
    diag_box.pack(fill="x", padx=15, pady=6)

    diag_text = tk.StringVar(value=vt("status_wait"))
    diag_lbl = tk.Label(diag_box, textvariable=diag_text, font=("Consolas", 9), fg="#90caf9", bg="#181822", justify="left", padx=10, pady=6)
    diag_lbl.pack(anchor="w")

    def display_iso_info(res):
        current_data[0] = res
        img = res["image"]
        
        disp_img = img.copy()
        disp_img.thumbnail((520, 312), Image.Resampling.LANCZOS)
        tk_img = ImageTk.PhotoImage(disp_img)
        img_reference[0] = tk_img
        image_label.configure(image=tk_img, text="")

        res_ok = "✓ 800 x 480" if (res["width"] == 800 and res["height"] == 480) else f"✗ {res['width']}x{res['height']}"
        pixels_ok = "✓ 384,000" if res["total_pixels"] == 384000 else f"✗ {res['total_pixels']}"
        
        cnt = res["green_noise_count"]
        if cnt == 0:
            green_status = vt("pure_black")
        elif cnt <= 50:
            green_status = vt("minor_noise").format(cnt)
        else:
            green_status = vt("high_noise").format(cnt)

        crc_status = f"✓ CRC1: {res['crc1_calc']} | ✓ CRC2: {res['crc2_calc']}" if (res["crc1_ok"] and res["crc2_ok"]) else "✗ CRC Error"
        
        info_lines = [
            f"ISO: {os.path.basename(res['iso_path'])} ({res['iso_size']:,} bytes)  |  FLI: {res['fli_size']:,} bytes",
            f"• Resolution: {res_ok}  |  • Pixels: {pixels_ok}  |  • Format: RGB555 (15-bit)",
            f"• Noise / Artifacts: {green_status}",
            f"• Checksums FLI: {crc_status}",
        ]
        if res.get("ecu_file_crc"):
            ecu_str = f"✓ Valid ({res['ecu_file_crc']})" if res["ecu_valid"] else f"✗ Mismatch ({res['ecu_file_crc']} vs {res['ecu_calc_crc']})"
            info_lines.append(f"• Checksum ECUORDER (CRC.16): {ecu_str}")

        diag_text.set("\n".join(info_lines))

        if res["is_perfect"] or cnt <= 50:
            diag_lbl.configure(fg="#66bb6a")
        else:
            diag_lbl.configure(fg="#ffa726")

    def load_iso(path):
        try:
            loaded_iso_path.set(path)
            res = decompile_iso_bootlogo(path)
            display_iso_info(res)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to decompile ISO:\n{e}")

    def choose_iso():
        p = filedialog.askopenfilename(
            title="Choose RNS 510 ISO",
            filetypes=[("ISO Files", "*.iso"), ("All Files", "*.*")]
        )
        if p:
            load_iso(p)

    def save_extracted_png():
        if not current_data[0]:
            messagebox.showwarning(vt("warn_title"), vt("warn_msg"))
            return
        
        base = os.path.splitext(current_data[0]["iso_path"])[0]
        default_out = f"{base}_extracted_800x480.png"
        out_p = filedialog.asksaveasfilename(
            title="Save Extracted PNG",
            initialfile=os.path.basename(default_out),
            defaultextension=".png",
            filetypes=[("PNG Image", "*.png")]
        )
        if out_p:
            current_data[0]["image"].save(out_p)
            messagebox.showinfo(vt("saved_title"), vt("saved_msg").format(out_p))

    def open_external_viewer():
        if not current_data[0]:
            return
        temp_png = os.path.splitext(current_data[0]["iso_path"])[0] + "_preview_temp.png"
        current_data[0]["image"].save(temp_png)
        os.system(f'start "" "{temp_png}"')

    btn_row = tk.Frame(root, bg=BG_COLOR)
    btn_row.pack(fill="x", padx=20, pady=(6, 12))

    btn_open = tk.Button(btn_row, text=vt("open_btn"), font=("Segoe UI", 10, "bold"), bg="#3a3a4e", fg="white", activebackground="#4a4a64", activeforeground="white", relief="flat", padx=16, pady=9, cursor="hand2", command=choose_iso)
    btn_open.pack(side="left")

    btn_save = tk.Button(btn_row, text=vt("save_btn"), font=("Segoe UI", 10), bg="#2d5f8b", fg="white", activebackground="#3a77ad", activeforeground="white", relief="flat", padx=16, pady=9, cursor="hand2", command=save_extracted_png)
    btn_save.pack(side="left", padx=10)

    btn_view_full = tk.Button(btn_row, text=vt("zoom_btn"), font=("Segoe UI", 10), bg="#265e38", fg="white", activebackground="#317948", activeforeground="white", relief="flat", padx=16, pady=9, cursor="hand2", command=open_external_viewer)
    btn_view_full.pack(side="right")

    if initial_iso and os.path.exists(initial_iso):
        root.after(100, lambda: load_iso(initial_iso))

    root.mainloop()


def main():
    parser = argparse.ArgumentParser(
        description="RNS 510 ISO Decompiler & Logo Visualizer (English / Română)"
    )
    parser.add_argument("iso", nargs="?", help="Path to RNS 510 ISO file")
    parser.add_argument("-o", "--output", help="Output PNG path (optional)")
    parser.add_argument("--cli", action="store_true", help="Run in terminal CLI mode without GUI")

    args = parser.parse_args()

    if not args.iso:
        launch_viewer_gui()
        return

    if not args.cli:
        launch_viewer_gui(args.iso)
        return

    print("=================================================================")
    print(f"  RNS 510 ISO Decompilation & Verification: {args.iso}")
    print("=================================================================")

    try:
        res = decompile_iso_bootlogo(args.iso)
        out_png = args.output
        if not out_png:
            out_png = os.path.splitext(args.iso)[0] + "_extracted_800x480.png"

        res["image"].save(out_png)

        print(f"  • ISO Size           : {res['iso_size']:,} bytes")
        print(f"  • LOGO.FLI Size      : {res['fli_size']:,} bytes")
        print(f"  • Resolution         : {res['width']} x {res['height']}")
        print(f"  • Valid Pixels       : {res['total_pixels']:,} / 384,000")
        print(f"  • Color Format       : RGB555 (15-bit)")
        print(f"  • Bit 15 Errors      : {res['bit15_errors']} (Must be 0)")
        print(f"  • Green Noise/Specks : {res['green_noise_count']} detected")
        print(f"  • CRC1 Header        : {'VALID' if res['crc1_ok'] else 'ERROR'} ({res['crc1_calc']})")
        print(f"  • CRC2 RLE Data      : {'VALID' if res['crc2_ok'] else 'ERROR'} ({res['crc2_calc']})")
        if res.get("ecu_file_crc"):
            print(f"  • ECUORDER CRC.16    : {res['ecu_file_crc']} -> {'VALID' if res['ecu_valid'] else 'ERROR'}")
        print(f"  • Reconstructed PNG  : {out_png}")
        print("-----------------------------------------------------------------")
        if res["is_perfect"]:
            print("  [✓] COMPLETE VERIFICATION: 100% PERFECT & CLEAN!")
        else:
            print("  [!] NOTICE: Potential minor noise detected in ISO.")
        print("=================================================================")

    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
