# Compiled-scan test fixtures

This directory holds binary fixtures used by `backend/tests/services/compiled_scan/`.

## What's here

| File | Purpose | How built |
|---|---|---|
| `hello.elf` | Linux ELF with `strcpy` + `strcat` dynamic-symbol references (exercises `BinaryAnalyzer`'s ELF symbol path). | **Copy** of `/usr/lib/x86_64-linux-gnu/libplc4.so` (22.7 KB). Canonically built via `build_fixtures.sh` from a tiny `strcpy(buf, argv[1])` C program. |
| `sample-min.apk` | Minimal APK (plain-text manifest + `strings.xml` with `sk_live_*` key) for exercising `ApkAnalyzer`'s zip-based string extraction and `parse_failed` path. | Synthesized at fixture-build time with Python's `zipfile`. Canonical version (via `build_fixtures.sh`) uses `aapt2` to produce a binary AndroidManifest that androguard can parse fully — that's the version that exercises the `permission.READ_SMS` rule end-to-end. |
| `libssl-fake-1.0.0.so` | Tiny file containing the string `OpenSSL 1.0.0 ...` so `SCAAnalyzer` matches it to CVE-2014-0160. NOT a real ELF (parse_failed handles that). | Synthesized in Python. The canonical `build_fixtures.sh` builds a real shared object via `gcc -shared`. |

## Missing fixtures (build via `build_fixtures.sh` if you have the toolchain)

| File | Notes |
|---|---|
| `hello.exe` | Windows PE that imports `system`. Requires `x86_64-w64-mingw32-gcc`. When absent, the corresponding `test_pe_detects_system_import` test is auto-skipped via `pytest.skipif(not (FIXTURES / "hello.exe").exists(), ...)`. |

## Substitution strategy

`build_fixtures.sh` is the canonical source of truth and documents the intent of each fixture. We commit substitutes built in this environment so:

1. CI doesn't need a C / MinGW / Android toolchain
2. Tests run even on hosts without those toolchains
3. Anyone with the toolchain can run `./build_fixtures.sh` to regenerate the canonical versions

Where a substitute differs from the canonical fixture (e.g. our APK has a text manifest instead of a binary axml), the corresponding test's assertion is forgiving enough that it still catches the behavior change it cares about — typically by checking for the `parse_failed` warning AND a string-extraction-based hit.
