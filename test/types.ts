// For *.test-d.ts files: checks that only `npm run typecheck` runs (`npm test`
// skips them, as they don't end in .test.ts). They catch an inferred type
// quietly turning into `any` or `string`, which would still compile and run.

/** True only when A and B are the same type (`any` only equals `any`). */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the deferred generic is how the comparison tells types apart
export type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type IsAny<T> = 0 extends 1 & T ? true : false;
/** Fails to compile unless its type argument is `true`. Type-only: there is nothing to run. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the constraint is the whole check; nothing is passed
export declare function assertType<_T extends true>(): void;
