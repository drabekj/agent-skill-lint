# Contributing

Thanks for considering a contribution! `agent-skill-lint` is intentionally
small — it should stay something a maintainer can read end-to-end in 10
minutes.

## Local development

```bash
git clone https://github.com/drabekj/agent-skill-lint.git
cd agent-skill-lint
npm install
npm test          # vitest
npm run build     # tsc -> dist/
node dist/cli.js --help
```

## Adding a rule

1. Implement the rule inside `lintSkillContent` in `src/index.ts`. Pick a
   stable `rule:` id and a severity (`"error"` for things that break the
   skill, `"warning"` for things that hurt match quality).
2. Add at least one positive and one negative test in `test/lint.test.ts`.
3. Document the rule in the table in `README.md`.
4. Keep the rule local to the file — `agent-skill-lint` never reads
   anything outside the file under test.

## Style

- TypeScript strict mode is on; please keep it that way.
- No new runtime dependencies without a clear reason. Today the only
  dependencies are `gray-matter` (frontmatter parsing) and `kleur` (colors).
- Prefer pure, synchronous functions in `src/index.ts` so they can be tested
  without I/O.
