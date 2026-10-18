#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web Bridge for Next.js - VW RNS 510 Bootlogo Toolkit
Executes ISO generation, FLI conversion, and artifact verification, returning clean JSON.
"""

import os
import sys
import json
import base64
import argparse
import traceback
from PIL import Image

# Ensure parent directory is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import rns510_bootlogo


def process_image_dimensions(img: Image.Image, fit_mode: str = "pad", target_size=(800, 480)) -> Image.Image:
    """Pre-processes image to exactly 800x480 using pad, stretch, or crop/fill."""
    tar_w, tar_h = target_size
    
    # Handle alpha
    if img.mode in ("RGBA", "LA") or ("transparency" in img.info):
        bg = Image.new("RGB", img.size, (0, 0, 0))
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")

    if img.size == target_size:
        return img

    src_w, src_h = img.size

    if fit_mode == "stretch":
        return img.resize(target_size, Image.Resampling.LANCZOS)
    elif fit_mode == "crop":
        scale = max(tar_w / src_w, tar_h / src_h)
        new_w, new_h = max(1, int(src_w * scale)), max(1, int(src_h * scale))
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - tar_w) // 2
        top = (new_h - tar_h) // 2
        return resized.crop((left, top, left + tar_w, top + tar_h))
    else:  # pad
        scale = min(tar_w / src_w, tar_h / src_h)
        new_w, new_h = max(1, int(src_w * scale)), max(1, int(src_h * scale))
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", target_size, (0, 0, 0))
        paste_x = (tar_w - new_w) // 2
        paste_y = (tar_h - new_h) // 2
        canvas.paste(resized, (paste_x, paste_y))
        return canvas


def action_generate(args):
    input_image = args.image
    out_dir = args.out_dir or os.path.join(SCRIPT_DIR, "web", "public", "generated")
    os.makedirs(out_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(input_image))[0]
    out_iso = os.path.join(out_dir, f"{base_name}_RNS510.iso")
    out_fli = os.path.join(out_dir, f"{base_name}_LOGO.FLI")
    out_preview = os.path.join(out_dir, f"{base_name}_PREVIEW.png")

    clean_black = not args.no_clean_black
    fit_mode = args.fit or "pad"

    # Pre-adjust image if crop
    with Image.open(input_image) as raw_img:
        preprocessed = process_image_dimensions(raw_img, fit_mode=fit_mode)
        temp_input = os.path.join(out_dir, f"temp_{os.path.basename(input_image)}")
        preprocessed.save(temp_input, format="PNG")

    # Generate ISO using toolkit
    iso_path, fli_size, crc16_str, prev_path = rns510_bootlogo.create_bootlogo_iso(
        image_path=temp_input,
        output_iso_path=out_iso,
        fit_mode="pad",  # already sized to 800x480
        clean_black=clean_black,
        template_dir=args.template_dir
    )

    # Also extract raw FLI
    rle = rns510_bootlogo.image_to_rgb555_rle(temp_input, target_size=(800, 480), clean_black=clean_black)
    fli_data = rns510_bootlogo.build_fli_data(rle, 800, 480)
    with open(out_fli, "wb") as f:
        f.write(fli_data)

    # Clean temporary image
    if os.path.exists(temp_input):
        try:
            os.remove(temp_input)
        except Exception:
            pass

    # Diagnostic check on generated FLI
    diag = rns510_bootlogo.analyze_and_verify(out_iso)

    return {
        "success": True,
        "iso_file": os.path.basename(iso_path),
        "fli_file": os.path.basename(out_fli),
        "preview_file": os.path.basename(prev_path),
        "fli_size_bytes": fli_size,
        "crc16": crc16_str,
        "is_perfect": diag.get("is_perfect", True),
        "bit15_errors": diag.get("bit15_errors", 0),
        "green_noise_pixels": diag.get("green_noise_pixels", 0),
        "total_pixels": diag.get("total_pixels", 384000),
    }


def action_verify(args):
    target = args.file
    if not os.path.exists(target):
        return {"success": False, "error": f"File not found: {target}"}

    out_dir = args.out_dir or os.path.join(SCRIPT_DIR, "web", "public", "generated")
    os.makedirs(out_dir, exist_ok=True)

    res = rns510_bootlogo.analyze_and_verify(target)
    
    # Save preview image
    base_name = os.path.splitext(os.path.basename(target))[0]
    preview_filename = f"verify_{base_name}_PREVIEW.png"
    preview_full_path = os.path.join(out_dir, preview_filename)
    res["simulated_img"].save(preview_full_path)

    ecu_status = None
    if res.get("ecu_info"):
        ecu = res["ecu_info"]
        ecu_status = {
            "crc_file": ecu.get("crc_file"),
            "crc_calc": ecu.get("crc_calc"),
            "crc_valid": ecu.get("crc_valid", False)
        }

    return {
        "success": True,
        "source_type": res.get("source_type"),
        "width": res.get("width"),
        "height": res.get("height"),
        "total_pixels": res.get("total_pixels"),
        "expected_pixels": res.get("expected_pixels"),
        "magic_valid": res.get("magic_valid"),
        "crc1_valid": res.get("crc1_valid"),
        "crc2_valid": res.get("crc2_valid"),
        "crc1_val": res.get("crc1_val"),
        "crc2_val": res.get("crc2_val"),
        "bit15_errors": res.get("bit15_errors"),
        "green_noise_pixels": res.get("green_noise_pixels"),
        "is_perfect": res.get("is_perfect"),
        "ecu_info": ecu_status,
        "preview_file": preview_filename
    }


def main():
    parser = argparse.ArgumentParser(description="JSON bridge for Next.js web application")
    parser.add_argument("--action", required=True, choices=["generate", "verify"])
    parser.add_argument("--image", help="Input image path for generate action")
    parser.add_argument("--file", help="Input file path (.iso, .fli, or image) for verify action")
    parser.add_argument("--fit", choices=["pad", "stretch", "crop"], default="pad")
    parser.add_argument("--no-clean-black", action="store_true")
    parser.add_argument("--out-dir", help="Output directory for generated files")
    parser.add_argument("--template-dir", help="Path to SWL template directory")

    args = parser.parse_args()

    try:
        if args.action == "generate":
            if not args.image:
                print(json.dumps({"success": False, "error": "Missing --image parameter"}))
                sys.exit(1)
            result = action_generate(args)
            print(json.dumps(result))
        elif args.action == "verify":
            if not args.file:
                print(json.dumps({"success": False, "error": "Missing --file parameter"}))
                sys.exit(1)
            result = action_verify(args)
            print(json.dumps(result))
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
