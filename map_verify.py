#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RNS 510 Map Source Verifier — Thin CLI entry point.
Usage:
    python map_verify.py recon <folder> [--depth 3] [--json out.json] [--md out.md] [--lang ro|en]
"""

import sys
from mapverify.cli import main

if __name__ == "__main__":
    if len(sys.argv) == 1:
        from mapverify.gui import launch_gui
        launch_gui()
        sys.exit(0)
    sys.exit(main())
