// What defineCommand infers, checked by the compiler (nothing runs here).
import { z } from "zod";
import { assertType, type Equal, type IsAny } from "../../test/types.ts";
import { defineCommand, type Command } from "./commands.ts";
import type { TableFx } from "./table.ts";

// The Command union comes out of the list exactly.
assertType<Equal<IsAny<Command>, false>>();
assertType<Equal<string extends Command["t"] ? true : false, false>>();
assertType<Equal<Extract<Command, { t: "vote" }>, { t: "vote"; value: number | null }>>();
assertType<Equal<Extract<Command, { t: "deal" }>, { t: "deal" }>>();
// @ts-expect-error a vote is a number
export const badVote: Command = { t: "vote", value: "3" };

// A command's input becomes its typed `cmd`, and a dealer command gets the dealer's abilities.
defineCommand({
  t: "probe", role: "dealer", move: "anytime", input: { n: z.number() },
  run: (ctx, _me, cmd) => {
    assertType<Equal<typeof cmd, { t: "probe"; n: number }>>();
    return ctx.load(String(cmd.n), "probe");
  },
});

// A player command can't reach them.
defineCommand({
  t: "probe", role: "player", move: "anytime", input: {},
  // @ts-expect-error players can't load tickets
  run: (ctx) => ctx.load("SD-1", "SD-1"),
});

// Every command says which round move it is (or "anytime"), so the table can check the phase.
// @ts-expect-error leaving the move out doesn't compile
defineCommand({ t: "probe", role: "player", input: {}, run: () => {} });
// @ts-expect-error nor does a move the round doesn't have
defineCommand({ t: "probe", role: "player", move: "fold", input: {}, run: () => {} });
defineCommand({ t: "probe", role: "dealer", move: "settle", input: {}, run: () => {} });

// The effects commands make are the protocol's flick and adjust.
assertType<Equal<TableFx["kind"], "flick" | "adjust">>();
