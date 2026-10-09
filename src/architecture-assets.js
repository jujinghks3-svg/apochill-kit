import * as THREE from 'three';
import {cleanBuildingGeometry} from './building-surface-cleanup.js';
import {glassWeathering} from './glass-weathering.js';

export const architectureAssets=[
  {id:'curved-glass-office',title:'곡면 유리 오피스'},
  {id:'stone-rib-tower',title:'석재 리브 타워'},
  {id:'apartment-slab',title:'노후 아파트'},
];

// Reviewed against the generated GLBs in the rooftop camera. Shared sources are
// scaled uniformly; the footprint also removes the previous facade and plants.
export const architectureSlots=[
  {id:'curved-glass-office',x:-35,z:-79,height:35,width:16,depth:16,yaw:.1},
  {id:'curved-glass-office',x:-6,z:-169,height:39,width:17,depth:17,yaw:-.12},
  {id:'stone-rib-tower',x:-78,z:-64,height:53,width:23,depth:21,yaw:-1.3},
  {id:'stone-rib-tower',x:-30,z:-171,height:58,width:25,depth:24,yaw:-1.2},
  {id:'apartment-slab',x:-50,z:-96,height:25,width:27,depth:15,yaw:-1.35},
  {id:'apartment-slab',x:11,z:-92,height:30,width:31,depth:18,yaw:-1.5},
  {id:'stone-rib-tower',x:-49,z:-57,height:42,width:18,depth:18,yaw:-1.25},
  {id:'curved-glass-office',x:37,z:-76,height:40,width:18,depth:16,yaw:.45},
  {id:'curved-glass-office',x:-75,z:-96,height:42,width:18,depth:17,yaw:-.28},
  {id:'apartment-slab',x:27,z:-48,height:22,width:19,depth:12,yaw:-1.45},
];

export async function loadArchitectureCatalog(loader,baseUrl='/') {
  const results=await Promise.allSettled(architectureAssets.map(async asset=>{
    const url=`${baseUrl}buildings/${asset.id}.glb`;
    // One GET avoids a separate HEAD decision and the race between the two.
    // Vite can return the HTML fallback with status 200 for absent public files.
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength<12||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('Not a GLB');
    const gltf=await loader.parseAsync(buffer,`${baseUrl}buildings/`);
    gltf.scene.traverse(o=>{if(o.isMesh)cleanBuildingGeometry(o.geometry,{doubleSided:o.material.side===THREE.DoubleSide});});
    if(asset.id==='curved-glass-office')gltf.scene.traverse(o=>{
      if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material])){
        m.color?.multiplyScalar(1.3);if(m.metalness!==undefined)m.metalness=Math.min(m.metalness,.12);
        m.userData.glassFacade='masked';
        glassWeathering(m);
      }
    });
    return [asset.id,gltf.scene];
  }));
  const catalog=new Map(),failures=[];
  results.forEach((result,i)=>{
    if(result.status==='fulfilled'&&result.value)catalog.set(...result.value);
    else if(result.status==='rejected'){
      failures.push(architectureAssets[i].id);
      console.warn('[Apochill] Building unavailable:',architectureAssets[i].id,result.reason?.message);
    }
  });
  return {catalog,failures};
}

export function placeArchitecture(source,slot) {
  const root=new THREE.Group();root.name=`replaceable-tripo-${slot.id}`;
  const oriented=new THREE.Group();oriented.rotation.y=slot.yaw;
  oriented.add(source.clone(true));root.add(oriented);root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(oriented),size=bounds.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0))throw new Error(`Invalid architectural bounds: ${slot.id}`);
  const scale=Math.min(slot.height/size.y,slot.width/size.x,slot.depth/size.z);
  oriented.scale.setScalar(scale);root.updateMatrixWorld(true);bounds.setFromObject(oriented);
  const center=bounds.getCenter(new THREE.Vector3());
  root.position.set(slot.x-center.x,(slot.groundY??-28.1)-bounds.min.y,slot.z-center.z);
  root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
  root.updateMatrixWorld(true);bounds.setFromObject(root);bounds.getSize(size);
  const footprint={x:slot.x,z:slot.z,w:size.x,d:size.z,h:size.y,groundY:bounds.min.y,roofY:bounds.max.y,overgrown:false,replacement:true};
  const localBounds=new THREE.Box3().setFromObject(source);
  const outline=source.userData.shoreOutline??[
    [localBounds.min.x,localBounds.min.z],[localBounds.max.x,localBounds.min.z],
    [localBounds.max.x,localBounds.max.z],[localBounds.min.x,localBounds.max.z]];
  const matrix=source.userData.shoreOutline?oriented.children[0].matrixWorld:oriented.matrixWorld;
  footprint.shorePolygon=outline.map(([x,z])=>{const p=new THREE.Vector3(x,0,z).applyMatrix4(matrix);return [p.x,p.z];});
  return {root,footprint};
}

export function intersectsArchitecture(building,footprints,margin=.4) {
  return footprints.some(f=>Math.abs(building.x-f.x)<(building.w+f.w)/2+margin
    &&Math.abs(building.z-f.z)<(building.d+f.d)/2+margin);
}
