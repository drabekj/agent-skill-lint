/**
 * claude-skill-lint — programmatic API.
 *
 * Validates the structure of a Claude Code skill file (the `SKILL.md` or
 * standalone `*.md` file with YAML frontmatter that Claude Code loads as a
 * skill). The rules are derived from how Claude Code's skill loader actually
 * indexes skills today.
 */

import { readFile } from "node:fs/promises";
import { basename, dirname, extname, sep } from "node:path";

import matter from "gray-matter";

export type Severity = "error" | "warning";

export interface LintIssue {
  rule: string;
  severity: Severity;
  message: string;
}

export interface LintResult {
  file: string;
  ok: boolean;
  issues: LintIssue[];
  parsed?: {
    name?: string;
    description?: string;
  };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Description "trigger" words — Claude Code's loader rewards descriptions
 * that tell the model *when* to use the skill. We don't require any single
 * word but we warn when none of these (or their inflections) are present.
 */
const TRIGGER_WORDS = [
  "use when",
  "when ",
  "before ",
  "after ",
  "if you ",
  "whenever ",
  "for ",
  "asks",
  "needs",
];

const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_DESCRIPTION_LINES_SOFT = 6;

export function lintSkillContent(
  raw: string,
  filePath: string,
): LintResult {
  const issues: LintIssue[] = [];
  const result: LintResult = { file: filePath, ok: true, issues };

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    issues.push({
      rule: "frontmatter-parse",
      severity: "error",
      message: `Failed to parse YAML frontmatter: ${(err as Error).message}`,
    });
    return finalize(result);
  }

  if (!raw.trimStart().startsWith("---")) {
    issues.push({
      rule: "frontmatter-missing",
      severity: "error",
      message: "Skill file must start with a YAML frontmatter block delimited by ---.",
    });
    return finalize(result);
  }

  const fm = parsed.data as Record<string, unknown>;
  const name = typeof fm.name === "string" ? fm.name.trim() : undefined;
  const description =
    typeof fm.description === "string" ? fm.description.trim() : undefined;
  result.parsed = { name, description };

  // name
  if (!name) {
    issues.push({
      rule: "name-required",
      severity: "error",
      message: "Frontmatter `name` is required.",
    });
  } else {
    if (!SLUG_RE.test(name)) {
      issues.push({
        rule: "name-slug",
        severity: "error",
        message: `\`name\` must be kebab-case (matched against ${SLUG_RE.source}). Got: ${JSON.stringify(name)}.`,
      });
    }

    const expected = expectedSlugFor(filePath);
    if (expected && expected !== name) {
      issues.push({
        rule: "name-matches-path",
        severity: "warning",
        message: `\`name\` (${name}) does not match the file/folder slug (${expected}). Claude Code resolves skills by path, so a mismatch is confusing.`,
      });
    }
  }

  // description
  if (!description) {
    issues.push({
      rule: "description-required",
      severity: "error",
      message: "Frontmatter `description` is required — it's what tells Claude when to invoke the skill.",
    });
  } else {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      issues.push({
        rule: "description-too-long",
        severity: "warning",
        message: `\`description\` is ${description.length} chars — long descriptions get truncated. Aim for under ${MAX_DESCRIPTION_LENGTH}.`,
      });
    }
    const lines = description.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length > MAX_DESCRIPTION_LINES_SOFT) {
      issues.push({
        rule: "description-multiline",
        severity: "warning",
        message: `\`description\` spans ${lines.length} non-empty lines. The loader sees it as a single string; consider tightening to a sentence or two.`,
      });
    }
    const lower = description.toLowerCase();
    if (!TRIGGER_WORDS.some((w) => lower.includes(w))) {
      issues.push({
        rule: "description-trigger",
        severity: "warning",
        message: "`description` does not contain a trigger phrase ('use when', 'before', 'when ', ...). Descriptions that tell Claude *when* to fire match better.",
      });
    }
  }

  // body
  const body = parsed.content.trim();
  if (body.length === 0) {
    issues.push({
      rule: "body-empty",
      severity: "error",
      message: "Skill body is empty — the body is what Claude actually reads after the skill is loaded.",
    });
  } else if (body.length < 40) {
    issues.push({
      rule: "body-short",
      severity: "warning",
      message: `Skill body is only ${body.length} chars. That's almost certainly not enough to be useful.`,
    });
  }

  return finalize(result);
}

export async function lintSkillFile(filePath: string): Promise<LintResult> {
  if (extname(filePath).toLowerCase() !== ".md") {
    return {
      file: filePath,
      ok: false,
      issues: [
        {
          rule: "extension",
          severity: "error",
          message: `Expected a .md file, got: ${filePath}`,
        },
      ],
    };
  }
  const raw = await readFile(filePath, "utf8");
  return lintSkillContent(raw, filePath);
}

function finalize(result: LintResult): LintResult {
  result.ok = !result.issues.some((i) => i.severity === "error");
  return result;
}

/**
 * Given a path like `.../my-skill/SKILL.md` or `.../skills/my-skill.md`,
 * return the slug we'd expect the frontmatter `name` to match.
 */
export function expectedSlugFor(filePath: string): string | undefined {
  const base = basename(filePath, extname(filePath));
  if (base.toLowerCase() === "skill" || base.toLowerCase() === "skill.md") {
    const parent = basename(dirname(filePath));
    return parent && parent !== "" && parent !== sep ? parent : undefined;
  }
  return base;
}
