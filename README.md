# agent-skill-lint

> A tiny linter for **agent skill / rule files** — Markdown documents with a
> YAML frontmatter block (`name`, `description`, body) that an AI coding
> agent loads and consults. Catches the boring mistakes — malformed
> frontmatter, name/slug mismatches, descriptions that don't say *when* to
> fire — before the skill silently stops triggering.

[![CI](https://github.com/drabekj/agent-skill-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/drabekj/agent-skill-lint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E=20-brightgreen)](https://nodejs.org/)

## Why

A common pattern across modern AI coding agents is to load a Markdown file
with a small YAML frontmatter as a "skill" or "rule" the agent can
selectively invoke. The loader is permissive — if the frontmatter is
malformed, the `name` is PascalCase, or the `description` doesn't tell the
agent *when* to fire, the skill simply never matches at runtime. The
failure is silent.

`agent-skill-lint` makes those failures loud, in CI or in your editor.

The defaults are derived from the de facto schema used by several agent
loaders: a `name` slug, a one-paragraph `description`, and a Markdown body
that the agent reads after the skill is invoked.

## Install

```bash
npm install --save-dev agent-skill-lint
# or run once without installing
npx agent-skill-lint skills/
```

## Use

```bash
agent-skill-lint <path> [<path> ...]
```

Each path is a `.md` file or a directory (walked recursively). Exit code is
non-zero if any file has an error-severity issue.

```bash
# A single file
agent-skill-lint skills/my-skill.md

# A whole skills directory
agent-skill-lint skills/

# Quiet (only show files with issues)
agent-skill-lint --quiet skills/

# JSON output, for piping into other tools
agent-skill-lint --json skills/ | jq '.[] | select(.ok == false)'
```

## What it checks

| Rule                    | Severity | What it catches                                                                |
|-------------------------|----------|--------------------------------------------------------------------------------|
| `frontmatter-missing`   | error    | File doesn't start with `---`.                                                 |
| `frontmatter-parse`     | error    | YAML frontmatter doesn't parse.                                                |
| `name-required`         | error    | `name:` is missing.                                                            |
| `name-slug`             | error    | `name:` is not kebab-case.                                                     |
| `name-matches-path`     | warning  | `name:` doesn't match the file slug or parent folder.                          |
| `description-required`  | error    | `description:` is missing.                                                     |
| `description-too-long`  | warning  | `description:` is over 1024 chars and likely to be truncated.                  |
| `description-multiline` | warning  | `description:` spans more than a few non-empty lines.                          |
| `description-trigger`   | warning  | `description:` has no "use when / when / before / after / ..." phrase.         |
| `body-empty`            | error    | Skill body is empty.                                                           |
| `body-short`            | warning  | Skill body is under 40 chars.                                                  |

The rules are deliberately conservative — anything tagged `error` will
break the skill at runtime; anything tagged `warning` hurts match quality
but the file is still loadable.

## Programmatic API

```ts
import { lintSkillFile } from "agent-skill-lint";

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
- run: npx agent-skill-lint skills/
```

A minimal `pre-commit` hook (`.pre-commit-config.yaml`):

```yaml
- repo: local
  hooks:
    - id: agent-skill-lint
      name: agent-skill-lint
      entry: npx agent-skill-lint
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
