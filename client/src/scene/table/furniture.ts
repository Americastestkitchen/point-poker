// The poker table itself. Its shape and place come from `layout`; what it's
// made of comes from the environment.
import * as THREE from "three";
import type { BuiltEnvironment } from "../../environments/types.ts";
import type { Layout } from "../layout/layout.ts";

export function buildTable(layout: Layout, mats: BuiltEnvironment["tableMaterials"]): THREE.Group {
  const { y, rx, rz } = layout.table;
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 64), [mats.wood, mats.felt, mats.wood]);
  top.scale.set(rx, 1, rz);
  top.position.y = y - 0.03;
  top.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 96), mats.trim);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(rx + 0.03, rz + 0.03, 1);
  rim.position.y = y;
  rim.castShadow = rim.receiveShadow = true;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 0.16, 64), mats.wood);
  skirt.scale.set(rx, 1, rz);
  skirt.position.y = y - 0.12;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 0.7, 24), mats.base);
  leg.position.y = 0.35;
  leg.castShadow = true;
  g.add(top, rim, skirt, leg);
  return g;
}
