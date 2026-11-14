// The poker table itself. Its shape and place come from `layout`; what it's
// made of comes from the room, and changes when the table moves rooms.
import * as THREE from "three";
import type { TableMaterials } from "../../environments/types.ts";
import type { Layout } from "../layout/layout.ts";

export interface Table {
  readonly object: THREE.Object3D;
  /** Re-covers the table; it stays hidden until the first room covers it. */
  setMaterials(mats: TableMaterials): void;
}

export function buildTable(layout: Layout): Table {
  const { y, rx, rz } = layout.table;
  const g = new THREE.Group();
  g.visible = false;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 64));
  top.scale.set(rx, 1, rz);
  top.position.y = y - 0.03;
  top.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 96));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(rx + 0.03, rz + 0.03, 1);
  rim.position.y = y;
  rim.castShadow = rim.receiveShadow = true;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 0.16, 64));
  skirt.scale.set(rx, 1, rz);
  skirt.position.y = y - 0.12;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 0.7, 24));
  leg.position.y = 0.35;
  leg.castShadow = true;
  g.add(top, rim, skirt, leg);
  return {
    object: g,
    setMaterials(mats) {
      top.material = [mats.wood, mats.felt, mats.wood];
      rim.material = mats.trim;
      skirt.material = mats.wood;
      leg.material = mats.base;
      g.visible = true;
    },
  };
}
