import { describe, expect, it } from "vitest";

import { expectedSlugFor, lintSkillContent } from "../src/index.js";

const GOOD = `---
name: hello-world
description: Use when the user greets you. Responds with a friendly hello-world message.
---

Body that explains the skill in enough detail to actually be useful when Claude loads it.
`;

describe("lintSkillContent", () => {
  it("accepts a well-formed skill", () => {
    const r = lintSkillContent(GOOD, "hello-world.md");
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("flags missing frontmatter", () => {
    const r = lintSkillContent("just a body, no frontmatter\n", "skill.md");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.rule === "frontmatter-missing")).toBe(true);
  });

  it("flags missing name and description", () => {
    const raw = `---\n{}\n---\n\nbody body body body body body body body body body\n`;
    const r = lintSkillContent(raw, "x.md");
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.rule)).toContain("name-required");
    expect(r.issues.map((i) => i.rule)).toContain("description-required");
  });

  it("rejects non-kebab-case names", () => {
    const raw = `---\nname: HelloWorld\ndescription: Use when a user says hi.\n---\n\nbody body body body body body body body body\n`;
    const r = lintSkillContent(raw, "HelloWorld.md");
    expect(r.issues.some((i) => i.rule === "name-slug")).toBe(true);
  });

  it("warns when name does not match the file slug", () => {
    const raw = `---\nname: foo\ndescription: Use when ...\n---\n\nbody body body body body body body body body body body body\n`;
    const r = lintSkillContent(raw, "bar.md");
    expect(r.issues.some((i) => i.rule === "name-matches-path")).toBe(true);
  });

  it("warns when the description has no trigger phrase", () => {
    const raw = `---\nname: x\ndescription: A skill that does things.\n---\n\nbody body body body body body body body body body\n`;
    const r = lintSkillContent(raw, "x.md");
    expect(r.issues.some((i) => i.rule === "description-trigger")).toBe(true);
  });

  it("flags an empty body as an error", () => {
    const raw = `---\nname: x\ndescription: Use when something happens.\n---\n\n`;
    const r = lintSkillContent(raw, "x.md");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.rule === "body-empty")).toBe(true);
  });

  it("warns on a too-short body", () => {
    const raw = `---\nname: x\ndescription: Use when something happens.\n---\n\nshort.\n`;
    const r = lintSkillContent(raw, "x.md");
    expect(r.issues.some((i) => i.rule === "body-short")).toBe(true);
  });
});

describe("expectedSlugFor", () => {
  it("uses the filename when not SKILL.md", () => {
    expect(expectedSlugFor("/a/b/my-skill.md")).toBe("my-skill");
  });

  it("uses the parent folder when the file is SKILL.md", () => {
    expect(expectedSlugFor("/a/b/my-skill/SKILL.md")).toBe("my-skill");
  });
});
