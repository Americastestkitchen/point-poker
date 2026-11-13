// "Change look" from the game menu: character select over the table, without the name (the
// table already knows you by it). Done saves your look and tells the table.
import { useAppState, useGame, useMe } from "../game.tsx";
import { CharacterEditor } from "./CharacterEditor.tsx";

export function LookEditor() {
  const { store, storage, actions } = useGame();
  const open = useAppState((st) => st.screen === "table" && st.ui.lookOpen);
  const me = useMe();
  if (!open || !me) return null;
  return (
    <div data-screen="look">
      <CharacterEditor
        initial={{ name: me.name, look: me.look }}
        withName={false}
        dealer={me.isDealer}
        doneLabel="Done"
        onDone={(profile) => {
          storage.setProfile(profile);
          actions.setLook(profile.look);
          store.lookClosed();
        }}
        onBack={() => store.lookClosed()}
      />
    </div>
  );
}
