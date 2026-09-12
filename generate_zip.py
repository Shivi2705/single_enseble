"""
generate_zip.py
================
Packages the full nv_nav_system project (backend, frontend source, datasets,
README) into `nv_nav_system.zip` at the repository root, excluding
node_modules, __pycache__, .git, and other generated/heavy artifacts that the
recipient should regenerate/install themselves.

Usage:
    python generate_zip.py
"""

import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_ZIP = os.path.join(ROOT, "nv_nav_system.zip")

EXCLUDE_DIRS = {"node_modules", "__pycache__", ".git", ".venv", "venv", "dist", "build"}
EXCLUDE_EXTS = {".pyc", ".pyo"}


def should_skip_dir(dirname: str) -> bool:
    return dirname in EXCLUDE_DIRS


def should_skip_file(filename: str) -> bool:
    return any(filename.endswith(ext) for ext in EXCLUDE_EXTS)


def build_zip():
    if os.path.exists(OUTPUT_ZIP):
        os.remove(OUTPUT_ZIP)

    file_count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]

            for fname in filenames:
                if should_skip_file(fname):
                    continue
                full_path = os.path.join(dirpath, fname)
                if os.path.abspath(full_path) == OUTPUT_ZIP:
                    continue
                arcname = os.path.relpath(full_path, ROOT)
                zf.write(full_path, arcname)
                file_count += 1

    print(f"Wrote {OUTPUT_ZIP} with {file_count} files.")


if __name__ == "__main__":
    build_zip()
