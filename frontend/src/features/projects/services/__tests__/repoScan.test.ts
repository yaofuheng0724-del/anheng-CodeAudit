import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRepositoryAudit } from "../repoScan";
import { api } from "@/shared/config/database";

vi.mock("@/shared/config/database", () => ({
	api: {
		createAuditTask: vi.fn(),
	},
}));

describe("runRepositoryAudit", () => {
	beforeEach(() => {
		vi.mocked(api.createAuditTask).mockReset();
		vi.mocked(api.createAuditTask).mockResolvedValue({ id: "task-1" } as any);
	});

	it("passes the user task name to the audit task API", async () => {
		await runRepositoryAudit({
			projectId: "project-1",
			repoUrl: "https://example.com/repo.git",
			branch: "main",
			taskName: "User Fast Scan",
		});

		expect(api.createAuditTask).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "User Fast Scan",
				project_id: "project-1",
			}),
		);
	});
});
