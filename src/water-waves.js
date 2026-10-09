import * as THREE from 'three';

// Metre-scale waves shared by colour and depth/normal passes. Directions and
// periods are deliberately incommensurate, so no tiled diagonal wave grid forms.
export const WATER_SWELLS=[
  {d:[.91,.42],k:.28,a:.18,s:1.02},
  {d:[-.34,.94],k:.47,a:.10,s:1.34},
  {d:[.76,-.65],k:.73,a:.055,s:1.69},
];
export const waterWavesGLSL=/* glsl */`
  vec3 waterSwell(vec2 p,float t,float rain){
    vec3 result=vec3(0.);
    ${WATER_SWELLS.map(w=>`{
      vec2 d=normalize(vec2(${w.d.map(n=>n.toFixed(3)).join(',')}));
      float phase=dot(p,d)*${w.k.toFixed(3)}-t*${w.s.toFixed(3)};
      result.x+=sin(phase)*${w.a.toFixed(3)};
      result.yz+=d*cos(phase)*${(w.k*w.a).toFixed(5)};
    }`).join('\n')}
    return result*(1.+rain*.35);
  }
`;

export function sampleWaterSwell(x,z,t,rain=0){
  const result=[0,0,0];
  for(const {d,k,a,s} of WATER_SWELLS){
    const l=Math.hypot(...d),dx=d[0]/l,dz=d[1]/l,phase=(x*dx+z*dz)*k-t*s;
    result[0]+=Math.sin(phase)*a;result[1]+=dx*Math.cos(phase)*k*a;result[2]+=dz*Math.cos(phase)*k*a;
  }
  return result.map(v=>v*(1+rain*.35));
}

// GTAO and volumetric fog must see the displaced surface, not the original flat
// plane. Mobile renders the colour material directly and needs no override.
export function createWaterNormalMaterial(water){
  const material=new THREE.MeshNormalMaterial();material.allowOverride=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.waterTime=water.uniforms.time;shader.uniforms.waterRain=water.uniforms.dayWeatherRain;
    shader.vertexShader='uniform float waterTime,waterRain; varying vec2 swellSlope;\n'+waterWavesGLSL+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 waterWorld=modelMatrix*vec4(transformed,1.);
      vec3 swell=waterSwell(waterWorld.xz,waterTime,waterRain);
      waterWorld.y+=swell.x;swellSlope=swell.yz;
      vec4 mvPosition=viewMatrix*waterWorld;
      gl_Position=projectionMatrix*mvPosition;`);
    shader.fragmentShader='varying vec2 swellSlope;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
      normal=normalize(mat3(viewMatrix)*vec3(-swellSlope.x,1.,-swellSlope.y));`);
  };
  material.customProgramCacheKey=()=> 'water-swell-depth-v1';return material;
}
