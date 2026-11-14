// Standup Station: a subway platform where the 9:30 is always running a few
// minutes over. A split-flap board behind the dealer, the logo in tiles across the
// tracks, a rubber rat in a conductor's cap, and a train that never stops here.
import * as THREE from "three";
import type { Environment } from "../types.ts";
import { departureBoard } from "./board.ts";
import { buskerCase, ledTicker, lineMap, mindTheGap, paSpeaker, sprintTrain } from "./eggs.ts";
import { rubberRat } from "./rat.ts";
import { ROOM, buildPlatform, ceilingLights, stripLight } from "./room.ts";
import { mosaicSign } from "./sign.ts";
import { stationBed } from "./sound.ts";
import { moquetteTexture } from "./textures.ts";

export default {
  backdrop(ctx) {
    const { anchors, sound, onFrame } = ctx;
    const object = new THREE.Group();
    object.add(new THREE.HemisphereLight("#cfe6dc", "#3a3530", 1.45));
    object.add(new THREE.AmbientLight("#ffffff", 0.35));
    const { edgeLine } = buildPlatform(object);
    const lamp = stripLight(anchors.lamp, ctx);
    const strips = ceilingLights();
    object.add(lamp.object, strips.object);

    const ticker = ledTicker();
    ticker.object.position.set(2.6, ROOM.ceiling - 0.95, -2.1);
    ticker.object.rotation.y = -Math.PI / 2;
    const pa = paSpeaker(ctx, ticker);
    pa.position.set(2.6, ROOM.ceiling - 0.6, -3.1);
    pa.rotation.y = -Math.PI / 2;
    const map = lineMap(ctx, ticker);
    map.position.set(ROOM.far - 0.03, 2.05, -2.85);
    map.rotation.y = -Math.PI / 2;
    const busker = buskerCase(ctx, ticker);
    busker.position.set(2.0, 0, 2.75);
    busker.rotation.y = -2.1;
    object.add(ticker.object, pa, map, busker, sprintTrain(ctx, ticker));
    mindTheGap(ctx, edgeLine, ticker);

    onFrame((dt, t) => {
      lamp.update(dt);
      strips.update(t);
      ticker.update(dt);
    });
    sound.bed(stationBed);
    return { object, background: new THREE.Color("#0b0f0e"), fog: new THREE.Fog("#0b0f0e", 9, 20) };
  },
  tableMaterials: () => ({
    felt: new THREE.MeshStandardMaterial({ map: moquetteTexture(), roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: "#7c858c", roughness: 0.45, metalness: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: "#c4cbd1", roughness: 0.3, metalness: 0.75 }),
    base: new THREE.MeshStandardMaterial({ color: "#4f565c", roughness: 0.4, metalness: 0.6 }),
  }),
  props: { statusScreen: departureBoard, sign: mosaicSign, squeaky: rubberRat },
} satisfies Environment;
