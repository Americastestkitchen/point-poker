// The UI kit gallery: gallery.html in dev; build:gallery checks its standalone bundle.
import { createStorage } from "../../app/storage.ts";
import { createAudio } from "../../audio/sfx.ts";
import { mountUi } from "../root.tsx";
import { Gallery } from "./Gallery.tsx";

const audio = createAudio(createStorage(localStorage));
const container = document.getElementById("ui");
if (!container) throw new Error("gallery.html has no #ui");
mountUi(container, <Gallery audio={audio} />, { sounds: audio });
