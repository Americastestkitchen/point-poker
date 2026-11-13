# Integrating features

Read [README.md](README.md) for the code map and [CONTRIBUTING.md](CONTRIBUTING.md)
for running, releasing and secrets. Keep changes focused; Jira is read-only.

## Boundaries and state

- `shared/` owns schemas, rules and catalog data used on both sides; no client/server imports.
- `server/table/` is plain table logic; `server/main.ts` injects ticket, persistence,
  auth and transport adapters. Client imports from server must be type-only.
- `client/src/main.ts` composes the browser app. `app/` owns state, actions, events,
  session and storage, without visual dependencies. World (`scene/`, `avatar/`,
  `environments/`) and UI communicate through that layer, without mutual imports.
- Read `store.getState()` / `store.subscribe()`. Write through named methods such as
  `receive`, `connectionChanged`, `creatorOpened`, `seated`, `vote` and `setUi`;
  add a purpose-specific method in `app/store.ts` when needed. The public `Store`
  type omits `setState`. Server views remain authoritative; `app/vote.ts` owns
  the existing optimistic vote reconciliation.
- `store.receive` commits the view and `diff` changes together. `ViewChange` in
  `app/events.ts` describes view transitions; `store.events` carries transient
  `GameEvent`s (effects, toasts, local moments). Subscribe once per owner and clean up.
  Keep camera/animation values in the frame loop, outside the store and React.

`test/boundaries.test.ts` is the executable import/source-rule reference; fix the
cause of a failure rather than adding exceptions. It also prevents page queries
and wall-clock timers in the world. Use `stage.after(seconds, fn)` or frame `dt`
for world delays. Only production `scene/index.ts` imports the layout **value**;
other consumers take injected `Layout` and use type-only imports (tests are exempt).

## To add or change…

- **Command / phase move:** add a `defineCommand` in `server/table/commands.ts`
  with schema fields, role, move and handler. `Table.run` already parses, checks
  role/phase and dispatches; do not add another dispatcher. For a new move, extend
  `round.ts`'s phase/refusal matrix and keep phase changes in its helpers. For a
  new phase, update `shared/protocol.ts` and the state/view consumers too. Add
  allowed/refused and role cases in `server/table/table.test.ts`, inference/invalid
  input cases in `commands.test-d.ts`, then expose the operation in `app/actions.ts`.
- **Protocol / server message:** edit Zod schemas in `shared/protocol.ts`, the
  sender/relay in `server/transport/ws.ts` (HTTP in `http.ts`), and the exhaustive
  `receive` switch in `app/session.ts`. Route persistent data through named store
  writes, transient messages through events. Cover parsing/routing in
  `app/session.test.ts` and wire behavior in `test/session.test.ts` as relevant.
- **Catalog / cosmetic / body:** follow `shared/catalog/`'s literal lists,
  `idsOf`/`byId` and derived ID types. Add cosmetic geometry under
  `avatar/cosmetics/` and register it in `BUILDERS`; add body shapes under
  `avatar/bodies/` and register in `BODY_SHAPES`, with anchors per `body.ts`.
  `DEALER_GEAR` is fixed equipment, not selectable catalog content. Check
  `shared/look.ts` for slot/validation changes. Registry coverage is type-tested
  in `client/src/registries.test-d.ts` and `shared/catalog/catalog.test-d.ts`.
- **Environment:** add metadata in `shared/catalog/environments.ts`, implement
  `environments/<id>/index.ts` against `environments/types.ts`, and register its
  lazy loader in `environments/index.ts`. Build with injected layout/audio/picking.
  Selection from settings is still #10: `scene/index.ts` currently loads Basement.
- **World placement:** edit `scene/layout/layout.ts` for shared coordinates;
  inject layout from `scene/index.ts` into consumers, as `buildTable` and
  `createTicketPaper` do. Body anchors belong in `avatar/bodies/`. For intentional
  position changes, run `npm run test:update-snapshots`, review and commit the
  affected layout/anchor `.snapshot` files.
- **Screen / kit primitive:** follow the contract below. Generic primitives and
  tokens belong in `ui/`, exported via `ui/index.ts`, with examples in
  `ui/gallery/Gallery.tsx`; keep game-specific content out of the kit. Kit CSS
  uses `--pp-*` tokens from `ui/tokens.ts` (see `ui/tokens.test.ts`).

## Screen contract (#4 title/creator, #11 HUD)

The in-game screen layer is in place: `main.ts` makes one `mountUi` call with
`screens/index.tsx`'s `createGameUi(...).ui`. `GameScreen.tsx` lays out the HUD
regions (top, ticket, status, announce, dock, flash) and popups (`ui.popup`);
each region's component lives in its slice folder (`screens/chrome/`, `round/`,
`dealer/`). Use `useGame()`, `useAppState`, `usePopup`, `useViewChanges` /
`useGameEvents` (`screens/moments.ts`) and the shared helpers there. `main.ts`
still mounts the legacy `mountLobby`; #4 owns it and its `scene/turntable.ts`
renderer/import exception.

- Put app-aware React screens in **`client/src/screens/`**, outside `ui/` and
  `app/`. When introducing that folder, add it to `UI` and the app visual-import
  prohibition in `test/boundaries.test.ts`, so the existing world/UI rules cover
  it. Screens may import app types/helpers and the kit, never world modules.
  The composition root injects any preview controls; #4 moves the preview onto
  the main stage rather than importing a renderer from a screen.
- Add one game `mountUi` call in `main.ts` for the screen tree, with injected
  `Store`, `Actions` and explicit dependencies (storage, audio, room/navigation
  callbacks as needed). Pass audio via `sounds` and a shared `createToasts()`
  instance via `toasts`. Keep its unmount cleanup with the app lifecycle.
- React reads the injected store using `useSyncExternalStore(store.subscribe,
  store.getState)` and derives display values during render. The wrappers
  are `useAppState`, `useRoom`, `useMe` and `usePopup` in `screens/game.tsx`. Do not
  copy server room/player/phase state into component state. Form drafts (use
  `editProfile` where applicable) and temporary focus may be local; shared local UI
  state gets named store methods (`popupOpened`/`popupClosed`). The injected screen
  services in `useGame()` (`ticketLoad`, `copy`, `mic`) keep their own transient
  state, read with `useSyncExternalStore` like `toasts`; do not add more without
  that reason. Commands go through injected actions, not session/socket calls.
- One adapter at the screen root subscribes to `store.events`, mapping `toast`
  to `toasts.show(text, { tone: level ?? "info" })`; unsubscribe on cleanup.
  `screens/GameRoot.tsx` is that adapter (it also shows joins, leaves and removal). An awaited action's
  error belongs to its form, or is emitted once as a toast, never both.
- Use existing `Dialog` for focus capture/restore and Tab trapping, `useBack`
  for menus, and `useFocusable`/`useRoving` for controls. Dialogs register deeper
  back handlers; equal-depth handlers resolve newest first. A non-dismissable
  dialog already consumes Escape. The #11 table menu should register at depth 0,
  active only at the table with no focused form; deeper popups take Escape first.
- #4/#11 must wire explicit keyboard ownership: inject an `allowsWorldKeys()`
  predicate into scene input from the composition root. It should deny world
  shortcuts while a dialog/menu is open or focus is in a UI control/form (including
  buttons, selects and contenteditable); scene input should also respect consumed
  events. The kit owns popup Escape; focused forms consume Escape for their own
  cancel/back before the table menu. Do not add competing global Escape handlers.
  The gate is `screens/keys.ts` (pure decisions, node-tested) and the table menu's
  Esc is registered in `screens/GameRoot.tsx`.

## New code and validation

Prefer factories with injected dependencies for new imperative client components
(`create*`/`mount*`) and function components for React. Keep existing classes and
union tags; no blanket conversions. Extend the discriminant already used within
a domain (`t` for messages/actions, `kind` for effects, `status` for connections,
`state` for pointer input). There is no universal tag or class ban enforced by tests.
At new boundaries use readable explicit success/failure types and human-readable
refusal reasons; preserve existing wire/result contracts unless the feature needs
an intentional protocol change. Legacy lobby/HUD migration belongs to #4/#11.

Run `npm run format` (oxfmt; layout is the formatter's, never hand-tuned), then
**`npm run check`**: the format check, lint, TypeScript (including `*.test-d.ts`), runtime tests,
game build to `dist`, then gallery build to `node_modules/.gallery`. Use the
existing boundary, registry, snapshot and session checks rather than duplicating
them here. `noUncheckedIndexedAccess` is enabled: narrow missing entries before use,
iterate values instead of reindexing, and model fixed shapes as tuples. Preserve
empty-input behavior and report broken invariants instead of hiding them with assertions.
No browser check is required for documentation-only changes.

`npm run lint` is oxlint with type-aware rules (`.oxlintrc.json`); every rule is an
error or off, never a warning. Fix the cause: narrow with `instanceof`, a type guard or
a Zod schema rather than `!`, `as` or `any`; give a switch over a union its missing cases,
or a `default` saying the rest is ignored on purpose. Treat React findings (effect
dependencies, refs read during render, index keys) as behaviour changes. Disable a rule
only where it is wrong for that exact line, naming it and the reason:
`// oxlint-disable-next-line <rule> -- <why>`; `test/boundaries.test.ts` enforces the form.
