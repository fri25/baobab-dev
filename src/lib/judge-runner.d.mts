export const MAX_CODE_LENGTH: number;
export const FN_NAME: RegExp;
export function sameValue(a: unknown, b: unknown): boolean;
export function judge(
  code: string,
  fn: string,
  tests: { args: unknown[]; expected: unknown; is_public: boolean }[],
): Promise<unknown>;
