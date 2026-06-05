import { describe, it, expect } from "vitest";
import { validateZipFile } from "../repoZipScan";

describe("validateZipFile", () => {
	it("should pass for a .zip file", () => {
		const file = new File(["content"], "archive.zip", { type: "application/zip" });
		const result = validateZipFile(file);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("should pass for supported archive extensions", () => {
		const file = new File(["content"], "archive.tar.gz", { type: "" });
		const result = validateZipFile(file);
		expect(result.valid).toBe(true);
	});

	it("should fail for an unsupported file type", () => {
		const file = new File(["content"], "document.pdf", { type: "application/pdf" });
		const result = validateZipFile(file);
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should fail for a file exceeding 2GB", () => {
		const size = 2 * 1024 * 1024 * 1024 + 1;
		const file = new File(["x"], "big.zip", { type: "application/zip" });
		Object.defineProperty(file, "size", { value: size });
		const result = validateZipFile(file);
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should pass for a file at exactly 2GB", () => {
		const size = 2 * 1024 * 1024 * 1024;
		const file = new File(["x"], "exact.7z", { type: "" });
		Object.defineProperty(file, "size", { value: size });
		const result = validateZipFile(file);
		expect(result.valid).toBe(true);
	});
});
