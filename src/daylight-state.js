import * as THREE from 'three';
import {CONCEPT,conceptToneInput} from './concept-palette.js';
import {SUN_TO_LIGHT} from './sun-direction.js';

// Art-directed clock, not astronomical Seoul/date simulation.
// Boost direct sunlight, blending back to the original soft moon key at dusk.
export const SUNLIGHT_MULTIPLIER=5.75/4.4;
const keys=[
  [0,.70,.85,0,'#b2c9ef','#657da3','#3e5145','#17243e','#304561','#34435e','#586581',[.16,.24,.38]],
  [5,.35,.70,0,'#abbaff','#7d87a4','#49534f','#354668','#8e7f8b','#685e79','#b49aaf',[.25,.30,.42]],
  [6,.65,.85,.3,'#ffc28a','#a6b1c4','#797a60','#708db3','#e9bdab','#a19dad','#edc2ac',[.65,.48,.39]],
  [8,3.4,.82,.9,'#ffe1b0','#a1c7e5','#747c2d','#86b7e0','#c8d9e7','#ccd6e0','#f8eedc',[1.02,.94,.80]],
  [12,4.4,.95,1,'#fff2d6',CONCEPT.sky[1],CONCEPT.grass[1],CONCEPT.sky[0],CONCEPT.sky[2],CONCEPT.cloud[0],CONCEPT.cloud[1],[1,1,1]],
  [16,3.5,.80,.9,'#ffe0a8','#a2c1dc','#747242','#82afd2','#d3d9d5','#c0c9d1','#f5e7cd',[1.08,.96,.78]],
  [18,1.3,.95,.42,'#ffab65','#b7b4c8','#8e7c66','#7286ad','#e9ae88','#a393a8','#f4c39d',[.87,.58,.42]],
  [19,.35,.75,.04,'#d1acb7','#8794b3','#566050','#425d89','#a58eaa','#687590','#b59eaf',[.36,.31,.42]],
  [20,.70,.85,0,'#b2c9ef','#657da3','#3e5145','#17243e','#304561','#34435e','#586581',[.16,.24,.38]],
  [24,.70,.85,0,'#b2c9ef','#657da3','#3e5145','#17243e','#304561','#34435e','#586581',[.16,.24,.38]],
];
const keyColors=keys.map(key=>({
  raw:key.slice(4,11).map(hex=>new THREE.Color(hex)),
  sky:key.slice(7,11).map(hex=>conceptToneInput(hex)),
  tint:new THREE.Color().setRGB(...key[11]),
}));
const moonDirection=new THREE.Vector3();
export const daylight={hour:12,intensity:4.4,hemisphere:.95,sunColor:new THREE.Color(),skyLight:new THREE.Color(),groundLight:new THREE.Color(),fog:new THREE.Color()};
export const dayUniforms={
  dayWetness:{value:0},dayPuddleFill:{value:0},
  daySunDirection:{value:SUN_TO_LIGHT.clone()},dayLightDirection:{value:SUN_TO_LIGHT.clone()},
  dayWeatherRain:{value:0},dayCloudCoverage:{value:.16},daySunStrength:{value:1},daySurfaceTint:{value:new THREE.Color(1,1,1)},
  daySkyTop:{value:new THREE.Color()},daySkyHorizon:{value:new THREE.Color()},
  dayCloudDark:{value:new THREE.Color()},dayCloudLight:{value:new THREE.Color()},
};
export const dayLightingGLSL='uniform vec3 daySunDirection,dayLightDirection,daySurfaceTint; uniform float daySunStrength,dayWetness;\n';
export function setDaylightHour(value){
  const hour=Number.isFinite(value)?THREE.MathUtils.clamp(value,0,24):12;
  const index=keys.findIndex((k,i)=>i<keys.length-1&&hour>=k[0]&&hour<=keys[i+1][0]);
  const a=keys[Math.max(0,index)],b=keys[Math.max(0,index)+1];
  const f=THREE.MathUtils.smoothstep(hour,a[0],b[0]);
  daylight.hour=hour;daylight.intensity=THREE.MathUtils.lerp(a[1],b[1],f);daylight.hemisphere=THREE.MathUtils.lerp(a[2],b[2],f);
  dayUniforms.daySunStrength.value=THREE.MathUtils.lerp(a[3],b[3],f);
  daylight.intensity*=THREE.MathUtils.lerp(1,SUNLIGHT_MULTIPLIER,
    THREE.MathUtils.smoothstep(dayUniforms.daySunStrength.value,.02,.30));
  const ac=keyColors[Math.max(0,index)],bc=keyColors[Math.max(0,index)+1];
  const mixColor=(target,i,calibrated=false)=>target.copy(calibrated?ac.sky[i-7]:ac.raw[i-4]).lerp(calibrated?bc.sky[i-7]:bc.raw[i-4],f);
  mixColor(daylight.sunColor,4);mixColor(daylight.skyLight,5);mixColor(daylight.groundLight,6);mixColor(daylight.fog,8);
  ['daySkyTop','daySkyHorizon','dayCloudDark','dayCloudLight'].forEach((name,i)=>mixColor(dayUniforms[name].value,i+7,true));
  dayUniforms.daySurfaceTint.value.copy(ac.tint).lerp(bc.tint,f);
  const elevation=Math.sin((hour-6)*Math.PI/12)*Math.asin(SUN_TO_LIGHT.y);
  const azimuth=Math.atan2(SUN_TO_LIGHT.x,SUN_TO_LIGHT.z)+(hour-12)*Math.PI/12;
  const sun=dayUniforms.daySunDirection.value.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
  const key=dayUniforms.dayLightDirection.value.copy(sun);
  key.y=Math.max(.07,key.y);
  const moon=moonDirection.copy(sun).negate();moon.y=Math.max(.18,moon.y);
  key.lerp(moon,1-THREE.MathUtils.smoothstep(dayUniforms.daySunStrength.value,.02,.30)).normalize();
  return daylight;
}
setDaylightHour(12);

export function applyDayTint(material){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);Object.assign(shader.uniforms,dayUniforms);
    shader.fragmentShader=dayLightingGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=daySurfaceTint;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>`${key}-day-tint-v1`;
}
