import * as THREE from 'three';

import type { LocalizedText } from '@/types/domain';

/**
 * A stylised skeleton built from primitives, so the viewer works out of the box
 * without downloading a model. Each mesh carries `userData.structure`; meshes
 * sharing a key (e.g. every vertebra → "spine") are selected together.
 * Real atlases replace it with a GLB (see public/models/README.md).
 */
export const DEMO_STRUCTURES: Record<string, LocalizedText> = {
  skull: { fr: 'Crâne', en: 'Skull' },
  mandible: { fr: 'Mandibule', en: 'Mandible' },
  spine: { fr: 'Colonne vertébrale', en: 'Vertebral column' },
  ribs: { fr: 'Côtes', en: 'Ribs' },
  sternum: { fr: 'Sternum', en: 'Sternum' },
  heart: { fr: 'Cœur', en: 'Heart' },
  clavicle_l: { fr: 'Clavicule gauche', en: 'Left clavicle' },
  clavicle_r: { fr: 'Clavicule droite', en: 'Right clavicle' },
  humerus_l: { fr: 'Humérus gauche', en: 'Left humerus' },
  humerus_r: { fr: 'Humérus droit', en: 'Right humerus' },
  forearm_l: { fr: 'Radius et ulna gauches', en: 'Left radius & ulna' },
  forearm_r: { fr: 'Radius et ulna droits', en: 'Right radius & ulna' },
  pelvis: { fr: 'Bassin (os coxaux)', en: 'Pelvis (hip bones)' },
  femur_l: { fr: 'Fémur gauche', en: 'Left femur' },
  femur_r: { fr: 'Fémur droit', en: 'Right femur' },
  leg_l: { fr: 'Tibia et fibula gauches', en: 'Left tibia & fibula' },
  leg_r: { fr: 'Tibia et fibula droits', en: 'Right tibia & fibula' },
};

export function buildDemoSkeleton(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'DemoSkeleton';
  const bone = new THREE.MeshStandardMaterial({ color: '#e8dcc3', roughness: 0.55, metalness: 0.05 });
  const heartMaterial = new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.4 });

  const add = (structure: string, geometry: THREE.BufferGeometry, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], material = bone) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = structure;
    mesh.userData.structure = structure;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
  };

  // Head
  add('skull', new THREE.SphereGeometry(0.11, 32, 24), [0, 1.62, 0]).scale.set(0.88, 1.05, 1.1);
  add('mandible', new THREE.TorusGeometry(0.06, 0.017, 10, 24, Math.PI), [0, 1.52, 0.02], [Math.PI / 2, 0, Math.PI]);

  // Vertebral column: 24 vertebrae with a gentle S curve, plus the sacrum.
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    add('spine', new THREE.CylinderGeometry(0.022 + t * 0.012, 0.022 + t * 0.012, 0.017, 16), [0, 1.45 - t * 0.5, -0.045 + Math.sin(t * Math.PI * 2) * 0.02]);
  }
  add('spine', new THREE.ConeGeometry(0.05, 0.1, 16), [0, 0.9, -0.05], [Math.PI, 0, 0]);

  // Thorax: 10 rib pairs as open rings (gap in front for the sternum).
  const arc = Math.PI * 2 * 0.86;
  const gapAngle = arc + (Math.PI * 2 - arc) / 2;
  for (let i = 0; i < 10; i++) {
    const radius = 0.1 + Math.sin(((i + 2) / 12) * Math.PI) * 0.05;
    const holder = new THREE.Group();
    holder.position.set(0, 1.37 - i * 0.027, -0.02);
    holder.rotation.y = -gapAngle - Math.PI / 2; // point the gap towards +z (front)
    holder.scale.set(1.15, 1, 0.85);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.007, 8, 40, arc), bone);
    rib.name = 'ribs';
    rib.userData.structure = 'ribs';
    rib.rotation.x = -Math.PI / 2;
    holder.add(rib);
    root.add(holder);
  }
  add('sternum', new THREE.BoxGeometry(0.035, 0.19, 0.014), [0, 1.27, 0.11]);
  add('heart', new THREE.SphereGeometry(0.052, 32, 24), [0.02, 1.22, 0.02], [0, 0, -0.45], heartMaterial).scale.set(1, 1.2, 0.9);

  // Upper limbs
  for (const side of [-1, 1] as const) {
    const s = side === -1 ? 'r' : 'l'; // anatomical right is on the viewer's left
    add(`clavicle_${s}`, new THREE.CylinderGeometry(0.009, 0.009, 0.15, 12), [side * 0.085, 1.4, 0.06], [0.25, 0, side * (Math.PI / 2 - 0.12)]);
    add(`humerus_${s}`, new THREE.CylinderGeometry(0.018, 0.015, 0.3, 16), [side * 0.2, 1.2, -0.01], [0, 0, side * 0.08]);
    add(`forearm_${s}`, new THREE.CylinderGeometry(0.011, 0.009, 0.26, 12), [side * 0.225, 0.91, 0.02], [0, 0, side * 0.05]);
    add(`forearm_${s}`, new THREE.CylinderGeometry(0.011, 0.009, 0.26, 12), [side * 0.24, 0.91, -0.015], [0, 0, side * 0.05]);
  }

  // Pelvis and lower limbs
  add('pelvis', new THREE.TorusGeometry(0.1, 0.03, 12, 32), [0, 0.94, -0.01], [Math.PI / 2 - 0.3, 0, 0]).scale.set(1.3, 0.8, 1);
  for (const side of [-1, 1] as const) {
    const s = side === -1 ? 'r' : 'l';
    add(`femur_${s}`, new THREE.CylinderGeometry(0.022, 0.018, 0.44, 16), [side * 0.09, 0.64, 0], [0, 0, side * -0.05]);
    add(`leg_${s}`, new THREE.CylinderGeometry(0.019, 0.015, 0.38, 16), [side * 0.1, 0.21, 0.01]);
    add(`leg_${s}`, new THREE.CylinderGeometry(0.009, 0.008, 0.36, 12), [side * 0.128, 0.21, -0.01]);
  }

  return root;
}
