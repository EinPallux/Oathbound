// Builds Three.js meshes from the pure heightfield data. The terrain is a single
// vertex-coloured mesh; rocks are one InstancedMesh (one draw call).

import * as THREE from 'three';
import type { Heightfield, CylinderCollider } from '../world/heightfield';

export function buildTerrainMesh(field: Heightfield): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(field.size, field.size, field.res - 1, field.res - 1);
  geo.rotateX(-Math.PI / 2); // lie flat in the XZ plane (Y becomes height)

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x365a35);
  const high = new THREE.Color(0x8a946a);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = field.sample(x, z);
    pos.setY(i, h);
    const t = THREE.MathUtils.clamp((h + 2) / 5, 0, 1);
    tmp.copy(low).lerp(high, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

export function buildProps(cols: readonly CylinderCollider[], field: Heightfield): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, cols.length);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const y = field.sample(c.x, c.z);
    dummy.position.set(c.x, y + c.radius * 0.4, c.z);
    dummy.scale.setScalar(c.radius);
    dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = 'props';
  return mesh;
}
