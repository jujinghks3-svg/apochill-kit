import * as T from 'three';
import {DOG_HOME} from './camp-expansion.js';

// Doorway is approached straight-on along X, so the body fits through the
// opening before it turns around inside. Do not jump to a random destination.
const entrance=new T.CatmullRomCurve3([[1.65,4.1],[1.66,4.7],[1.4,5],[.85,5],[.25,5],[-.15,5]].map(([x,z])=>new T.Vector3(x,.09,z)),false,'centripetal');
entrance.arcLengthDivisions=300;entrance.updateArcLengths();
const travelSeconds=entrance.getLength()*1.5/.32;
export function createShibaBehavior({sampleRoute,lapSeconds,random=Math.random}){
  let phase='roaming',elapsed=0,misses=0,restSeconds=0;
  function travel(outward){
    const f=T.MathUtils.clamp(elapsed/travelSeconds,0,1),s=f*f*(3-2*f),u=outward?1-s:s;
    const position=entrance.getPointAt(u),direction=entrance.getTangentAt(u).multiplyScalar(outward?-1:1);
    // Short entrance ramp and a soft bed lift, matching physical floor pieces.
    position.y=T.MathUtils.lerp(DOG_HOME.y,DOG_HOME.bedY,1-T.MathUtils.smoothstep(position.x,DOG_HOME.doorX-.55,DOG_HOME.doorX+.24));
    return {position,yaw:Math.atan2(direction.x,direction.z),speed:entrance.getLength()*6*f*(1-f)/travelSeconds,phase};
  }
  function update(dt){
    elapsed+=Math.max(0,dt);
    if(phase==='roaming'&&elapsed>=lapSeconds){
      elapsed%=lapSeconds;
      if(random()<.65||misses>=2){phase='entering';elapsed=0;misses=0;restSeconds=14+random()*18;}else misses++;
    }else if(phase==='entering'&&elapsed>=travelSeconds){phase='home-rest';elapsed=0;}
    else if(phase==='home-rest'&&elapsed>=restSeconds){phase='exiting';elapsed=0;}
    else if(phase==='exiting'&&elapsed>=travelSeconds){phase='roaming';elapsed=0;}
    if(phase==='roaming')return {...sampleRoute(elapsed),phase};
    if(phase==='entering'||phase==='exiting')return travel(phase==='exiting');
    return {position:new T.Vector3(DOG_HOME.x,DOG_HOME.bedY,DOG_HOME.z),yaw:Math.PI/2,speed:0,phase};
  }
  return {update,get phase(){return phase;}};
}
