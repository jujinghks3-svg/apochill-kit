import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createShibaBehavior} from './shiba-home-behavior.js';

// A hand-authored clear corridor inside the roof parapet, away from fire,
// chairs, storage boxes, the water tank and trees. Arc-length sampling avoids
// speeding up at corners; the dog pauses twice on each lap.
export const SHIBA_ROUTE=[[1.65,4.1],[1.85,5.4],[3.7,5.95],[5.7,5.55],[5.8,4.55],[4.25,4.5],[2.7,4.15],
  [1.85,3.1],[1.65,1.8],[1.18,.55],[1.18,-.25],[1.65,-1.25],[1.8,-1.9],
  [2.5,-1.75],[3.7,-1.55],[3.8,.45],[3.55,1.5],[2.5,1.65],[1.9,2.4],[1.65,3.3]];
const path=new T.CatmullRomCurve3(SHIBA_ROUTE.map(([x,z])=>new T.Vector3(x,.09,z)),true,'centripetal');
path.arcLengthDivisions=600;path.updateArcLengths();
const halfDistance=path.getLength()/2,moveTime=halfDistance/.32,restTime=3.6,ramp=1.2;
const strideSpeed=halfDistance/(moveTime-ramp);
const integratedSpeed=t=>t<ramp?t*t/(2*ramp):t>moveTime-ramp?moveTime-ramp-(moveTime-t)**2/(2*ramp):t-ramp/2;
export const SHIBA_LAP_SECONDS=2*(moveTime+restTime);
export function sampleShibaRoute(seconds){
  const cycle=T.MathUtils.euclideanModulo(seconds,SHIBA_LAP_SECONDS),leg=Math.floor(cycle/(moveTime+restTime));
  const t=Math.min(cycle-leg*(moveTime+restTime),moveTime);
  const progress=(leg+integratedSpeed(t)/(moveTime-ramp))/2;
  const speed=strideSpeed*Math.max(0,Math.min(1,t/ramp,(moveTime-t)/ramp));
  const position=path.getPointAt(progress%1),direction=path.getTangentAt(progress%1);
  return {position,yaw:Math.atan2(direction.x,direction.z),speed};
}

export function createRoamingShiba(gltf,{random=Math.random}={}){
  if(!gltf.animations.length)throw Error('Shiba walk clip is missing');
  const root=new T.Group();root.name='replaceable-shiba';
  const model=clone(gltf.scene),facing=new T.Group();root.add(facing);facing.add(model);
  // The rig export faces +Z (checked against the textured muzzle, rather
  // than joint names: this export's Head labels lie near the tail).
  facing.rotation.y=0;
  // Freshly cloned skinned meshes may still hold source-world bounding boxes.
  // Update every bone first, then measure actual posed vertices for grounding.
  const posedBounds=()=>{
    root.updateMatrixWorld(true);const box=new T.Box3(),point=new T.Vector3();
    model.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.skeleton.update();
      for(let i=0;i<o.geometry.attributes.position.count;i++)box.expandByPoint(o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld));
    });return box;
  };
  let bounds=posedBounds();
  facing.scale.setScalar(.85/bounds.getSize(new T.Vector3()).y);
  bounds=posedBounds();
  facing.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});
  root.updateMatrixWorld(true);
  const soleSamples=[],point=new T.Vector3();
  model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(point.y<.16)soleSamples.push({mesh,index:i});
    }
  });
  if(!soleSamples.length)throw Error('Shiba contact samples missing');
  const mixer=new T.AnimationMixer(model),clip=gltf.animations[0],action=mixer.clipAction(clip).play();
  const behavior=createShibaBehavior({sampleRoute:sampleShibaRoute,lapSeconds:SHIBA_LAP_SECONDS,random});
  const heading=new T.Quaternion(),up=new T.Vector3(0,1,0);
  let lastTime=null;
  function update(seconds){
    const first=lastTime===null,dt=first?0:Math.min(.1,Math.max(0,seconds-lastTime));lastTime=seconds;
    const state=behavior.update(dt);
    root.position.copy(state.position);heading.setFromAxisAngle(up,state.yaw);
    if(first)root.quaternion.copy(heading);else root.quaternion.slerp(heading,1-Math.exp(-dt*5));
    // The auto-rig labelled the head/tail backwards. Reversing its cyclic
    // gait makes planted paws travel backwards relative to the visible muzzle.
    action.setEffectiveTimeScale(-state.speed/.5);
    action.setEffectiveWeight(T.MathUtils.smoothstep(state.speed,0,.15));
    mixer.update(dt);root.updateMatrixWorld(true);
    model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    let soleY=Infinity;
    for(const {mesh,index} of soleSamples)soleY=Math.min(soleY,mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld).y);
    facing.position.y+=state.position.y-soleY;root.updateMatrixWorld(true);
    root.userData.motion=state.speed>.015?'walking':'resting';root.userData.behavior=state.phase;
  }
  update(0);
  root.userData.animation='tripo-quadruped-walk';
  return {root,model,mixer,clip,action,behavior,update};
}
