import { describe, expect, it } from "vitest";
import type { Project } from "@/shared/types";
import { canStartCreateAgentTask } from "../CreateAgentTaskDialog";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Test Project",
    source_type: "zip",
    scan_mode: "source",
    default_branch: "main",
    programming_languages: "[]",
    owner_id: "user-1",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("canStartCreateAgentTask", () => {
  it("allows source ZIP deep audit after selecting project and entering task name", () => {
    expect(
      canStartCreateAgentTask({
        selectedProject: createProject({ source_type: "zip", scan_mode: "source" }),
        taskName: "Deep audit",
        branch: "",
      }),
    ).toBe(true);
  });

  it("blocks compiled artifact projects", () => {
    expect(
      canStartCreateAgentTask({
        selectedProject: createProject({ source_type: "zip", scan_mode: "compiled" }),
        taskName: "Deep audit",
        branch: "",
      }),
    ).toBe(false);
  });

  it("requires a branch for repository projects", () => {
    expect(
      canStartCreateAgentTask({
        selectedProject: createProject({
          source_type: "repository",
          repository_url: "https://example.com/repo.git",
        }),
        taskName: "Deep audit",
        branch: "",
      }),
    ).toBe(false);
  });
});
