# claude-skill-lint

> A tiny linter for [Claude Code](https://docs.anthropic.com/claude/code) skill
> files. Catches the boring mistakes — bad frontmatter, name/slug mismatches,
> descriptions that don't tell Claude *when* to fire — before a skill silently
> stops triggering.

[![CI](https://github.com/drabekj/claude-skill-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/drabekj/claude-skill-lint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E=20-brightgreen)](https://nodejs.org/)

## Why

A Claude Code skill is just a Markdown file with a YAML frontmatter block. The
loader is permissive — if your frontmatter is malformed, your `name` is
PascalCase, or your `description` doesn't include a trigger phrase, the skill
simply won't get matched at runtime. The failure is silent.

`claude-skill-lint` makes those failures loud, in CI or in your editor.

## Install

```bash
npm install --save-dev claude-skill-lint
# or run once without installing
npx claude-skill-lint skills/
```

## Use

```bash
claude-skill-lint <path> [<path> ...]
```

Each path is a `.md` file or a directory (walked recursively). Exit code is
non-zero if any file has an error-severity issue.

```bash
# A single file
claude-skill-lint skills/my-skill.md

# A whole skills directory
claude-skill-lint .claude/skills/

# Quiet (only show files with issues)
claude-skill-lint --quiet skills/

# JSON output, for piping into other tools
claude-skill-lint --json skills/ | jq '.[] | select(.ok == false)'
```

## What it checks

| Rule                    | Severity | What it catches                                                             |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `frontmatter-missing`   | error    | File doesn't start with `---`.                                              |
| `frontmatter-parse`     | error    | YAML frontmatter doesn't parse.                                             |
| `name-required`         | error    | `name:` is missing.                                                         |
| `name-slug`             | error    | `name:` is not kebab-case.                                                  |
| `name-matches-path`     | warning  | `name:` doesn't match the file slug or parent folder.                       |
| `description-required`  | error    | `description:` is missing.                                                  |
| `description-too-long`  | warning  | `description:` is over 1024 chars and likely to be truncated.               |
| `description-multiline` | warning  | `description:` spans more than a few non-empty lines.                       |
| `description-trigger`   | warning  | `description:` has no "use when / when / before / after / ..." phrase.      |
| `body-empty`            | error    | Skill body is empty.                                                        |
| `body-short`            | warning  | Skill body is under 40 chars.                                               |

The rules are derived from how Claude Code's skill loader actually behaves: it
matches a skill by its frontmatter `description`, and the `name` must round-trip
through path resolution.

## Programmatic API

```ts
import { lintSkillFile } from "claude-skill-lint";

const result = await lintSkillFile("skills/my-skill.md");
if (!result.ok) {
  for (const issue of result.issues) {
    console.error(`[${issue.severity}] ${issue.rule}: ${issue.message}`);
  }
}
```

## Pre-commit / CI

A minimal GitHub Actions step:

```yaml
- run: npx claude-skill-lint .claude/skills/
```

A minimal `pre-commit` hook (`.pre-commit-config.yaml`):

```yaml
- repo: local
  hooks:
    - id: claude-skill-lint
      name: claude-skill-lint
      entry: npx claude-skill-lint
      files: \.md$
      types: [markdown]
```

## Contributing

PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). The full test suite
runs with:

```bash
npm install
npm test
```

## License

[MIT](LICENSE).
