import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge rigid scene pieces while keeping named replacement slots as separate groups.
export function batchStaticScene(root) {
  root.updateMatrixWorld(true);
  const buckets=new Map(), retired=new Set();
  root.traverse((object)=>{
    if(!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh || Array.isArray(object.material)
      || !(object.material.isMeshStandardMaterial||object.material.isMeshBasicMaterial)) return;
    let owner=object.parent;
    while(owner!==root && !owner.name.startsWith('replaceable-')) owner=owner.parent;
    const attributes=Object.keys(object.geometry.attributes).sort().join(',');
    const key=[owner.uuid,object.material.uuid,object.castShadow,object.receiveShadow,attributes].join('|');
    if(!buckets.has(key))buckets.set(key,{owner,objects:[]});
    buckets.get(key).objects.push(object);
  });
  for(const {owner,objects} of buckets.values()) {
    if(objects.length<3)continue;
    const inverse=new THREE.Matrix4().copy(owner.matrixWorld).invert();
    const pieces=objects.map((object)=>{
      // Retain shared vertices rather than expanding every triangle during startup.
      const geometry=object.geometry.clone();
      if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));return geometry;
    });
    const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    if(!merged)continue;
    const batch=new THREE.Mesh(merged,objects[0].material);
    batch.name='static-scene-batch';batch.castShadow=objects[0].castShadow;batch.receiveShadow=objects[0].receiveShadow;
    owner.add(batch);
    objects.forEach(object=>{retired.add(object.geometry);object.removeFromParent();});
  }
  root.traverse(object=>{if(object.geometry)retired.delete(object.geometry);});
  retired.forEach(geometry=>geometry.dispose());
}
