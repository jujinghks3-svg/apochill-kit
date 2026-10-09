import * as THREE from 'three';
import {DOG_HOME} from './camp-expansion.js';

export function placeTripoDogHouse(source){
  const root=new THREE.Group();root.name='replaceable-shiba-house';
  const model=source.clone(true);root.add(model);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  // This generated mesh faces +X, matching the dog's existing entrance path.
  const scale=1.7/size.y;model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  root.position.set(DOG_HOME.x,DOG_HOME.y,DOG_HOME.z);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.updateMatrixWorld(true);
  // Measure the actual interior floor; the imported threshold differs from the
  // previous handmade bed. Never seat the resting dog inside the floor mesh.
  const ray=new THREE.Raycaster(new THREE.Vector3(DOG_HOME.x,DOG_HOME.y+.6,DOG_HOME.z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(model,true).find(h=>h.point.y<DOG_HOME.y+.4);
  if(!hit)throw Error('Generated dog house has no interior support floor');
  DOG_HOME.bedY=hit.point.y+.008;
  root.userData.source='tripo-dog-house';root.userData.floorY=DOG_HOME.bedY;
  return root;
}
