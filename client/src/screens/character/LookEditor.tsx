// "Change look" at the table (the lobby's dock, the game menu): character select over the room,
// without the name (the table already knows you by it). Every change goes to the table as you
// make it, so everyone sees you try things on. Done keeps the look for next time; Back puts
// you back the way you were.
import { useState } from "react";
import { useAppState, useGame, useMe } from "../game.tsx";
import { CharacterEditor } from "./CharacterEditor.tsx";

export function LookEditor() {
  const open = useAppState((st) => st.screen === "table" && st.ui.lookOpen);
  return open ? <OpenLookEditor /> : null;
}

/** Mounted only while the editor is open, so it remembers the look you came in with. */
function OpenLookEditor() {
  const { store, storage, actions } = useGame();
  const me = useMe();
  // who you were when it opened: the editor's starting point, and where Back returns you
  const [before] = useState(() => (me ? { name: me.name, look: me.look } : null));
  if (!me || !before) return null;
  return (
    <div data-screen="look">
      <CharacterEditor
        initial={before}
        withName={false}
        dealer={me.isDealer}
        doneLabel="Done"
        onChange={(look) => actions.setLook(look)}
        onDone={(profile) => {
          storage.setProfile(profile);
          store.lookClosed();
        }}
        onBack={() => {
          if (me.look !== before.look) actions.setLook(before.look);
          store.lookClosed();
        }}
      />
    </div>
  );
}
