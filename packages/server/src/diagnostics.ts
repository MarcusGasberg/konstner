import type { Diagnostic, DiagnosticsChecker, FrameworkAdapter } from "@konstner/core";

export interface DiagnosticsResult {
  scope: "file" | "project";
  added: Diagnostic[];
}

export interface DiagnosticsRunnerOptions {
  projectRoot: string;
  adapters: FrameworkAdapter[];
  onResult: (result: DiagnosticsResult) => void;
  onLog?: (line: string) => void;
}

export interface ScheduleInput {
  files: string[];
  scope: "file" | "project";
}

export interface DiagnosticsRunner {
  schedule(input: ScheduleInput): void;
}

type Baseline = Map<string, Set<string>>;

export function createDiagnosticsRunner(
  opts: DiagnosticsRunnerOptions,
): DiagnosticsRunner {
  const checkers: DiagnosticsChecker[] = [];
  for (const a of opts.adapters) {
    const c = a.createDiagnosticsChecker?.(opts.projectRoot);
    if (c) checkers.push(c);
  }
  if (checkers.length === 0) {
    opts.onLog?.("[diagnostics] no adapter-provided checkers; Tier 2 disabled.");
    return { schedule() {} };
  }

  let inFlight: Promise<void> | null = null;
  let queued: ScheduleInput | null = null;
  let baseline: Baseline | null = null;

  const run = async (input: ScheduleInput): Promise<void> => {
    try {
      const all: Diagnostic[] = [];
      for (const c of checkers) {
        try {
          const diags = await c.run(opts.projectRoot);
          for (const d of diags) all.push({ ...d });
        } catch (err) {
          opts.onLog?.(`[diagnostics/${c.id}] ${(err as Error).message}`);
        }
      }
      const current = keyed(all);
      if (baseline === null) {
        baseline = current;
        return;
      }
      const added = diff(current, baseline).filter(
        (d) => input.scope === "project" || input.files.some((f) => fileMatches(d.file, f)),
      );
      baseline = current;
      if (added.length > 0) opts.onResult({ scope: input.scope, added });
    } catch (err) {
      opts.onLog?.(`[diagnostics] run failed: ${(err as Error).message}`);
    }
  };

  const kick = (): void => {
    if (inFlight || !queued) return;
    const next = queued;
    queued = null;
    inFlight = run(next).finally(() => {
      inFlight = null;
      if (queued) kick();
    });
  };

  return {
    schedule(input) {
      if (queued) {
        queued = {
          scope: queued.scope === "project" || input.scope === "project" ? "project" : "file",
          files: Array.from(new Set([...queued.files, ...input.files])),
        };
      } else {
        queued = input;
      }
      kick();
    },
  };
}

function keyed(diags: Diagnostic[]): Baseline {
  const map: Baseline = new Map();
  for (const d of diags) {
    const set = map.get(d.file) ?? new Set<string>();
    set.add(`${d.severity}|${d.line ?? 0}|${d.col ?? 0}|${d.message}`);
    map.set(d.file, set);
  }
  return map;
}

function diff(current: Baseline, prior: Baseline): Diagnostic[] {
  const added: Diagnostic[] = [];
  for (const [file, keys] of current) {
    const priorKeys = prior.get(file) ?? new Set();
    for (const k of keys) {
      if (priorKeys.has(k)) continue;
      const [severity, line, col, ...rest] = k.split("|");
      added.push({
        file,
        line: Number(line) || undefined,
        col: Number(col) || undefined,
        severity: severity as Diagnostic["severity"],
        message: rest.join("|"),
      });
    }
  }
  return added;
}

function fileMatches(a: string, b: string): boolean {
  if (a === b) return true;
  return a.endsWith(b) || b.endsWith(a);
}
