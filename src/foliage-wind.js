import {natureTime} from './painted-nature.js';
import {dayUniforms} from './daylight-state.js';

// Same clock and prevailing direction as the meadow. All passes share this
// deformation; no per-frame geometry uploads or additional draw calls.
export const foliageWindGLSL=`
  uniform float foliageWindTime, foliageWindRain;
  float foliageGust(vec3 p){
    return sin(foliageWindTime*.75+p.x*.42+p.z*.30)
      +.22*sin(foliageWindTime*1.17+p.x*.13-p.z*.17);
  }
`;
export function bindFoliageWind(shader){
  shader.uniforms.foliageWindTime=natureTime;
  shader.uniforms.foliageWindRain=dayUniforms.dayWeatherRain;
  shader.vertexShader=foliageWindGLSL+shader.vertexShader;
}

export function patchLeafWind(shader){
  bindFoliageWind(shader);
  shader.vertexShader='attribute float leafWindSize;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    mat4 leafWindMatrix=modelMatrix;
    #ifdef USE_INSTANCING
      leafWindMatrix=modelMatrix*instanceMatrix;
    #endif
    vec3 leafWindWorld=(leafWindMatrix*vec4(position,1.)).xyz;
    float leafRoot=clamp(uv.y,0.,1.);
    float leafFlutter=sin(foliageWindTime*3.1+leafWindWorld.x*2.3+leafWindWorld.y*3.7+leafWindWorld.z*1.8);
    float leafAmplitude=min(.16,leafWindSize*length(leafWindMatrix[1].xyz)*.10)
      *leafRoot*leafRoot*(1.+.45*clamp(foliageWindRain,0.,1.));
    vec3 leafShift=vec3(foliageGust(leafWindWorld)+.20*leafFlutter,.16*leafFlutter,.30*foliageGust(leafWindWorld))*leafAmplitude;
    // Inverse rotation/scale for orthogonal tree transforms (including the
    // slightly narrower rooftop crowns). UV=0 attachment points stay pinned.
    transformed+=vec3(
      dot(leafWindMatrix[0].xyz,leafShift)/dot(leafWindMatrix[0].xyz,leafWindMatrix[0].xyz),
      dot(leafWindMatrix[1].xyz,leafShift)/dot(leafWindMatrix[1].xyz,leafWindMatrix[1].xyz),
      dot(leafWindMatrix[2].xyz,leafShift)/dot(leafWindMatrix[2].xyz,leafWindMatrix[2].xyz));
  `);
}

export function applyLeafWind(material){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.userData.vertexDeform=patchLeafWind;
  material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);patchLeafWind(shader);};
  material.customProgramCacheKey=()=>`${key}-anchored-leaf-wind-v1`;
  return material;
}

export function expandLeafWindBounds(geometry){
  const sizes=geometry.getAttribute('leafWindSize');
  let maxSize=0;
  for(let i=0;i<(sizes?.count??0);i++)maxSize=Math.max(maxSize,sizes.getX(i));
  // Covers maximum gust + flutter + rain, including the facade's .87 X scale.
  const padding=maxSize*.26;
  geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(padding);
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=padding;
  return geometry;
}
