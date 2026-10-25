# VW RNS 510 Bootlogo Toolkit 🚗✨
**Custom Bootlogo Creator, ISO Builder, Decompiler & Hardware-Accurate Quality Verifier**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![Tested on RNS 510](https://img.shields.io/badge/tested%20on-VW%20RNS%20510%20%7C%20Columbus%20%7C%20Seat%20Media-red.svg)]()

> 🌐 **Language / Limbă**:  
> **English Documentation** (Current) | [🇷🇴 **Ghid complet în limba Română (README_RO.md)**](README_RO.md)

---

## 📖 Introduction

**VW RNS 510 Bootlogo Toolkit** is an open-source, publication-ready utility suite for customizing the startup boot splash screen on **Volkswagen RNS 510**, **Škoda Columbus**, and **SEAT Media System** automotive head units.

Older web-based or closed-source tools frequently produced corrupted images with **green noise specks** ("purici verzi"), misaligned 16-bit color channels, or bad ISO sector checksums that resulted in failed updates. 

This repository provides a mathematically exact, reverse-engineered solution that handles:
1. **Pixel-accurate 15-bit RGB555 encoding** (with bit-15 clean masking).
2. **Intelligent anti-artifact filtering** for dark gradients and compression noise.
3. **Native big-endian RLE (Run-Length Encoding)** matching OEM factory firmware.
4. **CRC-16/XMODEM calculation** for both `.FLI` headers and disc `CRC.16`.
5. **Bootable SWL ISO disc generation** using `pycdlib`.
6. **Direct ISO Decompiler & Quality Verifier** to inspect any existing ISO or image before flashing.
7. **Full Dual-Language Support**: Seamlessly switch between **English** and **Română** in the GUI and CLI.

---

## 🌟 Key Features

* **🎨 Interactive Modern GUI**:
  * Clean, dark-mode responsive graphical interface built with Tkinter.
  * Real-time hardware preview with zoom and CRT/LCD pixel simulation.
  * Instant language switcher (`[🇬🇧 English / 🇷🇴 Română]`).
  * Real-time progress tracking and visual sanity checks.

* **🔍 Direct ISO Decompiler & Inspector (`rns510_iso_viewer.py`)**:
  * Open any custom or OEM update `.ISO` file directly without extracting it first.
  * Extracts `LOGO.FLI`, validates CRC1 and CRC2, and reconstructs the exact 800×480 screen.
  * Scans for rogue green pixels and displays a detailed health diagnostic report.
  * Export the extracted logo directly as a high-resolution PNG.

* **🛡️ Zero Green Noise / Anti-Artifact Filter**:
  * Converts 24-bit/32-bit images to pure 15-bit RGB555 (`0RRRRRGGGGGBBBBB`).
  * Prevents the common green-shift bug caused by treating RGB555 as RGB565.
  * Automatically detects and clamps residual compression noise in deep blacks.

* **📀 Safe 1-Click Bootable CD ISO Creation**:
  * Packages the generated `LOGO.FLI` into an authentic VW Software Loading (SWL) directory tree (`WA/LOGO.FLI`, `VERSION.TXT`, `BLSCRIPT.CFG`, `DIR.INF`, `SWL.FLI`).
  * Dynamically computes and writes the matching `CRC.16` for `ECUORDER.TXT`.
  * Only updates flash **Sector 15** (`STRATA_UPDATE 15`): **does not touch maps, radio coding, or firmware core**.

* **🗺️ Map Source Verifier (`verify_map.bat`, `map_verify.py`, `mapverify/`)**:
  * Comprehensive pre-install integrity checker for VW RNS 510 navigation map sources.
  * Verifies folders, SD cards, ISO images, and downloaded archives *before* you spend 60+ minutes updating your head unit.
  * Detects missing/truncated files, case collisions, FAT32 4 GiB limits, corrupted ISO extents, and fake/counterfeit SD cards.
  * Modern dark-mode Tkinter GUI and full-featured CLI with dual-language (RO/EN) reporting.

* **⚡ Windows Drag-and-Drop Batch Files**:
  * `verify_map.bat`: Drag any map folder, ISO image, archive, or manifest to launch the Map Source Verifier GUI.
  * `start_web_studio.bat`: Launch the Next.js Web Studio with real-time RGB555 simulation in your browser with 1 click.
  * `create_bootable_iso.bat`: Drag any image file onto the batch script to produce an ISO in seconds.
  * `verify_logo_quality.bat`: Drag any image, `.fli`, or `.iso` to inspect for artifacts.
  * `decompile_view_iso.bat`: Drag an `.iso` file to launch the visual inspector.

---

## 🔬 Reverse-Engineered Technical Specifications

Through binary analysis of factory firmware update packages, the proprietary `.FLI` image container has been fully documented:

### 1. The 64-Byte `.FLI` Header
```text
Offset    Size   Type          Description
--------------------------------------------------------------------------------
0x00      4      uint32_be     Magic Signature: 0xAA55AA55
0x04      4      uint32_be     Header CRC1 (CRC-16/XMODEM over bytes 0x08..0x3F)
0x08      4      uint32_be     Image Width: 800 (0x00000320)
0x0C      4      uint32_be     Image Height: 480 (0x000001E0)
0x10      4      uint32_be     Data CRC2 (CRC-16/XMODEM over entire RLE payload)
0x14      4      uint32_be     Uncompressed Size: 768,000 bytes (800 * 480 * 2)
0x18      4      uint32_be     Format Flag: 0x00000001
0x1C      4      uint32_be     Header Size: 0x00000040 (64 bytes)
0x20..3F  32     bytes         Reserved zero padding (0x00)
```

### 2. The Color Format: 15-Bit RGB555
The display processor operates in **RGB555**, not standard PC RGB565:
* **Bit 15**: Must be `0` (clean MSB).
* **Bits 14–10**: Red (5 bits, 0–31).
* **Bits 9–5**: Green (5 bits, 0–31).
* **Bits 4–0**: Blue (5 bits, 0–31).

> **Why older tools produced green noise:**  
> Legacy tools packed pixels using RGB565 (6 green bits) or incorrectly shifted the green channel, placing a stray bit into bit 5 or bit 15. The RNS 510 hardware interpreted this as bright fluorescent green specks on black backgrounds. Our toolkit strictly guarantees bit 15 is zero and isolates the 5-bit color boundaries.

### 3. RLE Compression
Immediately following the 64-byte header is the compressed stream. Data is stored in 4-byte chunks (Big-Endian):
```text
[2 bytes: RGB555 Color] [2 bytes: Repeat Count]
```
Pixels are scanned left-to-right, row-by-row, from row 0 to row 479, totalling exactly 384,000 pixels.

### 4. Checksums
* **CRC1 & CRC2**: Standard `CRC-16/XMODEM` (Polynomial: `0x1021`, Initial Value: `0x0000`).
* **`CRC.16` on disc**: Contains the 4-digit lowercase hex `CRC-16/XMODEM` of `ECUORDER.TXT`.

---

## 📦 Requirements & Installation

1. Install **Python 3.8** or newer from [python.org](https://www.python.org/downloads/) (Make sure to check *"Add Python to PATH"* during Windows setup).
2. Clone or download this repository:
   ```bash
   git clone https://github.com/Edward03YT/RNS510-Bootlogo-Toolkit.git
   cd RNS510-Bootlogo-Toolkit
   ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   *(Dependencies: `Pillow>=9.0.0` for image processing and `pycdlib>=1.12.0` for ISO creation).*

---

## 🚀 How to Use

### Method 1: Graphical User Interface (Recommended)
Double-click `create_bootable_iso.bat` or run:
```bash
python rns510_bootlogo.py --gui
```
1. Click **"Choose Image / Alege Imagine"** and select any PNG, JPG, or BMP (800×480 recommended).
2. Choose your preferred scaling mode:
   * **Fit with Black Bars (Letterbox)**: Preserves original aspect ratio.
   * **Stretch to 800x480**: Fills the entire display.
3. Check the **"Anti-Artifact Filter"** checkbox (recommended).
4. Click **"Generate Bootable ISO / Creează ISO Bootabil"**.
5. The bootable `.iso` and a high-resolution simulation preview `.png` are generated instantly!

---

### Method 2: Inspecting & Decompiling ISOs
To inspect an existing ISO or verify your new creation:
Double-click `decompile_view_iso.bat` or run:
```bash
python rns510_iso_viewer.py
```
* Or pass the file directly in terminal mode:
  ```bash
  python rns510_iso_viewer.py my_bootlogo.iso --cli
  ```
The diagnostic engine will verify CRC1, CRC2, `CRC.16`, count pixels, and report any green noise artifacts.

---

### Method 3: Drag and Drop (Windows)
* **To create an ISO**: Drag any image file directly onto `create_bootable_iso.bat`.
* **To check quality**: Drag any image, `.fli`, or `.iso` file onto `verify_logo_quality.bat`.
* **To decompile an ISO**: Drag any `.iso` file onto `decompile_view_iso.bat`.

---

### Method 4: Command Line Interface (CLI)
```bash
# Generate bootable ISO with default settings:
python rns510_bootlogo.py my_logo.png -o bootlogo.iso

# Stretch image to fill screen without black bars:
python rns510_bootlogo.py my_logo.jpg -o bootlogo.iso --fit stretch

# Export standalone LOGO.FLI only:
python rns510_bootlogo.py my_logo.png --fli-only LOGO.FLI

# Run full quality diagnostic on any image or ISO:
python rns510_bootlogo.py bootlogo.iso --verify
```

---

## 💿 Burning & Car Flashing Instructions

### Step 1: Burning the CD
1. Use a high-quality blank **CD-R** (Verbatim, Sony, or TDK). **Do NOT use CD-RW or DVD media**; automotive optical drives read CD-R best.
2. Burn using software like **ImgBurn** or **CDBurnerXP**.
3. Select **"Write image file to disc"**.
4. Set write speed to the **lowest possible speed** (e.g., 4x or 8x) to ensure clear pits and lands.
5. Enable **Verify disc after burning**.

### Step 2: Flashing onto the RNS 510 Unit
> ⚠️ **Safety Tip**: The bootlogo update writes only to Sector 15 and takes approximately 1 to 2 minutes. Keep your car ignition turned on. If your car battery is weak, hook up a battery maintainer/charger or keep the engine running in park/neutral.

1. Turn on the vehicle ignition and switch on the **RNS 510** unit.
2. Eject any existing navigation DVD or audio CD.
3. Insert your newly burned bootlogo CD-R into the slot.
4. Press and hold the three-button reboot combination:
   * **`SETUP` + `EJECT` + `MIC`** (or **`INFO`** on older physical button layouts).
5. The unit will reboot and enter **Software Loading (SWL)** mode.
6. A screen will appear stating **"Software Loading Application"** and prompt you to confirm the update.
7. Confirm the prompt by pressing **OK**.
8. A progress bar will advance. The flashing process takes ~60–90 seconds.
9. Upon completion, the unit will automatically eject the CD and reboot displaying your **brand new custom bootlogo**!

---

## 🗺️ Map Source Verifier (Pre-Install Integrity Checker)

### 0. Scope & Honest Limits

> [!IMPORTANT]
> **What this tool CAN and CANNOT do:**
> 1. **Internal Drive Limitation**: The VW RNS 510 installs navigation maps onto an **internal drive (HDD or SSD)** inside the dashboard. This tool **cannot** read, access, or verify what is currently stored inside your head unit. It strictly verifies the **source media** (SD card, folder, ISO image, archive) *before* you spend 60+ minutes installing it in your car.
> 2. **Reference Manifests**: Without a cryptographic reference manifest from a known-good install, the tool cannot guarantee that an arbitrary folder is functionally complete or compatible with your firmware revision.
> 3. **Copyright & Media**: This repository ships **no map data or proprietary Volkswagen navigation binaries**.
> 4. **Privacy Protection**: All reports (Console, Markdown, JSON) automatically mask user account paths, home directories, and temporary folder locations.

---

### 🚀 Quick Start

#### Option A: Windows Drag-and-Drop Launcher
Double-click `verify_map.bat` or drag any map directory, `.iso` disc image, archive (`.zip`/`.7z`), or `.json` manifest onto `verify_map.bat` to launch the dark-mode GUI.

#### Option B: Graphical Interface via CLI
```bash
python map_verify.py gui
# Or pass an initial path:
python map_verify.py gui "D:\RNS510_Maps"
```

#### Option C: Command Line Interface
The CLI provides subcommands with standardized exit codes (`0` = OK, `1` = Problems, `2` = Error) and bilingual output (`--lang ro` or `--lang en`):

```bash
# Structure reconnaissance and fingerprinting:
python map_verify.py recon "D:\RNS510_Maps" --depth 3 --json recon.json --md recon.md

# Generate a SHA-256 manifest of a clean reference folder:
python map_verify.py manifest "D:\Clean_Maps" -o maps_v17.json --algo sha256

# Verify a copy (e.g. on an SD card) against the manifest:
python map_verify.py verify "E:\SD_Maps" --manifest maps_v17.json

# Direct folder-to-folder comparison with removable media cache warning:
python map_verify.py compare "D:\Clean_Maps" "E:\SD_Maps"

# Scan an ISO image extents and volume descriptor directly without extraction:
python map_verify.py iso "maps.iso" --against "D:\Clean_Maps"

# Check an individual file hash against an expected value (autodetects algo):
python map_verify.py hash-file "maps.iso" --expect "a1b2c3..."

# Test archive internal member CRC without extracting to disk:
python map_verify.py archive-test "maps.zip"

# Test SD card capacity to expose counterfeit flash and bad blocks:
python map_verify.py card-test "E:\" --percent 90
```

---

### 📋 Manifest & Report JSON Schema

Manifests and reports generated by the tool follow a deterministic, diff-friendly JSON format:

```json
{
  "tool": "mapverify",
  "version": "0.1.0",
  "created": "2026-10-25T20:30:00Z",
  "algo": "sha256",
  "root_name": "RNS510_Maps",
  "total_files": 420,
  "total_bytes": 6248921088,
  "files": {
    "MAPS/MAP1.DAT": {
      "size": 2147483648,
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
}
```

---

### 🚦 Standard Exit Codes

| Exit Code | Meaning | Details |
|:---------:|:--------|:--------|
| `0` | **EXIT_OK** | Clean run. All hashes matched, archives valid, or trees identical. |
| `1` | **EXIT_PROBLEMS** | Discrepancies found: corrupted files, missing paths, hash mismatch, or failing SD blocks. |
| `2` | **EXIT_ERROR** | Fatal error: path not found, permission denied, or invalid arguments. |

---

## 📂 Repository Structure

```text
RNS510-Bootlogo-Toolkit/
│
├── map_verify.py              # Map Source Verifier CLI & GUI launcher
├── verify_map.bat             # Windows Drag-and-Drop Map Verifier launcher
├── pyproject.toml             # Project packaging & optional [7z] extras
├── requirements.txt           # Python dependencies (Pillow, pycdlib)
│
├── mapverify/                 # Map Source Verifier core engine
│   ├── __init__.py            # Package initialization & exports
│   ├── __main__.py            # python -m mapverify execution hook
│   ├── common.py              # Path normalization, privacy masking, constants
│   ├── hashing.py             # 4 MiB streaming chunk hasher & autodetection
│   ├── i18n.py                # Dual-language translations (RO default, EN)
│   ├── recon.py               # Structure reconnaissance & FAT32/ISO heuristics
│   ├── manifest.py            # Multithreaded JSON manifest generator
│   ├── verify.py              # Manifest verification engine (--quick support)
│   ├── compare.py             # Folder-to-folder tree comparison & eject notice
│   ├── archives.py            # In-memory member CRC verification (.zip, .7z)
│   ├── isoscan.py             # pycdlib ISO9660/Joliet/UDF extent scanner
│   ├── cardtest.py            # Synthetic block write/read fake card detector
│   ├── report.py              # Console, Markdown & JSON bilingual reports
│   ├── cli.py                 # Command-line interface with subcommands
│   └── gui.py                 # Dark-mode multi-tab responsive Tkinter GUI
│
├── tests/                     # Automated pytest suite (66+ unit tests)
│   ├── test_archives.py       # Archive member CRC test cases
│   ├── test_cardtest.py       # Synthetic CardTestIO capacity test cases
│   ├── test_cli.py            # Command line dispatch & argument tests
│   ├── test_common.py         # Path sanitizing & privacy masking tests
│   ├── test_compare.py        # Tree comparison & case-folding tests
│   ├── test_gui.py            # GUI initialization & routing tests
│   ├── test_hash_file.py      # Individual file hash & algo autodetect tests
│   ├── test_hashing.py        # Streaming 4 MiB chunk hash tests
│   ├── test_isoscan.py        # pycdlib ISO scanning & truncation tests
│   ├── test_manifest_verify.py# Manifest generation and verification tests
│   ├── test_recon.py          # Reconnaissance & structural heuristic tests
│   └── test_report.py         # Bilingual report rendering tests
│
├── rns510_bootlogo.py         # Main Bootlogo CLI & GUI: Image -> RGB555 FLI -> Bootable ISO
├── rns510_iso_viewer.py       # ISO Decompiler & Quality Visualizer
├── create_bootable_iso.bat    # Windows Drag-and-Drop Bootable ISO Builder
├── verify_logo_quality.bat    # Windows Drag-and-Drop Quality & Artifact Scanner
├── decompile_view_iso.bat     # Windows Drag-and-Drop ISO Decompiler GUI
├── LICENSE                    # GNU General Public License v3.0
├── README.md                  # Comprehensive English Documentation
├── README_RO.md               # Ghid complet în limba Română
│
└── template_swl/              # Authentic SWL firmware structure templates
    ├── BLSCRIPT.CFG           # Bootloader update script
    ├── DIR.INF                # Disc directory index
    ├── VERSION.TXT            # Firmware build version descriptor
    └── SWL/
        └── SILVER_1/
            └── RNSMIDEC/
                └── SWL/
                    └── SWL.FLI # Base bootloader payload
```

---

## 🤝 Contributing

Contributions, bug reports, and pull requests are warmly welcomed! If you find any unusual RNS 510 firmware revision or hardware variation, please open an Issue.

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0). See [LICENSE](LICENSE) for details.

---

*Volkswagen, Škoda, SEAT, and RNS 510 are registered trademarks of Volkswagen AG. This project is an independent open-source enthusiast tool and is not affiliated with or endorsed by Volkswagen AG.*
