import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/shared/api/serverClient";
import { scanStoredZipFile, scanZipFile, validateZipFile } from "../repoZipScan";

vi.mock("@/shared/api/serverClient", () => ({
	apiClient: {
		post: vi.fn(),
	},
}));

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

describe("ZIP scan task name", () => {
	beforeEach(() => {
		vi.mocked(apiClient.post).mockReset();
		vi.mocked(apiClient.post).mockResolvedValue({ data: { task_id: "task-1" } });
	});

	it("includes the user task name when uploading a ZIP scan", async () => {
		await scanZipFile({
			projectId: "project-1",
			zipFile: new File(["content"], "source.zip", { type: "application/zip" }),
			taskName: "Uploaded ZIP Scan",
		});

		const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
		const scanConfig = JSON.parse(String(formData.get("scan_config")));
		expect(scanConfig.name).toBe("Uploaded ZIP Scan");
	});

	it("includes the user task name when scanning a stored ZIP", async () => {
		await scanStoredZipFile({
			projectId: "project-1",
			taskName: "Stored ZIP Scan",
		});

		expect(apiClient.post).toHaveBeenCalledWith(
			"/scan/scan-stored-zip",
			expect.objectContaining({ name: "Stored ZIP Scan" }),
			expect.any(Object),
		);
	});
});
