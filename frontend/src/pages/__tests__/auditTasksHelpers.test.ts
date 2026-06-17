import { describe, expect, it } from "vitest";
import type { AuditTask } from "@/shared/types";
import type { AgentTask } from "@/shared/api/agentTasks";
import {
	agentTaskMatchesSearch,
	getFastScanRedirectPath,
	getAgentTaskProjectName,
	getRegularTaskDisplayName,
	getRegularTaskProjectName,
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

function makeAgentTask(overrides: Partial<AgentTask> = {}): AgentTask {
	return {
		id: "agent-task-1",
		project_id: "project-1",
		name: "Deep Audit",
		description: null,
		task_type: "agent_audit",
		status: "running",
		current_phase: "analysis",
		current_step: null,
		total_files: 10,
		total_lines: 100,
		indexed_files: 10,
		analyzed_files: 5,
		files_with_findings: 1,
		total_chunks: 20,
		findings_count: 2,
		verified_count: 1,
		false_positive_count: 0,
		total_iterations: 3,
		tool_calls_count: 4,
		tokens_used: 1000,
		critical_count: 0,
		high_count: 1,
		medium_count: 1,
		low_count: 0,
		quality_score: 80,
		security_score: 70,
		created_at: "2026-06-17T00:00:00Z",
		started_at: null,
		completed_at: null,
		progress_percentage: 50,
		audit_scope: null,
		target_vulnerabilities: null,
		verification_level: null,
		exclude_patterns: null,
		target_files: null,
		error_message: null,
		project: {
			id: "project-1",
			name: "Deep Project",
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

	it("shows the target project name for regular audit tasks", () => {
		expect(getRegularTaskProjectName(makeTask())).toBe("Project Name");
		expect(getRegularTaskProjectName(makeTask({ project: undefined }))).toBe("未知项目");
	});

	it("matches regular audit tasks by task name", () => {
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "payment")).toBe(true);
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "project name")).toBe(true);
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "repository")).toBe(true);
		expect(regularTaskMatchesSearch(makeTask({ name: "Payment Scan" }), "missing")).toBe(false);
	});

	it("shows and searches the target project name for agent audit tasks", () => {
		expect(getAgentTaskProjectName(makeAgentTask())).toBe("Deep Project");
		expect(getAgentTaskProjectName(makeAgentTask({ project: undefined }))).toBe("未知项目");
		expect(agentTaskMatchesSearch(makeAgentTask(), "deep project")).toBe(true);
		expect(agentTaskMatchesSearch(makeAgentTask(), "agent_audit")).toBe(true);
		expect(agentTaskMatchesSearch(makeAgentTask(), "missing")).toBe(false);
	});

	it("redirects fast scans to the regular task list instead of a log dialog", () => {
		expect(getFastScanRedirectPath()).toBe("/audit-tasks?tab=regular");
	});
});
