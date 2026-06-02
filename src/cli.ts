#!/usr/bin/env node
/**
 * claude-skill-lint CLI.
 *
 * Usage:
 *   claude-skill-lint <path> [<path> ...]
 *   claude-skill-lint --help
 *
 * Each path is either a .md file or a directory; directories are walked
 * recursively for *.md files. Exit code is non-zero if any file has an
 * error-severity issue.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { argv, exit, stdout, stderr } from "node:process";

import kleur from "kleur";

import { lintSkillFile, type LintResult } from "./index.js";

const HELP = `claude-skill-lint — validate Claude Code skill files

Usage:
  claude-skill-lint <path> [<path> ...]   Lint one or more .md files / directories.
  claude-skill-lint --help                Show this message.
  claude-skill-lint --version             Show version.

Options:
  --quiet     Suppress per-file output for files with no issues.
  --json      Emit machine-readable JSON instead of a human report.

Exit codes:
  0   All files clean (warnings allowed).
  1   At least one error-severity issue found.
  2   Bad invocation or I/O error.
`;

interface ParsedArgs {
  paths: string[];
  quiet: boolean;
  json: boolean;
  showHelp: boolean;
  showVersion: boolean;
}

function parseArgs(input: string[]): ParsedArgs {
  const out: ParsedArgs = {
    paths: [],
    quiet: false,
    json: false,
    showHelp: false,
    showVersion: false,
  };
  for (const arg of input) {
    if (arg === "--help" || arg === "-h") out.showHelp = true;
    else if (arg === "--version" || arg === "-v") out.showVersion = true;
    else if (arg === "--quiet" || arg === "-q") out.quiet = true;
    else if (arg === "--json") out.json = true;
    else if (arg.startsWith("--")) {
      stderr.write(kleur.red(`Unknown flag: ${arg}\n`));
      exit(2);
    } else {
      out.paths.push(arg);
    }
  }
  return out;
}

async function expand(path: string): Promise<string[]> {
  const s = await stat(path);
  if (s.isFile()) return path.toLowerCase().endsWith(".md") ? [path] : [];
  if (!s.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const child = join(path, entry.name);
    out.push(...(await expand(child)));
  }
  return out;
}

function formatResult(result: LintResult, quiet: boolean): string {
  if (result.ok && result.issues.length === 0) {
    return quiet ? "" : `  ${kleur.green("✓")} ${result.file}\n`;
  }
  const lines: string[] = [];
  const icon = result.ok ? kleur.yellow("!") : kleur.red("✗");
  lines.push(`  ${icon} ${result.file}`);
  for (const issue of result.issues) {
    const tag =
      issue.severity === "error" ? kleur.red("error  ") : kleur.yellow("warn   ");
    lines.push(`      ${tag} [${issue.rule}] ${issue.message}`);
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  if (args.showHelp) {
    stdout.write(HELP);
    return;
  }
  if (args.showVersion) {
    stdout.write("claude-skill-lint 0.1.0\n");
    return;
  }
  if (args.paths.length === 0) {
    stderr.write(HELP);
    exit(2);
  }

  const files: string[] = [];
  for (const p of args.paths) {
    try {
      files.push(...(await expand(p)));
    } catch (err) {
      stderr.write(kleur.red(`Cannot read ${p}: ${(err as Error).message}\n`));
      exit(2);
    }
  }

  if (files.length === 0) {
    stderr.write(kleur.yellow("No .md files found in the given paths.\n"));
    exit(0);
  }

  const results = await Promise.all(files.map((f) => lintSkillFile(f)));

  if (args.json) {
    stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    for (const r of results) {
      const formatted = formatResult(r, args.quiet);
      if (formatted) stdout.write(formatted);
    }
    const errors = results.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === "error").length,
      0,
    );
    const warnings = results.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === "warning").length,
      0,
    );
    const summary = `\n${results.length} file(s) checked, ${errors} error(s), ${warnings} warning(s).\n`;
    stdout.write(errors > 0 ? kleur.red(summary) : kleur.green(summary));
  }

  const anyError = results.some((r) => !r.ok);
  exit(anyError ? 1 : 0);
}

main().catch((err) => {
  stderr.write(kleur.red(`Unexpected error: ${(err as Error).stack ?? err}\n`));
  exit(2);
});
