import { describe, expect, it } from "vitest";
import type { Project } from "@/shared/types";
import { canStartCreateTask } from "../CreateTaskDialog";

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

describe("canStartCreateTask", () => {
  it("allows deep audit for a source ZIP project after selecting the project and entering a task name", () => {
    expect(
      canStartCreateTask({
        auditMode: "agent",
        selectedProject: createProject({ source_type: "zip", scan_mode: "source" }),
        taskName: "Deep audit",
        branch: "",
        zipReady: false,
      }),
    ).toBe(true);
  });

  it("keeps fast ZIP scans disabled until a ZIP file is available", () => {
    expect(
      canStartCreateTask({
        auditMode: "fast",
        selectedProject: createProject({ source_type: "zip", scan_mode: "source" }),
        taskName: "Fast scan",
        branch: "",
        zipReady: false,
      }),
    ).toBe(false);
  });

  it("blocks deep audit for compiled artifact projects", () => {
    expect(
      canStartCreateTask({
        auditMode: "agent",
        selectedProject: createProject({ source_type: "zip", scan_mode: "compiled" }),
        taskName: "Deep audit",
        branch: "",
        zipReady: false,
      }),
    ).toBe(false);
  });
});
