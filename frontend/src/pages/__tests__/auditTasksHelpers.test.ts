import { describe, expect, it } from "vitest";
import type { AuditTask } from "@/shared/types";
import {
	getFastScanRedirectPath,
	getRegularTaskDisplayName,
	regularTaskMatchesSearch,
} from "../AuditTasks";

function makeTask(overrides: Partial<AuditTask> = {}): AuditTask {
	return {
		id: "task-1",
		project_id: "project-1",
		task_type: "repository",
		status: "running",
		branch_name: "main",
		exclude_patterns: "[]",
		scan_config: "{}",
		total_files: 10,
		scanned_files: 2,
		total_lines: 100,
		issues_count: 0,
		quality_score: 100,
		created_by: "user-1",
		created_at: "2026-06-17T00:00:00Z",
		project: {
			id: "project-1",
			name: "Project Name",
			source_type: "repository",
			default_branch: "main",
			programming_languages: "[]",
			owner_id: "user-1",
			is_active: true,
			created_at: "2026-06-17T00:00:00Z",
			updated_at: "2026-06-17T00:00:00Z",
		},
		...overrides,
	};
}

describe("AuditTasks helpers", () => {
	it("uses the user-provided regular audit task name before the project name", () => {
		expect(getRegularTaskDisplayName(makeTask({ name: "User Task Name" }))).toBe("User Task Name");
		expect(getRegularTaskDisplayName(makeTask({ name: "" }))).toBe("Project Name");
	});

	it("matches regular audit tasks by task name", () => {
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "payment")).toBe(true);
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "repository")).toBe(true);
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "missing")).toBe(false);
	});

	it("redirects fast scans to the regular task list instead of a log dialog", () => {
		expect(getFastScanRedirectPath()).toBe("/audit-tasks?tab=regular");
	});
});
