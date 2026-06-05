#!/usr/bin/env bash
# Reproducibility script for compiled-scan test fixtures.
# Run from this directory. Requires: gcc, mingw-w64 (x86_64-w64-mingw32-gcc),
# apksigner+aapt2 (Android SDK build-tools), zip.
#
# Re-running overwrites the .elf/.exe/.apk/.so files in this directory.
#
# Tested on Ubuntu 24.04 with:
#   sudo apt install gcc mingw-w64 aapt2 google-android-build-tools-34-installer
#
# This script is the CANONICAL source of fixtures. Where the host lacks a
# toolchain, README.md documents the substitution strategy used to commit
# usable fixtures anyway.

set -euo pipefail
cd "$(dirname "$0")"

# ---- hello.elf : Linux ELF that calls strcpy ----
cat > /tmp/hello.c <<'EOF'
#include <string.h>
int main(int argc, char **argv) {
    char buf[16];
    if (argc > 1) strcpy(buf, argv[1]);   // intentional: tested for in BinaryAnalyzer
    return 0;
}
EOF
gcc -O0 -no-pie -o hello.elf /tmp/hello.c

# ---- hello.exe : Windows PE that imports system ----
cat > /tmp/hello_win.c <<'EOF'
#include <stdlib.h>
int main(void) { system("echo hi"); return 0; }
EOF
x86_64-w64-mingw32-gcc -O0 -o hello.exe /tmp/hello_win.c

# ---- libssl-fake-1.0.0.so : ELF with a soname-like string matching CVE library ----
cat > /tmp/fakelib.c <<'EOF'
const char openssl_version[] = "OpenSSL 1.0.0 fake-for-test 2026";
int dummy(void) { return 0; }
EOF
gcc -O0 -shared -fPIC -Wl,-soname,libssl.so.1.0.0 -o libssl-fake-1.0.0.so /tmp/fakelib.c

# ---- sample-min.apk : minimal valid APK with INTERNET permission + secret in strings ----
mkdir -p /tmp/apkbuild/res/values
cat > /tmp/apkbuild/AndroidManifest.xml <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.deepaudit.fixture">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.READ_SMS"/>
    <application android:label="fx"/>
</manifest>
EOF
cat > /tmp/apkbuild/res/values/strings.xml <<'EOF'
<resources>
  <string name="api_key">sk_live_AKIAIOSFODNN7EXAMPLE</string>
</resources>
EOF
aapt2 compile --dir /tmp/apkbuild/res -o /tmp/apkbuild/compiled.zip
aapt2 link -o sample-min.apk --manifest /tmp/apkbuild/AndroidManifest.xml /tmp/apkbuild/compiled.zip

echo "Fixtures built successfully."
