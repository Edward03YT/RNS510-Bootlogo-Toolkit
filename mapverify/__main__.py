"""
Module execution entry point: python -m mapverify <command> ...
"""

import sys
from mapverify.cli import main

if __name__ == "__main__":
    sys.exit(main())
