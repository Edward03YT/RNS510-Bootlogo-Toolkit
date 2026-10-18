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

* **⚡ Windows Drag-and-Drop Batch Files**:
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

## 📂 Repository Structure

```text
RNS510-Bootlogo-Toolkit/
│
├── rns510_bootlogo.py         # Main CLI & GUI: Image -> RGB555 FLI -> Bootable ISO
├── rns510_iso_viewer.py       # ISO Decompiler & Quality Visualizer
├── create_bootable_iso.bat    # Windows Drag-and-Drop / Double-click ISO Builder
├── verify_logo_quality.bat    # Windows Drag-and-Drop Quality & Artifact Scanner
├── decompile_view_iso.bat     # Windows Drag-and-Drop ISO Decompiler GUI
├── requirements.txt           # Python dependencies (Pillow, pycdlib)
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
