// The client's registries must cover every id in their catalog, checked by the compiler (nothing runs here).
import { BODY_SHAPES } from "./avatar/bodies/index.ts";
import { BUILDERS } from "./avatar/cosmetics/index.ts";

// @ts-expect-error every cosmetic needs a builder
export const someBuilders: typeof BUILDERS = { crown: BUILDERS.crown };
// @ts-expect-error every body needs a shape
export const someShapes: typeof BODY_SHAPES = { bean: BODY_SHAPES.bean };
