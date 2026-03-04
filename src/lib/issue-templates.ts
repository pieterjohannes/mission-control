export interface IssueTemplate {
  id: string;
  emoji: string;
  label: string;
  description: string;
  priority: "high" | "medium" | "low";
  labels: string[];
}

export const ISSUE_TEMPLATES: IssueTemplate[] = [
  {
    id: "bug-report",
    emoji: "🐛",
    label: "Bug Report",
    description:
      "## What happened?\n\n## Steps to reproduce\n1. \n2. \n\n## Expected behavior\n\n## Actual behavior",
    priority: "high",
    labels: ["bug"],
  },
  {
    id: "feature-request",
    emoji: "✨",
    label: "Feature Request",
    description:
      "## What problem does this solve?\n\n## Proposed solution\n\n## Alternatives considered",
    priority: "medium",
    labels: ["feature"],
  },
  {
    id: "task",
    emoji: "✅",
    label: "Task",
    description: "## Goal\n\n## Acceptance criteria\n- [ ] ",
    priority: "medium",
    labels: ["task"],
  },
  {
    id: "improvement",
    emoji: "💡",
    label: "Improvement",
    description:
      "## Current behavior\n\n## Proposed improvement\n\n## Why this matters",
    priority: "low",
    labels: ["improvement"],
  },
  {
    id: "idea",
    emoji: "🚀",
    label: "Idea",
    description:
      "## The idea\n\n## Why it's valuable\n\n## Quick MVP",
    priority: "low",
    labels: ["idea"],
  },
];
