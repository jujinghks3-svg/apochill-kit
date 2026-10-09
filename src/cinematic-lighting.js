import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { ART } from './art-direction.js';
import {SUN_TO_LIGHT} from './sun-direction.js';
import {daylight,dayUniforms} from './daylight-state.js';

export function createCinematicLighting(scene,camera,renderer,{mobile=false,quality=null}={}) {
  const hemisphere=new THREE.HemisphereLight(ART.skyLight,ART.groundLight,.95);
  scene.add(hemisphere);
  const direction=SUN_TO_LIGHT.clone().negate();
  const cascades=quality?.cascades??(mobile?1:3),shadowHz=quality?.shadowHz??12;
  const csm=new CSM({camera,parent:scene,cascades,maxFar:quality?.shadowFar??(mobile?120:340),mode:'custom',
    customSplitsCallback:(_count,_near,_far,breaks)=>breaks.push(...(cascades===1?[1]:cascades===2?[.32,1]:[.16,.46,1])),
    shadowMapSize:quality?.shadowSize??(mobile?1024:2048),lightDirection:direction,lightIntensity:daylight.intensity,
    shadowBias:-.000025,lightNear:1,lightFar:650,lightMargin:160});
  csm.fade=true;csm.updateFrustums();
  csm.lights.forEach((light,i)=>{light.color.set(ART.sun);light.shadow.normalBias=[.025,.07,.16][i];light.shadow.radius=2.2;});
  const configured=new Set();
  function setup(root) {
    root.traverse(object=>{
      for(const material of (Array.isArray(object.material)?object.material:[object.material])) {
        if(!material?.isMeshStandardMaterial || configured.has(material))continue;
        const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
        csm.setupMaterial(material);const shadows=material.onBeforeCompile;
        material.onBeforeCompile=function(shader,r){shadows.call(this,shader,r);previous.call(this,shader,r);};
        material.customProgramCacheKey=()=>`${key}-cascaded-daylight-v1`;
        material.needsUpdate=true;configured.add(material);
      }
    });
  }
  let dirty=true,timeDirty=false,lastShadowTime=-100;
  function setTimeOfDay({immediate=true}={}){
    direction.copy(dayUniforms.dayLightDirection.value).negate();csm.lightDirection.copy(direction);
    csm.lights.forEach(light=>{light.color.copy(daylight.sunColor);light.intensity=daylight.intensity;});
    hemisphere.color.copy(daylight.skyLight);hemisphere.groundColor.copy(daylight.groundLight);hemisphere.intensity=daylight.hemisphere;
    scene.fog.color.copy(daylight.fog);scene.background.copy(daylight.fog);timeDirty=true;
    if(immediate)dirty=true;
  }
  const lastPosition=new THREE.Vector3(Infinity,Infinity,Infinity),lastRotation=new THREE.Quaternion();
  return {csm,setup,direction,setTimeOfDay,invalidate:()=>{dirty=true;},
    resize:()=>{csm.updateFrustums();dirty=true;},
    update(time){
      const moved=lastPosition.distanceToSquared(camera.position)>.0025 || 1-Math.abs(lastRotation.dot(camera.quaternion))>.000001;
      if(dirty || ((moved||timeDirty)&&time-lastShadowTime>1/shadowHz)) {
        camera.updateMatrixWorld();csm.update();renderer.shadowMap.needsUpdate=true;
        lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastShadowTime=time;dirty=false;timeDirty=false;
      }
    },
    dispose(){csm.lights.forEach(light=>light.shadow.dispose());csm.remove();csm.dispose();scene.remove(hemisphere);configured.clear();},
  };
}
