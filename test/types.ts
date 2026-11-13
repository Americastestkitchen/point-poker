// For *.types.test.ts files: checks that run when `npm run typecheck` does
// and cost nothing at runtime. They catch an inferred type quietly turning
// into `any` or `string`, which would still compile and run.

/** True only when A and B are the same type (`any` only equals `any`). */
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type IsAny<T> = 0 extends 1 & T ? true : false;
/** Fails to compile unless T is `true`. */
export function assertType<T extends true>(): void {}
