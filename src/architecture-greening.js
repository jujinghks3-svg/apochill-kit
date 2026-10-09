import * as THREE from 'three';
import {grassGeometry,windMaterial} from './painted-nature.js';
import {createRuinShrubs} from './city-forest.js';
import {addVines} from './branch-foliage.js';
import {createBuildingTrees} from './building-trees.js';
import {facadeIvy} from './facade-ivy.js';
import {addRoofFacilities} from './roof-facilities.js';

export function sampleRoofAnchors(root,seed=6201,count=180){
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),normalMatrix=new THREE.Matrix3(),points=[];
  for(let i=0;i<count;i++){
    const x=bounds.min.x+size.x*(.08+random()*.84),z=bounds.min.z+size.z*(.08+random()*.84);
    if(Math.sin(x*.72+z*.39)+Math.cos(z*.53-x*.28)<-.15)continue;
    ray.set(new THREE.Vector3(x,bounds.max.y+1,z),down);
    const hit=ray.intersectObject(root,true)[0];
    if(!hit?.face||hit.point.y<bounds.max.y-size.y*.24)continue;
    const normal=hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
    if(normal.y<.88)continue;
    points.push(hit.point.clone().addScaledVector(down,-.025));
  }
  return points;
}

function* architectureGreeningSteps(world,placements,{mobile=false,growthDensity=mobile?.5:1,vineDistance=mobile?125:Infinity}={}){
  if(!placements.length)return {tufts:0,shrubs:0};
  const shrub=createRuinShrubs(),geometry=grassGeometry(4,2),material=windMaterial('#ffffff',.15,true,true);
  const transform=new THREE.Object3D(),buckets=new Map(),vineBuckets=new Map();let tufts=0,shrubs=0,vines=0;
  const buildingTrees=createBuildingTrees();
  const roofFacilities=addRoofFacilities(world,placements);
  const profiles={engulfed:0,clustered:0,sparse:0,distant:0};
  for(const [index,{root,footprint}] of placements.entries()){
    if(root.userData.coverageBackdrop){profiles.distant++;yield {done:index+1,total:placements.length};continue;}
    const distance=Math.hypot(footprint.x-13,footprint.z-20);
    const growth=distance>vineDistance?{trails:[],profile:'distant'}:facadeIvy(root,footprint,index);profiles[growth.profile]++;
    if(growth.trails.length){
      const key=`${Math.floor(footprint.x/56)}:${Math.floor(footprint.z/56)}`;
      if(!vineBuckets.has(key))vineBuckets.set(key,[]);
      vineBuckets.get(key).push(...growth.trails);vines+=growth.trails.length;
    }
    const samples=root.userData.growthSamples??180;
    const anchors=sampleRoofAnchors(root,6201+index*137,Math.max(6,Math.ceil(samples*growthDensity))).filter(p=>!(root.userData.roofEquipmentZones??[]).some(z=>Math.abs(p.x-z.x)<z.w/2+.5&&Math.abs(p.z-z.z)<z.d/2+.5));
    buildingTrees.populate(root,footprint,anchors,index);
    const padGrowth=root.userData.roofPadGrowth??[];
    yield {done:index+1,total:placements.length};
    if(!anchors.length&&!padGrowth.length)continue;
    const shrubAnchors=[];
    [...anchors,...padGrowth].forEach((point,i)=>{
      const key=`${Math.floor(point.x/48)}:${Math.floor(point.z/48)}`;
      if(!buckets.has(key))buckets.set(key,[]);
      transform.position.copy(point);transform.rotation.set(0,i*2.399,0);transform.scale.setScalar(i<anchors.length?.5+(i%7)*.045:.22+(i%7)*.045);transform.updateMatrix();buckets.get(key).push(transform.matrix.clone());
      if(i<anchors.length&&shrubAnchors.length<(root.userData.district?2:5)&&i%9===0&&shrubAnchors.every(p=>p.distanceTo(point)>2.1)){
        shrub(world,point.x,point.y,point.z,1.6+(i%3)*.35,i%3);shrubAnchors.push(point);shrubs++;
      }
    });
    tufts+=anchors.length+padGrowth.length;
  }
  for(const [key,matrices] of buckets){
    const grass=new THREE.InstancedMesh(geometry,material,matrices.length);grass.name=`tripo-roof-meadow-${key}`;grass.receiveShadow=true;
    matrices.forEach((matrix,i)=>grass.setMatrixAt(i,matrix));grass.computeBoundingBox();grass.computeBoundingSphere();grass.boundingSphere.radius+=.3;world.add(grass);
  }
  let vineTriangles=0;
  for(const trails of vineBuckets.values()){
    const ivy=addVines(world,trails);vineTriangles+=(ivy?.geometry.index?.count??0)/3;
    yield {done:placements.length,total:placements.length};
  }
  return {roofFacilities,...buildingTrees.finish(world),tufts,shrubs,batches:buckets.size,vines,vineBatches:vineBuckets.size,vineTriangles,profiles};
}

export function addArchitectureGreening(world,placements,options){
  const steps=architectureGreeningSteps(world,placements,options);
  let step;do{step=steps.next();}while(!step.done);return step.value;
}

export async function addArchitectureGreeningAsync(world,placements,{onProgress=()=>{},...options}={}){
  const steps=architectureGreeningSteps(world,placements,options);
  let deadline=performance.now()+12;
  while(true){
    const step=steps.next();if(step.done)return step.value;
    if(performance.now()>=deadline){
      onProgress(step.value);
      await new Promise(resolve=>setTimeout(resolve,0));
      deadline=performance.now()+12;
    }
  }
}
