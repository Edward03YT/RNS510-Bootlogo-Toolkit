#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
  VW RNS 510 / Columbus / Seat Media Bootlogo Creator & ISO Builder
================================================================================
  Converts any image (optimal 800x480) into the native VW RNS 510 .FLI format
  (RGB555 15-bit color with Run-Length Encoding), calculates CRC16/XMODEM
  checksums, and builds a fully bootable SWL update ISO CD image.

  Includes an intelligent anti-artifact noise filter and real-time hardware simulation.
================================================================================
"""

import os
import sys
import io
import struct
import argparse
from typing import Tuple, Optional, Dict, Any
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

# Precomputed CRC-16/XMODEM table (Polynomial 0x1021, initial 0x0000)
CRC16_TABLE = []
for _b in range(256):
    _cur = _b << 8
    for _ in range(8):
        _cur = ((_cur << 1) ^ 0x1021) & 0xFFFF if (_cur & 0x8000) else ((_cur << 1) & 0xFFFF)
    CRC16_TABLE.append(_cur)


def crc16_xmodem(data: bytes, initial: int = 0) -> int:
    """Computes CRC-16/XMODEM over the provided buffer."""
    crc = initial
    for byte in data:
        crc = CRC16_TABLE[((crc >> 8) ^ byte) & 0xFF] ^ ((crc << 8) & 0xFFFF)
    return crc


def image_to_rgb555_rle(
    image_path_or_pil,
    target_size: Tuple[int, int] = (800, 480),
    fit_mode: str = "pad",
    clean_black: bool = True
) -> bytes:
    """
    Loads an image, composites alpha over pure black, scales to 800x480,
    converts pixels to 15-bit RGB555 (5 bits Red, 5 bits Green, 5 bits Blue, bit 15 = 0),
    and applies RLE (Run-Length Encoding) compression scanned left-to-right, top-to-bottom.
    """
    if isinstance(image_path_or_pil, str):
        img = Image.open(image_path_or_pil)
    else:
        img = image_path_or_pil

    # Handle transparency
    if img.mode in ("RGBA", "LA") or ("transparency" in img.info):
        bg = Image.new("RGB", img.size, (0, 0, 0))
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")

    tar_w, tar_h = target_size

    # Resize / letterbox
    if img.size != target_size:
        if fit_mode == "stretch":
            img = img.resize(target_size, Image.Resampling.LANCZOS)
        else:
            src_w, src_h = img.size
            scale = min(tar_w / src_w, tar_h / src_h)
            new_w, new_h = max(1, int(src_w * scale)), max(1, int(src_h * scale))
            resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            canvas = Image.new("RGB", target_size, (0, 0, 0))
            paste_x = (tar_w - new_w) // 2
            paste_y = (tar_h - new_h) // 2
            canvas.paste(resized, (paste_x, paste_y))
            img = canvas

    if hasattr(img, "get_flattened_data"):
        raw_pixels = list(img.get_flattened_data())
    else:
        raw_pixels = list(img.getdata())

    if len(raw_pixels) > 0 and isinstance(raw_pixels[0], int):
        rgb_tuples = zip(raw_pixels[0::3], raw_pixels[1::3], raw_pixels[2::3])
    else:
        rgb_tuples = raw_pixels

    # Convert to 15-bit RGB555
    rgb555_list = []
    for r, g, b in rgb_tuples:
        # Anti-noise filter on dark backgrounds (eliminates compression artifacts)
        if clean_black and r < 10 and g < 10 and b < 10:
            word16 = 0
        else:
            r5 = (r >> 3) & 0x1F
            g5 = (g >> 3) & 0x1F
            b5 = (b >> 3) & 0x1F
            if clean_black and r5 == 0 and b5 == 0 and g5 <= 1:
                g5 = 0
            word16 = (r5 << 10) | (g5 << 5) | b5

        rgb555_list.append(word16)

    # RLE Compression
    rle_data = bytearray()
    cur_color = rgb555_list[0]
    cur_count = 1

    for word in rgb555_list[1:]:
        if word == cur_color and cur_count < 0xFFFF:
            cur_count += 1
        else:
            rle_data.extend(struct.pack(">HH", cur_color, cur_count))
            cur_color = word
            cur_count = 1
    rle_data.extend(struct.pack(">HH", cur_color, cur_count))

    return bytes(rle_data)


def build_fli_data(rle_data: bytes, width: int = 800, height: int = 480) -> bytes:
    """Builds the 64-byte RNS 510 FLI header and appends the RLE data."""
    data_len = len(rle_data)
    crc2 = crc16_xmodem(rle_data)

    header_part2 = struct.pack(
        ">IIIIHHIII",
        0x002A4444,     # 32-35
        0x00021675,     # 36-39
        width,          # 40-43: Width (800)
        height,         # 44-47: Height (480)
        0x0000,         # 48-49
        crc2,           # 50-51: CRC2
        0x00000001,     # 52-55
        0x00000000,     # 56-59
        data_len        # 60-63: Data Length
    )

    crc1 = crc16_xmodem(header_part2 + rle_data)

    header_part1 = struct.pack(
        ">IIIIHHIII",
        0xAA55AA55,     # 0-3:   Magic
        0x0000000F,     # 4-7:   Constant 15 (STRATA_UPDATE 15)
        data_len + 32,  # 8-11:  Data Length + 32
        0x00000000,     # 12-15
        0x0000,         # 16-17
        crc1,           # 18-19: CRC1
        0xFFFFFFFF,     # 20-23
        0x00000000,     # 24-27
        0xFFFFFFFF      # 28-31
    )

    return header_part1 + header_part2 + rle_data


def fli_bytes_to_image(fli_bytes: bytes) -> Image.Image:
    """Decodes LOGO.FLI bytes back into a PIL Image (exact hardware reproduction)."""
    header = fli_bytes[:64]
    rle_data = fli_bytes[64:]

    width = struct.unpack(">I", header[40:44])[0]
    height = struct.unpack(">I", header[44:48])[0]

    pixels = []
    for i in range(0, len(rle_data), 4):
        color = int.from_bytes(rle_data[i:i+2], "big")
        count = int.from_bytes(rle_data[i+2:i+4], "big")
        
        r = ((color >> 10) & 0x1F) * 255 // 31
        g = ((color >> 5) & 0x1F) * 255 // 31
        b = (color & 0x1F) * 255 // 31
        pixels.extend([(r, g, b)] * count)

    img = Image.new("RGB", (width, height))
    img.putdata(pixels)
    return img


def fli_to_image(fli_path: str, output_image_path: Optional[str] = None) -> Image.Image:
    """Decodes a LOGO.FLI file from disk to an Image and optionally saves it."""
    with open(fli_path, "rb") as f:
        fli_bytes = f.read()

    img = fli_bytes_to_image(fli_bytes)

    if output_image_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_image_path)), exist_ok=True)
        img.save(output_image_path)

    return img


def analyze_and_verify(source_path_or_bytes) -> Dict[str, Any]:
    """Analyzes an image, FLI file, or ISO image for quality and artifacts."""
    fli_bytes = None
    ecu_info = None
    source_type = "unknown"

    if isinstance(source_path_or_bytes, (bytes, bytearray)):
        fli_bytes = bytes(source_path_or_bytes)
        source_type = "fli_bytes"
    elif isinstance(source_path_or_bytes, str):
        ext = os.path.splitext(source_path_or_bytes)[1].lower()
        if ext == ".iso":
            source_type = "iso"
            iso = pycdlib.PyCdlib()
            iso.open(source_path_or_bytes)
            out_fp = io.BytesIO()
            iso.get_file_from_iso_fp(out_fp, iso_path="/WA/LOGO.FLI;1")
            fli_bytes = out_fp.getvalue()
            try:
                ecu_fp = io.BytesIO()
                iso.get_file_from_iso_fp(ecu_fp, iso_path="/ECUORDER.TXT;1")
                ecu_bytes = ecu_fp.getvalue()
                crc_fp = io.BytesIO()
                iso.get_file_from_iso_fp(crc_fp, iso_path="/CRC.16;1")
                crc_file_val = crc_fp.getvalue().strip().decode("ascii", errors="ignore")
                calc_crc = f"{crc16_xmodem(ecu_bytes):04x}"
                ecu_info = {
                    "ecu_bytes": ecu_bytes,
                    "crc_file": crc_file_val,
                    "crc_calc": calc_crc,
                    "crc_valid": crc_file_val.lower() == calc_crc.lower()
                }
            except Exception:
                pass
            iso.close()
        elif ext == ".fli":
            source_type = "fli"
            with open(source_path_or_bytes, "rb") as f:
                fli_bytes = f.read()
        else:
            source_type = "image"
            rle = image_to_rgb555_rle(source_path_or_bytes, target_size=(800, 480))
            fli_bytes = build_fli_data(rle, 800, 480)

    header = fli_bytes[:64]
    rle_data = fli_bytes[64:]

    width = struct.unpack(">I", header[40:44])[0]
    height = struct.unpack(">I", header[44:48])[0]
    magic = struct.unpack(">I", header[0:4])[0]
    data_size_hdr = struct.unpack(">I", header[60:64])[0]
    crc2_hdr = struct.unpack(">H", header[50:52])[0]
    crc1_hdr = struct.unpack(">H", header[18:20])[0]

    crc2_calc = crc16_xmodem(rle_data)
    crc1_calc = crc16_xmodem(header[32:64] + rle_data)

    words = []
    for i in range(0, len(rle_data), 4):
        color = int.from_bytes(rle_data[i:i+2], "big")
        count = int.from_bytes(rle_data[i+2:i+4], "big")
        words.extend([color] * count)

    total_pixels = len(words)
    bit15_errors = sum(1 for w in words if (w & 0x8000) != 0)

    green_noise_pixels = 0
    decoded_rgb = []
    
    for w in words:
        r5 = (w >> 10) & 0x1F
        g5 = (w >> 5) & 0x1F
        b5 = w & 0x1F

        if g5 > 0 and r5 == 0 and b5 == 0 and g5 <= 3:
            green_noise_pixels += 1
        elif g5 > (r5 + 3) and g5 > (b5 + 3) and (r5 + g5 + b5) < 18:
            green_noise_pixels += 1

        r8 = r5 * 255 // 31
        g8 = g5 * 255 // 31
        b8 = b5 * 255 // 31
        decoded_rgb.append((r8, g8, b8))

    sim_img = Image.new("RGB", (width, height))
    sim_img.putdata(decoded_rgb)

    is_perfect = (
        width == 800 and height == 480 and
        total_pixels == 384000 and
        magic == 0xAA55AA55 and
        crc1_hdr == crc1_calc and
        crc2_hdr == crc2_calc and
        bit15_errors == 0 and
        green_noise_pixels == 0
    )

    return {
        "source_type": source_type,
        "width": width,
        "height": height,
        "total_pixels": total_pixels,
        "expected_pixels": 384000,
        "magic_valid": magic == 0xAA55AA55,
        "data_size_valid": data_size_hdr == len(rle_data),
        "crc1_valid": crc1_hdr == crc1_calc,
        "crc2_valid": crc2_hdr == crc2_calc,
        "crc1_val": f"{crc1_calc:04x}",
        "crc2_val": f"{crc2_calc:04x}",
        "bit15_errors": bit15_errors,
        "green_noise_pixels": green_noise_pixels,
        "ecu_info": ecu_info,
        "is_perfect": is_perfect,
        "simulated_img": sim_img,
        "fli_bytes": fli_bytes
    }


def find_template_dir(custom_path: Optional[str] = None) -> str:
    """Finds the SWL template directory containing BLSCRIPT.CFG, VERSION.TXT, SWL.FLI."""
    candidates = []
    if custom_path:
        candidates.append(custom_path)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates.extend([
        os.path.join(script_dir, "template_swl"),
        os.path.join(script_dir, "..", "template_swl"),
    ])

    for c in candidates:
        if os.path.isdir(c):
            req_files = [
                os.path.join(c, "BLSCRIPT.CFG"),
                os.path.join(c, "VERSION.TXT"),
                os.path.join(c, "SWL", "SILVER_1", "RNSMIDEC", "SWL", "SWL.FLI")
            ]
            if all(os.path.exists(rf) for rf in req_files):
                return os.path.abspath(c)

    raise FileNotFoundError("Could not find 'template_swl' directory with BLSCRIPT.CFG, VERSION.TXT, and SWL.FLI.")


def create_bootlogo_iso(
    image_path: str,
    output_iso_path: str,
    fit_mode: str = "pad",
    clean_black: bool = True,
    template_dir: Optional[str] = None,
    progress_callback = None
) -> Tuple[str, int, str, str]:
    """Creates a bootable SWL update ISO CD image for RNS 510."""
    if progress_callback:
        progress_callback("Processing image (RGB555 + RLE anti-noise)...", 10)

    rle_data = image_to_rgb555_rle(image_path, target_size=(800, 480), fit_mode=fit_mode, clean_black=clean_black)
    fli_bytes = build_fli_data(rle_data, 800, 480)
    fli_size = len(fli_bytes)

    if progress_callback:
        progress_callback(f"LOGO.FLI generated ({fli_size:,} bytes). Updating ECUORDER.TXT...", 35)

    ecuorder_content = (
        f"SHOW_SCREEN 0 1 SWL_SCREEN_VERSION\r\n"
        f"STRATA_UPDATE 15 {fli_size} /cddos/WA/LOGO.FLI\r\n"
        f"RESTART_SYSTEM\r\n"
        f"FINISHED_DOWNLOAD\r\n"
    ).encode("ascii")

    crc16_num = crc16_xmodem(ecuorder_content)
    crc16_str = f"{crc16_num:04x}"
    crc16_bytes = crc16_str.encode("ascii")

    if progress_callback:
        progress_callback(f"CRC-16 calculated: {crc16_str}. Building ISO 9660 filesystem...", 55)

    tpl_dir = find_template_dir(template_dir)

    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=1, sys_ident="Win32", vol_ident="SWL_LOGO")

    iso.add_directory("/SWL")
    iso.add_directory("/SWL/SILVER_1")
    iso.add_directory("/SWL/SILVER_1/RNSMIDEC")
    iso.add_directory("/SWL/SILVER_1/RNSMIDEC/SWL")
    iso.add_directory("/WA")

    iso.add_file(os.path.join(tpl_dir, "BLSCRIPT.CFG"), "/BLSCRIPT.CFG;1")
    iso.add_fp(io.BytesIO(crc16_bytes), len(crc16_bytes), "/CRC.16;1")
    
    dir_inf_path = os.path.join(tpl_dir, "DIR.INF")
    if os.path.exists(dir_inf_path):
        iso.add_file(dir_inf_path, "/DIR.INF;1")
    else:
        iso.add_fp(io.BytesIO(b"\r\n"), 2, "/DIR.INF;1")

    iso.add_fp(io.BytesIO(ecuorder_content), len(ecuorder_content), "/ECUORDER.TXT;1")
    iso.add_file(os.path.join(tpl_dir, "VERSION.TXT"), "/VERSION.TXT;1")

    iso.add_fp(io.BytesIO(fli_bytes), len(fli_bytes), "/WA/LOGO.FLI;1")

    swl_fli_path = os.path.join(tpl_dir, "SWL", "SILVER_1", "RNSMIDEC", "SWL", "SWL.FLI")
    iso.add_file(swl_fli_path, "/SWL/SILVER_1/RNSMIDEC/SWL/SWL.FLI;1")

    if progress_callback:
        progress_callback("Writing ISO disc image to disk...", 75)

    os.makedirs(os.path.dirname(os.path.abspath(output_iso_path)), exist_ok=True)
    if os.path.exists(output_iso_path):
        os.remove(output_iso_path)

    iso.write(output_iso_path)
    iso.close()

    iso_base = os.path.splitext(output_iso_path)[0]
    preview_png_path = f"{iso_base}_PREVIEW_RNS510.png"
    sim_img = fli_bytes_to_image(fli_bytes)
    sim_img.save(preview_png_path)

    if progress_callback:
        progress_callback("Completed successfully! Verification preview saved.", 100)

    return output_iso_path, fli_size, crc16_str, preview_png_path


# ==============================================================================
#  BILINGUAL DICTIONARY (EN / RO)
# ==============================================================================
STRINGS = {
    "en": {
        "title": "VW RNS 510 Bootlogo Creator & Quality Inspector",
        "subtitle": "Convert images to 15-bit RGB555 & build bootable ISO for RNS 510 / Columbus",
        "preview_mode": "Preview Mode:",
        "sim_radio": "📺 RNS 510 Hardware Simulation (Decoded RGB555)",
        "orig_radio": "🖼️ Original Image",
        "no_image": "No image selected.\nChoose an 800x480 picture to begin.",
        "choose_btn": "📁 Select Image / ISO",
        "scaling": "Scaling:",
        "fit_pad": "Preserve aspect ratio (Black borders)",
        "fit_stretch": "Stretch to 800x480",
        "clean_black": "Anti-Noise filter on black (Prevents green specks)",
        "status_init": "Select an image (recommended 800x480) to start.",
        "status_ready": "Image loaded successfully. Ready to build ISO.",
        "verify_btn": "🔍 Verify Quality & Scan Artifacts",
        "generate_btn": "⚡ Build Bootable RNS 510 ISO CD",
        "open_folder": "📂 Open Folder",
        "report_title": "RNS 510 Logo Quality Report",
        "resolution": "Resolution",
        "optimal": "[OPTIMAL]",
        "adapted": "adapted to 800x480",
        "format": "Color Format",
        "noise": "Green Noise / Specks",
        "clean": "[CLEAN - 0 specks]",
        "success_title": "Success!",
        "success_msg": "Bootable ISO successfully created!\n\n📁 ISO File: {}\n🖼️ Preview: {}\n📊 FLI Size: {:,} bytes\n🔑 Checksum CRC.16: {}\n\nBurn this ISO to a CD-R at 4x or 8x speed.",
        "err_select": "Please select a valid image file first!",
        "diag_header": "====================================================\nRNS 510 LOGO QUALITY DIAGNOSTIC REPORT\n====================================================\n",
        "res_lbl": "• Resolution: {} x {} (Required: 800x480)\n",
        "pixel_lbl": "• Total Decoded Pixels: {:,} / 384,000\n",
        "fmt_lbl": "• Color Depth: RGB 555 (15-bit pure)\n",
        "bit15_lbl": "• Bit 15 Check: {}\n",
        "noise_lbl": "• Green Artifacts: {} suspect noise pixels detected\n",
        "crc1_lbl": "• Header CRC1: {} ({})\n",
        "crc2_lbl": "• Data CRC2:   {} ({})\n",
        "ecu_crc_lbl": "\nISO Disc Verification:\n• Checksum ECUORDER (CRC.16): {} -> {}\n",
        "res_perfect": "\n🎉 RESULT: 100% PERFECT! The image is clean and will not produce green artifacts on screen!",
        "res_warning": "\n⚠️ RESULT: Warnings detected. Please inspect the preview image before burning!"
    },
    "ro": {
        "title": "VW RNS 510 Bootlogo Creator & Inspector Calitate",
        "subtitle": "Conversie RGB555 15-bit fără artefacte + Generare CD ISO Bootabil RNS 510 / Columbus",
        "preview_mode": "Previzualizare:",
        "sim_radio": "📺 Simulare Ecran RNS 510 (Decodat RGB555)",
        "orig_radio": "🖼️ Imagine Originală",
        "no_image": "Nicio imagine selectată.\nAlegeți o imagine 800x480 pentru previzualizare.",
        "choose_btn": "📁 Alege Imagine / ISO",
        "scaling": "Scalare:",
        "fit_pad": "Păstrează proporțiile (margini negre)",
        "fit_stretch": "Întinde la 800x480",
        "clean_black": "Filtru anti-purici pe fundal negru",
        "status_init": "Selectați o imagine (recomandat 800x480) pentru a începe.",
        "status_ready": "Imagine încărcată cu succes. Gata pentru generare ISO.",
        "verify_btn": "🔍 Verifică Calitate & Artefacte",
        "generate_btn": "⚡ Generează CD ISO Bootabil RNS 510",
        "open_folder": "📂 Deschide Folder",
        "report_title": "Raport Calitate Logo RNS 510",
        "resolution": "Rezoluție",
        "optimal": "[OPTIM]",
        "adapted": "adaptat la 800x480",
        "format": "Format Culoare",
        "noise": "Purici Verzi / Zgomot",
        "clean": "[CURAT - 0 purici]",
        "success_title": "Succes!",
        "success_msg": "Imaginea ISO bootabilă a fost creată cu succes!\n\n📁 Fișier ISO: {}\n🖼️ Previzualizare: {}\n📊 Mărime FLI: {:,} octeți\n🔑 Checksum CRC.16: {}\n\nArdeți acest ISO pe un CD-R la viteză 4x sau 8x.",
        "err_select": "Vă rugăm să selectați o imagine validă mai întâi!",
        "diag_header": "====================================================\nRAPORT VERIFICARE CALITATE LOGO RNS 510\n====================================================\n",
        "res_lbl": "• Rezoluție: {} x {} (Necesar: 800x480)\n",
        "pixel_lbl": "• Număr Total Pixeli: {:,} / 384,000 pixeli\n",
        "fmt_lbl": "• Format Culoare: RGB 555 (15 biți pur)\n",
        "bit15_lbl": "• Bit 15 Neutilizat: {}\n",
        "noise_lbl": "• Scanare Purici Verzi: {} pixeli suspecti detectați\n",
        "crc1_lbl": "• Sumă CRC1 Header: {} ({})\n",
        "crc2_lbl": "• Sumă CRC2 Date:   {} ({})\n",
        "ecu_crc_lbl": "\nVerificare disc ISO:\n• Checksum ECUORDER (CRC.16): {} -> {}\n",
        "res_perfect": "\n🎉 REZULTAT: 100% PERFECT! Imaginea este sigură și nu va produce artefacte sau purici verzi pe ecran!",
        "res_warning": "\n⚠️ REZULTAT: S-au detectat avertismente. Vă rugăm verificați previzualizarea!"
    }
}


def launch_gui():
    """Graphical User Interface with EN / RO language toggle."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    from PIL import ImageTk

    root = tk.Tk()
    root.geometry("760x720")
    root.minsize(680, 640)

    lang_var = tk.StringVar(value="en")  # Default English for GitHub

    def t(key):
        return STRINGS[lang_var.get()].get(key, key)

    root.title(t("title"))

    BG_COLOR = "#181822"
    CARD_BG = "#242432"
    TEXT_COLOR = "#f0f0f5"
    ACCENT_COLOR = "#0078d4"

    root.configure(bg=BG_COLOR)

    selected_image_path = tk.StringVar(value="")
    output_iso_path = tk.StringVar(value="")
    fit_mode_var = tk.StringVar(value="pad")
    clean_black_var = tk.BooleanVar(value=True)
    preview_mode_var = tk.StringVar(value="simulated")
    status_text = tk.StringVar(value=t("status_init"))

    cached_original_img = [None]
    cached_simulated_img = [None]
    img_ref = [None]

    # Top Header
    header_frame = tk.Frame(root, bg=BG_COLOR)
    header_frame.pack(fill="x", padx=20, pady=(10, 4))

    top_row = tk.Frame(header_frame, bg=BG_COLOR)
    top_row.pack(fill="x")

    title_lbl = tk.Label(top_row, text=t("title"), font=("Segoe UI", 15, "bold"), fg=TEXT_COLOR, bg=BG_COLOR)
    title_lbl.pack(side="left")

    def toggle_lang():
        new_lang = "ro" if lang_var.get() == "en" else "en"
        lang_var.set(new_lang)
        btn_lang.configure(text="🇷🇴 Română" if new_lang == "ro" else "🇬🇧 English")
        root.title(t("title"))
        title_lbl.configure(text=t("title"))
        sub_lbl.configure(text=t("subtitle"))
        lbl_view.configure(text=t("preview_mode"))
        rb_sim.configure(text=t("sim_radio"))
        rb_orig.configure(text=t("orig_radio"))
        browse_btn.configure(text=t("choose_btn"))
        lbl_opt.configure(text=t("scaling"))
        pad_rb.configure(text=t("fit_pad"))
        stretch_rb.configure(text=t("fit_stretch"))
        chk_clean.configure(text=t("clean_black"))
        btn_verify.configure(text=t("verify_btn"))
        generate_btn.configure(text=t("generate_btn"))
        open_btn.configure(text=t("open_folder"))
        if not selected_image_path.get():
            preview_lbl.configure(text=t("no_image"))
            status_text.set(t("status_init"))

    btn_lang = tk.Button(top_row, text="🇬🇧 English", font=("Segoe UI", 9, "bold"), bg="#333346", fg="white", relief="flat", padx=10, pady=3, cursor="hand2", command=toggle_lang)
    btn_lang.pack(side="right")

    sub_lbl = tk.Label(header_frame, text=t("subtitle"), font=("Segoe UI", 9), fg="#9090a4", bg=BG_COLOR)
    sub_lbl.pack(anchor="w")

    # Card
    card = tk.Frame(root, bg=CARD_BG, relief="flat", bd=1)
    card.pack(fill="both", expand=True, padx=20, pady=6)

    # Preview Toggle
    toggle_frame = tk.Frame(card, bg=CARD_BG)
    toggle_frame.pack(fill="x", padx=15, pady=(8, 4))

    lbl_view = tk.Label(toggle_frame, text=t("preview_mode"), font=("Segoe UI", 9, "bold"), fg=TEXT_COLOR, bg=CARD_BG)
    lbl_view.pack(side="left")

    def refresh_display():
        if preview_mode_var.get() == "original" and cached_original_img[0]:
            img_to_show = cached_original_img[0]
        elif cached_simulated_img[0]:
            img_to_show = cached_simulated_img[0]
        else:
            return

        disp = img_to_show.copy()
        disp.thumbnail((440, 264), Image.Resampling.LANCZOS)
        tk_img = ImageTk.PhotoImage(disp)
        img_ref[0] = tk_img
        preview_lbl.configure(image=tk_img, text="")

    rb_sim = tk.Radiobutton(
        toggle_frame, text=t("sim_radio"), variable=preview_mode_var,
        value="simulated", font=("Segoe UI", 9, "bold"), fg="#4da3ff", bg=CARD_BG, selectcolor="#161620",
        activebackground=CARD_BG, command=refresh_display
    )
    rb_sim.pack(side="left", padx=(12, 8))

    rb_orig = tk.Radiobutton(
        toggle_frame, text=t("orig_radio"), variable=preview_mode_var,
        value="original", font=("Segoe UI", 9), fg=TEXT_COLOR, bg=CARD_BG, selectcolor="#161620",
        activebackground=CARD_BG, command=refresh_display
    )
    rb_orig.pack(side="left")

    preview_box = tk.Frame(card, bg="#101016", width=460, height=276)
    preview_box.pack(pady=4, padx=15)
    preview_box.pack_propagate(False)

    preview_lbl = tk.Label(preview_box, text=t("no_image"), fg="#606070", bg="#101016", font=("Segoe UI", 10))
    preview_lbl.pack(expand=True)

    diag_frame = tk.Frame(card, bg="#161620", relief="flat")
    diag_frame.pack(fill="x", padx=15, pady=5)

    diag_text = tk.StringVar(value="Status: Waiting for image / În așteptarea imaginii")
    diag_lbl = tk.Label(diag_frame, textvariable=diag_text, font=("Consolas", 9), fg="#90caf9", bg="#161620", padx=10, pady=4)
    diag_lbl.pack(anchor="w")

    def process_and_preview(path):
        try:
            pil_img = Image.open(path)
            cached_original_img[0] = pil_img.copy()

            analysis = analyze_and_verify(path)
            cached_simulated_img[0] = analysis["simulated_img"]

            orig_w, orig_h = pil_img.size
            if (orig_w, orig_h) == (800, 480):
                res_badge = f"800x480 {t('optimal')}"
            else:
                res_badge = f"{orig_w}x{orig_h} -> {t('adapted')}"

            green_flag = f"0 {t('clean')}" if analysis["green_noise_pixels"] == 0 else f"{analysis['green_noise_pixels']} artifacts"
            color_badge = "RGB555 (15-bit)"

            msg = f"✓ {t('resolution')}: {res_badge}  |  ✓ {t('format')}: {color_badge}  |  ✓ {t('noise')}: {green_flag}"
            diag_text.set(msg)
            if analysis["is_perfect"]:
                diag_lbl.configure(fg="#4caf50")
            else:
                diag_lbl.configure(fg="#ffb74d")

            refresh_display()
            status_text.set(t("status_ready"))
        except Exception as e:
            preview_lbl.configure(image="", text=f"Error: {e}")
            diag_text.set(f"Error: {e}")
            diag_lbl.configure(fg="#e57373")

    def browse_image():
        path = filedialog.askopenfilename(
            title=t("choose_btn"),
            filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.bmp"), ("ISO Files", "*.iso"), ("FLI Files", "*.fli"), ("All Files", "*.*")]
        )
        if path:
            selected_image_path.set(path)
            base_name = os.path.splitext(os.path.basename(path))[0]
            default_iso = os.path.join(os.path.dirname(path), f"RNS510_Bootlogo_{base_name}.iso")
            output_iso_path.set(default_iso)
            process_and_preview(path)

    select_row = tk.Frame(card, bg=CARD_BG)
    select_row.pack(fill="x", padx=15, pady=4)

    browse_btn = tk.Button(
        select_row, text=t("choose_btn"), font=("Segoe UI", 9, "bold"),
        bg="#36364a", fg="white", activebackground="#46465e", activeforeground="white",
        relief="flat", padx=12, pady=5, cursor="hand2", command=browse_image
    )
    browse_btn.pack(side="left")

    path_entry = tk.Entry(select_row, textvariable=selected_image_path, font=("Segoe UI", 9), bg="#161620", fg=TEXT_COLOR, relief="flat", bd=1)
    path_entry.pack(side="left", fill="x", expand=True, padx=(8, 0), ipady=4)

    opt_row = tk.Frame(card, bg=CARD_BG)
    opt_row.pack(fill="x", padx=15, pady=5)

    lbl_opt = tk.Label(opt_row, text=t("scaling"), font=("Segoe UI", 9), fg=TEXT_COLOR, bg=CARD_BG)
    lbl_opt.pack(side="left")

    pad_rb = tk.Radiobutton(opt_row, text=t("fit_pad"), variable=fit_mode_var, value="pad", font=("Segoe UI", 8), fg=TEXT_COLOR, bg=CARD_BG, selectcolor="#161620", activebackground=CARD_BG)
    pad_rb.pack(side="left", padx=5)

    stretch_rb = tk.Radiobutton(opt_row, text=t("fit_stretch"), variable=fit_mode_var, value="stretch", font=("Segoe UI", 8), fg=TEXT_COLOR, bg=CARD_BG, selectcolor="#161620", activebackground=CARD_BG)
    stretch_rb.pack(side="left", padx=5)

    chk_clean = tk.Checkbutton(
        opt_row, text=t("clean_black"), variable=clean_black_var,
        font=("Segoe UI", 8, "bold"), fg="#81c784", bg=CARD_BG, selectcolor="#161620", activebackground=CARD_BG
    )
    chk_clean.pack(side="right")

    prog_frame = tk.Frame(root, bg=BG_COLOR)
    prog_frame.pack(fill="x", padx=20, pady=4)

    prog_bar = ttk.Progressbar(prog_frame, mode="determinate")
    prog_bar.pack(fill="x")

    status_lbl = tk.Label(prog_frame, textvariable=status_text, font=("Segoe UI", 9), fg="#b0b0c5", bg=BG_COLOR)
    status_lbl.pack(anchor="w", pady=(3, 0))

    action_frame = tk.Frame(root, bg=BG_COLOR)
    action_frame.pack(fill="x", padx=20, pady=(6, 12))

    def on_verify_details():
        in_p = selected_image_path.get().strip()
        if not in_p or not os.path.exists(in_p):
            messagebox.showwarning("Warning", t("err_select"))
            return

        res = analyze_and_verify(in_p)
        msg = t("diag_header")
        msg += t("res_lbl").format(res["width"], res["height"])
        msg += t("pixel_lbl").format(res["total_pixels"])
        msg += t("fmt_lbl")
        msg += t("bit15_lbl").format("OK (0 on all pixels)" if res["bit15_errors"] == 0 else "ERROR / EROARE")
        msg += t("noise_lbl").format(res["green_noise_pixels"])
        msg += t("crc1_lbl").format("VALID" if res["crc1_valid"] else "INVALID", res["crc1_val"])
        msg += t("crc2_lbl").format("VALID" if res["crc2_valid"] else "INVALID", res["crc2_val"])

        if res.get("ecu_info"):
            msg += t("ecu_crc_lbl").format(res["ecu_info"]["crc_file"], "VALID" if res["ecu_info"]["crc_valid"] else "MISMATCH")

        if res["is_perfect"]:
            msg += t("res_perfect")
            messagebox.showinfo(t("report_title"), msg)
        else:
            msg += t("res_warning")
            messagebox.showwarning(t("report_title"), msg)

    btn_verify = tk.Button(
        action_frame, text=t("verify_btn"), font=("Segoe UI", 10),
        bg="#303042", fg="white", relief="flat", padx=14, pady=9, cursor="hand2", command=on_verify_details
    )
    btn_verify.pack(side="left")

    def on_generate():
        in_path = selected_image_path.get().strip()
        if not in_path or not os.path.exists(in_path):
            messagebox.showerror("Error", t("err_select"))
            return

        out_iso = output_iso_path.get().strip()
        if not out_iso:
            out_iso = os.path.splitext(in_path)[0] + ".iso"
            output_iso_path.set(out_iso)

        def cb(msg, val):
            status_text.set(msg)
            prog_bar["value"] = val
            root.update_idletasks()

        try:
            generate_btn.config(state="disabled")
            iso_file, fli_sz, c16, prev_png = create_bootlogo_iso(
                in_path,
                out_iso,
                fit_mode=fit_mode_var.get(),
                clean_black=clean_black_var.get(),
                progress_callback=cb
            )
            messagebox.showinfo(
                t("success_title"),
                t("success_msg").format(iso_file, os.path.basename(prev_png), fli_sz, c16)
            )
        except Exception as err:
            messagebox.showerror("Error", f"Failed to generate ISO:\n{err}")
        finally:
            generate_btn.config(state="normal")

    generate_btn = tk.Button(
        action_frame, text=t("generate_btn"), font=("Segoe UI", 11, "bold"),
        bg=ACCENT_COLOR, fg="white", activebackground="#005a9e", activeforeground="white",
        relief="flat", padx=18, pady=9, cursor="hand2", command=on_generate
    )
    generate_btn.pack(side="left", fill="x", expand=True, padx=10)

    def open_folder():
        iso_p = output_iso_path.get()
        if iso_p and os.path.exists(iso_p):
            os.system(f'explorer /select,"{os.path.abspath(iso_p)}"')
        elif selected_image_path.get() and os.path.exists(selected_image_path.get()):
            os.system(f'explorer /select,"{os.path.abspath(selected_image_path.get())}"')

    open_btn = tk.Button(action_frame, text=t("open_folder"), font=("Segoe UI", 10), bg="#303042", fg="white", relief="flat", padx=12, pady=9, cursor="hand2", command=open_folder)
    open_btn.pack(side="right")

    root.mainloop()


def main():
    parser = argparse.ArgumentParser(
        description="RNS 510 Bootlogo Creator & Quality Inspector (English / Română)"
    )
    parser.add_argument("image", nargs="?", help="Input image (PNG, JPG, BMP) or ISO/FLI file to verify")
    parser.add_argument("output", nargs="?", help="Output ISO path (optional)")
    parser.add_argument("--fit", choices=["pad", "stretch"], default="pad", help="Scaling mode for 800x480 (default: pad with black bars)")
    parser.add_argument("--no-clean-black", action="store_true", help="Disable the anti-noise black clamping filter")
    parser.add_argument("--verify", action="store_true", help="Run artifact & quality diagnostic analysis")
    parser.add_argument("--fli-only", metavar="FLI_OUT", help="Generate only LOGO.FLI binary without building an ISO")
    parser.add_argument("--extract-fli", metavar="IMAGE_OUT", help="Extract and decode a .FLI file into PNG/BMP")
    parser.add_argument("--template-dir", help="Path to SWL template directory")
    parser.add_argument("--gui", action="store_true", help="Launch graphical user interface")

    args = parser.parse_args()

    if args.extract_fli:
        if not args.image:
            print("[ERROR / EROARE] Please specify the input FLI file as the first argument.")
            sys.exit(1)
        print(f"Decoding {args.image} -> {args.extract_fli}...")
        fli_to_image(args.image, args.extract_fli)
        print("Done / Finalizat!")
        return

    if args.verify:
        target = args.image
        if not target:
            print("[ERROR / EROARE] Please specify a file to verify (image, .fli, or .iso).")
            sys.exit(1)

        print("=================================================================")
        print(f"  RNS 510 Quality & Artifact Diagnostic: {target}")
        print("=================================================================")
        res = analyze_and_verify(target)
        print(f"  • Source Type / Tip    : {res['source_type'].upper()}")
        print(f"  • Resolution           : {res['width']} x {res['height']} (Expected: 800x480)")
        print(f"  • Decoded Pixels       : {res['total_pixels']:,} / {res['expected_pixels']:,}")
        print(f"  • Color Format         : RGB555 (15-bit pure)")
        print(f"  • Bit 15 Errors        : {res['bit15_errors']} (Must be 0)")
        print(f"  • Green Specks / Noise : {res['green_noise_pixels']} detected")
        print(f"  • Header CRC1          : {'VALID' if res['crc1_valid'] else 'INVALID'} ({res['crc1_val']})")
        print(f"  • Data CRC2            : {'VALID' if res['crc2_valid'] else 'INVALID'} ({res['crc2_val']})")

        if res.get("ecu_info"):
            ecu = res["ecu_info"]
            print(f"  • ECUORDER CRC.16      : {ecu['crc_file']} -> {'VALID' if ecu['crc_valid'] else 'MISMATCH'}")

        preview_out = os.path.splitext(target)[0] + "_PREVIEW_RNS510.png"
        res["simulated_img"].save(preview_out)
        print(f"  • Screen Preview       : Saved to '{preview_out}'")
        print("-----------------------------------------------------------------")
        if res["is_perfect"]:
            print("  [✓] CONCLUSION: 100% PERFECT & CLEAN! Safe to flash!")
        else:
            print("  [!] CONCLUSION: Warnings detected. Please check the preview image!")
        print("=================================================================")
        return

    if args.gui or (not args.image and not args.fli_only):
        launch_gui()
        return

    input_img = args.image

    if args.fli_only:
        print(f"Generating FLI for: {input_img}...")
        rle = image_to_rgb555_rle(input_img, fit_mode=args.fit, clean_black=not args.no_clean_black)
        fli = build_fli_data(rle, 800, 480)
        with open(args.fli_only, "wb") as f:
            f.write(fli)
        print(f"LOGO.FLI saved to: {args.fli_only} ({len(fli):,} bytes)")
        return

    output_iso = args.output
    if not output_iso:
        base, _ = os.path.splitext(input_img)
        output_iso = f"{base}_RNS510_bootlogo.iso"

    print("=================================================================")
    print("  VW RNS 510 Bootlogo Creator & ISO Builder")
    print("=================================================================")
    print(f"  Input image : {input_img}")
    print(f"  Output ISO  : {output_iso}")
    print(f"  Fit mode    : {args.fit}")
    print(f"  Anti-noise  : {'Enabled' if not args.no_clean_black else 'Disabled'}")
    print("-----------------------------------------------------------------")

    def cli_progress(msg, pct):
        print(f"  [{pct:3d}%] {msg}")

    try:
        iso_path, fli_size, c16, prev_png = create_bootlogo_iso(
            input_img,
            output_iso,
            fit_mode=args.fit,
            clean_black=not args.no_clean_black,
            template_dir=args.template_dir,
            progress_callback=cli_progress
        )
        print("-----------------------------------------------------------------")
        print(f"[SUCCESS / SUCCES] Bootable ISO successfully created!")
        print(f"  ISO File   : {iso_path}")
        print(f"  Preview    : {prev_png}")
        print(f"  FLI Size   : {fli_size:,} bytes")
        print(f"  CRC.16     : {c16}")
        print("=================================================================")
        print("Instructions:")
        print("  1. Burn the ISO file to a quality blank CD-R at low speed (4x - 8x).")
        print("  2. Turn on car ignition, turn on RNS 510.")
        print("  3. Insert CD and press: SETUP + EJECT + MIC (or INFO).")
        print("  4. The system will flash the bootlogo and restart automatically!")
        print("=================================================================")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
