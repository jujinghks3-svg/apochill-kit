import * as THREE from 'three';

// Replace the temporary silhouette only after a complete, validated GLB load.
export async function loadNamsanLandmark(loader,world,baseUrl='/'){
  document.documentElement.dataset.namsanStatus='loading';
  try{
    const gltf=await loader.loadAsync(`${baseUrl}buildings/namsan-tower.glb`);
    const root=new THREE.Group();root.name='replaceable-tripo-namsan-tower';root.add(gltf.scene);
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
    if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid Namsan bounds');
    root.scale.setScalar(44/size.y);root.updateMatrixWorld(true);bounds.setFromObject(root);
    const center=bounds.getCenter(new THREE.Vector3());
    root.position.set(-82-center.x,2-bounds.min.y,-198-center.z);
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    world.getObjectByName('replaceable-namsan-placeholder')?.removeFromParent();world.add(root);
    document.documentElement.dataset.namsanStatus='loaded';
    return root;
  }catch(error){
    document.documentElement.dataset.namsanStatus='fallback';
    console.warn('[Apochill] Namsan landmark unavailable, keeping placeholder:',error.message);
    return null;
  }
}
