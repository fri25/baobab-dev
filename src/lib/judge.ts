import "server-only";
import { judge as run, FN_NAME, MAX_CODE_LENGTH } from "./judge-runner.mjs";

export type TestCase = { args: unknown[]; expected: unknown; is_public: boolean };
export type TestResult = {
  index: number;
  public: boolean;
  pass: boolean;
  ms: number | null;
  args?: string;
  expected?: string;
  got?: string;
  error?: string;
};
export type JudgeReport = { error?: string; results: TestResult[]; passed: number; total: number; score: number };

export { FN_NAME, MAX_CODE_LENGTH };

export function judge(code: string, fn: string, tests: TestCase[]): Promise<JudgeReport> {
  return run(code, fn, tests) as Promise<JudgeReport>;
}

/** Lit les tests saisis par la modération : [{ "args": [...], "expected": ..., "public": true }] */
export function parseTests(raw: string): TestCase[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Les tests ne sont pas du JSON valide.");
  }
  if (!Array.isArray(data) || !data.length) throw new Error("Il faut au moins un test.");
  if (data.length > 50) throw new Error("50 tests au maximum.");
  const tests = data.map((t, i) => {
    if (!t || typeof t !== "object" || !Array.isArray(t.args) || !("expected" in t))
      throw new Error(`Test ${i + 1} : il faut "args" (tableau) et "expected".`);
    return { args: t.args as unknown[], expected: t.expected, is_public: t.public === true };
  });
  if (!tests.some((t) => t.is_public)) throw new Error("Au moins un test doit être public (exemple).");
  if (!tests.some((t) => !t.is_public)) throw new Error("Au moins un test doit être caché.");
  return tests;
}
