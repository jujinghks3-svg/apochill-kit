import * as THREE from 'three';
import {ivyRandom} from './ivy-vines.js';

// Sample the real model, so vines stop at missing walls rather than bridging
// open ruins. Profiles are spatially seeded and retain variation across reloads.
export function facadeIvy(root,footprint,index){
  const seed=(Math.round(footprint.x*107)^Math.round(footprint.z*331)^81791)>>>0,random=ivyRandom(seed);
  const distance=Math.hypot(footprint.x-13,footprint.z-20);
  const heavy=[0,2,5,7].includes(index)||(root.userData.district&&distance<135&&seed%19===0);
  const profile=heavy?'engulfed':random()<.36?'sparse':'clustered';
  const dominant=index===0||index===7;
  if(distance>205)return {trails:[],profile:'distant'};
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  const ray=new THREE.Raycaster(),normalMatrix=new THREE.Matrix3(),trails=[];
  const faces=heavy||random()<.42?[new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)]:[new THREE.Vector3(0,0,1)];
  for(const normal of faces){
    const front=normal.z>0,span=front?size.x:size.z,minimum=front?bounds.min.x:bounds.min.z;
    const count=heavy?Math.min(dominant?88:54,Math.ceil(span*(dominant?5.4:3.2))):profile==='sparse'?1+Math.floor(random()*3):4+Math.floor(random()*5);
    const centres=[.12+random()*.16,.42+random()*.15,.75+random()*.12];
    for(let i=0;i<count;i++){
      const centre=centres[Math.floor(random()*centres.length)];
      const u=THREE.MathUtils.clamp(centre+(random()-.5)*(heavy?.46:.24),.035,.965);
      const distanceScale=THREE.MathUtils.lerp(.60,.34,THREE.MathUtils.smoothstep(distance,45,180));
      const width=Math.min(distance>90?.62:.88,span*.28,((dominant?1.3:heavy?.85:.40)+random()*(heavy?1.25:.85))*distanceScale);
      const length=Math.min(size.y*.92,heavy?size.y*(.28+random()*.66):1+Math.pow(random(),.8)*size.y*.58);
      const top=bounds.max.y-.2-(heavy?random()*size.y*.26:random()*Math.min(2,size.y*.08));
      const steps=Math.max(3,Math.ceil(length/.65)),phase=random()*6.28,drift=(random()-.5)*span*.23;
      let points=[],part=0;
      const flush=()=>{
        if(points.length>2)trails.push({points,width,normal,surface:root,seed:seed+i*137+part*941});
        points=[];part++;
      };
      for(let step=0;step<=steps;step++){
        const t=step/steps,y=top-length*t;if(y<bounds.min.y+.4)break;
        const along=THREE.MathUtils.clamp(minimum+span*u+(Math.sin(t*7+phase)+.35*Math.sin(t*17+phase))*width*1.1+drift*t,minimum+.08,minimum+span-.08);
        const origin=front?new THREE.Vector3(along,y,bounds.max.z+1):new THREE.Vector3(bounds.max.x+1,y,along);
        ray.set(origin,normal.clone().negate());
        const hit=ray.intersectObject(root,true)[0];
        if(!hit?.face){flush();continue;}
        const surface=hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
        if(surface.dot(normal)<.32){flush();continue;}
        const point=hit.point.clone().addScaledVector(surface,.018);
        if(points.length&&point.distanceTo(points.at(-1))>1.9)flush();
        points.push(point);
      }
      flush();
    }
  }
  return {trails,profile};
}
