"""Debug script to check why only 5 files are scanned from a 1GB+ ZIP."""
import tempfile, os, shutil
from app.services.archive_utils import extract_archive_recursive
from app.services.quick_scan import collect_source_files, TEXT_EXTENSIONS, DEFAULT_EXCLUDES

ZIP_PATH = "uploads/zip_files/730c3dda-70b7-4821-8e32-1095a696d3a4.zip"

extract_dir = tempfile.mkdtemp()
print(f"Extracting to {extract_dir}...")
extract_archive_recursive(ZIP_PATH, extract_dir)

# Count all files
all_files = []
for root, dirs, files in os.walk(extract_dir):
    for f in files:
        all_files.append(os.path.join(root, f))
print(f"Total extracted files: {len(all_files)}")

# Count by extension
ext_counts = {}
for f in all_files:
    ext = os.path.splitext(f)[1].lower()
    ext_counts[ext] = ext_counts.get(ext, 0) + 1

sorted_exts = sorted(ext_counts.items(), key=lambda x: -x[1])
print("\nTop 20 extensions:")
for ext, cnt in sorted_exts[:20]:
    ext_display = ext if ext else "(no ext)"
    in_text = "YES" if ext in TEXT_EXTENSIONS else "NO"
    print(f"  {ext_display}: {cnt} files -> TEXT_EXTENSIONS={in_text}")

# Run collect_source_files (same as quick audit)
source_files = collect_source_files(extract_dir)
print(f"\ncollect_source_files result: {len(source_files)} files")
for sf in source_files:
    print(f"  {sf['path']} ({sf['language']}, {sf['size']}B, {sf['line_count']} lines)")

# Check how many files exceed 200KB
max_size = 200 * 1024
oversized = [f for f in all_files if os.path.getsize(f) > max_size]
print(f"\nFiles > 200KB (MAX_FILE_SIZE_BYTES): {len(oversized)}")
for f in oversized[:10]:
    ext = os.path.splitext(f)[1].lower()
    print(f"  {os.path.relpath(f, extract_dir)} size={os.path.getsize(f)} ext={ext} in_TEXT={ext in TEXT_EXTENSIONS}")

shutil.rmtree(extract_dir)
