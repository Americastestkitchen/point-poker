// Every body shape, by id.
import type { BodyId } from "../../../../shared/catalog/bodies.ts";
import { bean } from "./bean.ts";
import type { BodyShape } from "./body.ts";
import { box } from "./box.ts";
import { chonk } from "./chonk.ts";
import { noodle } from "./noodle.ts";
import { pear } from "./pear.ts";

export type { BodyShape } from "./body.ts";

export const BODY_SHAPES: Record<BodyId, BodyShape> = { bean, chonk, noodle, box, pear };
