// The UI kit gallery (dev only): gallery.html.
import { createStorage } from "../../app/storage.ts";
import { createAudio } from "../../audio/sfx.ts";
import { mountUi } from "../root.tsx";
import { Gallery } from "./Gallery.tsx";

const audio = createAudio(createStorage(localStorage));
mountUi(document.getElementById("ui")!, <Gallery audio={audio} />, { sounds: audio });
