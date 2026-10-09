import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createRoamingShiba} from './shiba-roaming.js';
import {createCampKitchen,addLaptopDisplay} from './camp-expansion.js';
import {placeTripoDogHouse} from './tripo-dog-house.js';
import {batchStaticScene} from './static-batching.js';

const v=()=>new T.Vector3();
export const SURVIVOR_IDLE_SECONDS=32;
function aim(bone,child,target){
  const p=bone.getWorldPosition(v()),direction=child.getWorldPosition(v()).sub(p).normalize();
  const desired=target.clone().sub(p).normalize();
  const rotation=new T.Quaternion().setFromUnitVectors(direction,desired).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  bone.updateWorldMatrix(false,true);
}
export function solveLimb(upper,lower,end,target,pole){
  const a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=end.getWorldPosition(v());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),d=T.MathUtils.clamp(a.distanceTo(target),Math.abs(l1-l2)+.0001,l1+l2-.0001);
  const direction=target.clone().sub(a).normalize(),perp=pole.clone().sub(a);
  perp.addScaledVector(direction,-perp.dot(direction));
  if(perp.lengthSq()<1e-8)perp.set(0,0,1).addScaledVector(direction,-direction.z);
  perp.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbow=a.clone().addScaledVector(direction,along).addScaledVector(perp,height);
  aim(upper,lower,elbow);aim(lower,end,a.clone().addScaledVector(direction,d));
}
function orientWorld(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}

// Pose in a +Z-forward frame; the P1 source looks along +X.
export function createSeatedSurvivor(gltf,{position=[.1,0,-.45],yaw=Math.PI/2-.12}={}){
  const root=new T.Group();root.name='replaceable-survivor';root.position.fromArray(position);root.rotation.y=yaw+Math.PI/2;
  const model=clone(gltf.scene);model.rotation.y=-Math.PI/2;root.add(model);
  const box=new T.Box3().setFromObject(model);model.scale.multiplyScalar(2.6/box.getSize(v()).y);
  root.updateMatrixWorld(true);
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  for(const name of ['Hips','Head','Spine','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'])if(!bones[name])throw Error(`Rig missing ${name}`);
  const hipLocal=root.worldToLocal(bones.Hips.getWorldPosition(v()));
  // The occupied chair is fitted to the survivor; pelvis includes body thickness.
  const shift=new T.Vector3(0,1.02,.15).sub(hipLocal);
  // model.position is expressed in root's canonical frame.
  model.position.add(shift);root.updateMatrixWorld(true);
  const rest=new Map(Object.values(bones).map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone()}]));
  const neutralFeet=['LeftFoot','RightFoot'].map(n=>bones[n].getWorldQuaternion(new T.Quaternion()));
  const neutralHands=['LeftHand','RightHand'].map(n=>bones[n].getWorldQuaternion(new T.Quaternion()));
  neutralHands.forEach((q,i)=>q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i===0?-Math.PI/2:Math.PI/2)));
  const anchor=new T.Object3D();anchor.name='survivor-status-anchor';root.add(anchor);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const toWorld=xyz=>root.localToWorld(new T.Vector3(...xyz));
  function update(seconds){
    for(const [b,r] of rest){b.position.copy(r.p);b.quaternion.copy(r.q);}
    const phase=seconds*Math.PI*2/8;
    const cycle=T.MathUtils.euclideanModulo(seconds,SURVIVOR_IDLE_SECONDS);
    const envelope=(start,end)=>T.MathUtils.smoothstep(cycle,start,start+1.5)*(1-T.MathUtils.smoothstep(cycle,end-1.5,end));
    const looking=envelope(8,14),thinking=envelope(15,22),resting=envelope(22,32);
    const breath=Math.sin(phase*2)*.009;
    // Tiny spine motion; stable pelvis and foot contacts throughout the loop.
    root.updateMatrixWorld(true);
    const leanAxis=new T.Vector3(1,0,0).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));
    orientWorld(bones.Spine,new T.Quaternion().setFromAxisAngle(leanAxis,T.MathUtils.lerp(.28,-.35,resting)+breath).multiply(bones.Spine.getWorldQuaternion(new T.Quaternion())));
    const headRest=bones.Head.getWorldQuaternion(new T.Quaternion());
    const headYaw=looking*Math.sin((cycle-8)*.7)*.38;
    const headPitch=thinking*-.12+looking*-.05+resting*.16;
    orientWorld(bones.Head,new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),headYaw)
      .multiply(new T.Quaternion().setFromAxisAngle(leanAxis,headPitch)).multiply(headRest));
    for(let i=0;i<2;i++){
      const side=i===0?'Left':'Right',sign=i===0?1:-1;
      solveLimb(bones[side+'UpLeg'],bones[side+'Leg'],bones[side+'Foot'],toWorld([sign*.235,.20,.78]),toWorld([sign*.28,1.0,1.8]));
      orientWorld(bones[side+'Foot'],neutralFeet[i]);
      const tap=(Math.sin(phase*10+i*2.6)*.012+Math.sin(phase*17+i)*.004)*(1-thinking)*(1-looking)*(1-resting);
      const hand=new T.Vector3(sign*.24,1.24+tap,.57);
      // Bring the right hand beside the beard, without translating the pelvis or feet.
      if(i===1)hand.lerp(new T.Vector3(-.14,1.69,.28),thinking);
      // Release the keyboard and rest both hands over the thighs while the
      // upper body reclines against the chair; keep pelvis and feet planted.
      hand.lerp(new T.Vector3(sign*.28,1.18,.17),resting);
      solveLimb(bones[side+'Arm'],bones[side+'ForeArm'],bones[side+'Hand'],toWorld(hand.toArray()),toWorld([sign*.80,1.34,.28]));
      // Palms face down and fingers point toward the laptop screen.
      const handRotation=neutralHands[i].clone();
      if(i===1)handRotation.premultiply(new T.Quaternion().setFromAxisAngle(leanAxis,-1.25*thinking));
      orientWorld(bones[side+'Hand'],handRotation);
    }
    root.updateMatrixWorld(true);
    const head=root.worldToLocal(bones.Head.getWorldPosition(v()));anchor.position.copy(head).add(new T.Vector3(0,1.02,0));
    root.userData.idleState=resting>.1?'resting':thinking>.1?'thinking':looking>.1?'looking':'typing';
  }
  update(0);
  root.userData.animation='local-seated-typing-look-think-rest-IK';
  return {root,model,bones,anchor,update,toWorld};
}

function normalizeProp(source,{width,height,yaw=0}){
  const root=new T.Group(),model=source.clone(true);root.add(model);root.rotation.y=yaw;
  let box=new T.Box3().setFromObject(root),size=box.getSize(v());
  const scale=height?height/size.y:width/Math.max(size.x,size.z);model.scale.setScalar(scale);
  box=new T.Box3().setFromObject(root);const center=box.getCenter(v());
  // Move in the model's parent coordinates before applying root's rotation.
  const shift=new T.Vector3(-center.x,-box.min.y,-center.z).applyAxisAngle(new T.Vector3(0,1,0),-yaw);
  model.position.copy(shift);root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;
}
export function assembleCompanions(assets){
  const survivor=createSeatedSurvivor(assets.character);
  let desk;
  if(assets.desk){
    desk=normalizeProp(assets.desk.scene,{width:1.72,yaw:Math.PI/2});
    const height=new T.Box3().setFromObject(desk).getSize(v()).y;
    desk.scale.y=1.025/height;desk.position.set(0,.09,.91);desk.name='survivor-laptop-desk';
    survivor.root.add(desk);
  }
  const laptop=normalizeProp(assets.laptop.scene,{width:.88,yaw:Math.PI/2});
  laptop.name='survivor-laptop';laptop.position.set(0,1.12,.71);survivor.root.add(laptop);
  addLaptopDisplay(survivor.root);
  const roaming=assets.shiba.animations?.length?createRoamingShiba(assets.shiba):null;
  const dog=roaming?.root??normalizeProp(assets.shiba.scene,{height:.85,yaw:-.65});dog.name='replaceable-shiba';
  if(!roaming)dog.position.set(1.9,.09,2.0);
  const update=seconds=>{survivor.update(seconds);roaming?.update(seconds);};
  const dispose=()=>{
    if(roaming){roaming.mixer.stopAllAction();roaming.mixer.uncacheRoot(roaming.model);}
    const skeletons=new Set();
    for(const object of [survivor.root,dog])object.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
    for(const skeleton of skeletons)skeleton.dispose();
  };
  return {...survivor,laptop,desk,dog,roaming,update,dispose};
}
export async function loadRooftopCompanions(loader,world,base='/'){
  const assets={};
  for(const [id,file] of [['character','character-rigged'],['shiba','shiba-walk'],['laptop','laptop']]){
    assets[id]=await loader.loadAsync(`${base}companions/${file}.glb`);
  }
  assets.desk=await loader.loadAsync(`${base}props/wooden-camp-table.glb`);
  const dogHouse=placeTripoDogHouse((await loader.loadAsync(`${base}props/dog-house-tripo.glb`)).scene);
  const companions=assembleCompanions(assets);world.add(companions.root,companions.dog);
  const campDetails=new T.Group();campDetails.name='camp-additional-props';
  campDetails.add(dogHouse,createCampKitchen());batchStaticScene(campDetails);world.add(campDetails);
  return companions;
}
