import * as THREE from 'three';

// Display-sRGB centres measured by sample-concept-palette.mjs, not invented
// material albedos. The JSON beside the concept records regions and samples.
export const CONCEPT={
  exposure:1.16,
  sky:['#83b9e9','#9ecbf0','#c0d8ed'],cloud:['#d7e0e9','#f5f2ed'],
  grass:['#435221','#747c2d','#a1a43e','#c9c757'],
  tree:['#232f1e','#374931','#556437','#889348','#b6bb5b'],
  distant:['#617768','#9bad98','#c8cead'],
};
const inputInverse=new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.02840,.13383,.83777).invert();
const outputInverse=new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602).invert();

// Undo Three's ACES fit for unlit art colours (before bloom/grade/fog). Assigning
// the sampled display hex directly to a lit material would wash it out again.
export function conceptToneInput(hex){
  const c=new THREE.Color(hex),v=new THREE.Vector3(c.r,c.g,c.b).applyMatrix3(outputInverse);
  for(const channel of ['x','y','z']){
    const q=v[channel],a=1-.983729*q,b=.0245786-.432951*q,d=-.000090537-.238081*q;
    v[channel]=(-b+Math.sqrt(Math.max(0,b*b-4*a*d)))/(2*a);
  }
  v.applyMatrix3(inputInverse).multiplyScalar(.6/CONCEPT.exposure);
  return new THREE.Color().setRGB(Math.max(0,v.x),Math.max(0,v.y),Math.max(0,v.z));
}
export const conceptGLSL=hex=>`vec3(${conceptToneInput(hex).toArray().map(v=>v.toFixed(6)).join(',')})`;
export const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
