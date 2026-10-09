import {dayUniforms,dayLightingGLSL} from './daylight-state.js';

// Art-directed single-sun wrap lighting. Keep the painted palette, but give
// foliage a broad light/shade transition without harsh card self-shadowing.
// Shared by actual leaf geometry and the distant tree's reconstructed crown.
export const softFoliageGLSL=`
  ${dayLightingGLSL}
  vec3 foliageIrradiance(vec3 normalW,vec3 positionW){
    vec3 n=normalize(normalW);
    float wrap=clamp((dot(n,dayLightDirection)+.55)/1.55,0.,1.);
    float sky=clamp(n.y*.5+.5,0.,1.);
    vec3 tint=mix(vec3(.88,.96,1.08),vec3(1.07,1.025,.92),wrap);
    vec3 viewW=normalize(cameraPosition-positionW);
    float transmission=pow(max(dot(-viewW,dayLightDirection),0.),3.)
      *(1.-abs(dot(n,viewW)))*.10;
    vec3 wetHalf=normalize(viewW+dayLightDirection);
    float wetGlint=pow(max(dot(n,wetHalf),0.),24.)*dayWetness*.13;
    return (tint*(.62+.62*wrap+.08*sky)+vec3(1.,1.04,.74)*transmission)*(1.-dayWetness*.12)+vec3(wetGlint);
  }
`;

export function applySoftFoliageLighting(material,{upBias=0,strength=1}={}){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.userData.softFoliage=true;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    Object.assign(shader.uniforms,dayUniforms);
    shader.vertexShader='varying vec3 foliageNormalW; varying vec3 foliagePositionW;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec3 foliageN=normal;
      vec4 foliageP=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mat3 foliageInstance=mat3(instanceMatrix);
        foliageN/=vec3(dot(foliageInstance[0],foliageInstance[0]),dot(foliageInstance[1],foliageInstance[1]),dot(foliageInstance[2],foliageInstance[2]));
        foliageN=foliageInstance*foliageN;
        foliageP=instanceMatrix*foliageP;
      #endif
      mat3 foliageModel=mat3(modelMatrix);
      foliageN/=vec3(dot(foliageModel[0],foliageModel[0]),dot(foliageModel[1],foliageModel[1]),dot(foliageModel[2],foliageModel[2]));
      foliageNormalW=normalize(normalize(foliageModel*foliageN)+vec3(0.,${upBias.toFixed(3)},0.));
      foliagePositionW=(modelMatrix*foliageP).xyz;
    `);
    shader.fragmentShader='varying vec3 foliageNormalW; varying vec3 foliagePositionW;\n'+softFoliageGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      outgoingLight*=mix(vec3(1.),foliageIrradiance(foliageNormalW,foliagePositionW),${strength.toFixed(3)})*daySurfaceTint;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=>`${key}-soft-wrap-foliage-v2-wet-${upBias}-${strength}`;
  return material;
}
