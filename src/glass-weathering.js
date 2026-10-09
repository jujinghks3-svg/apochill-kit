import {weatherTexture} from './surface-weathering.js';

// Continuous texture sampling, never coplanar dirt cards or diagonal crack lines.
export function glassWeathering(material){
  if(material.userData.glassWeathering)return material;
  material.userData.glassWeathering=true;material.glassDirtMap=weatherTexture();
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(s,r)=>{
    previous.call(material,s,r);s.uniforms.glassDirtMap={value:material.glassDirtMap};
    s.vertexShader='varying vec3 glassWearWorld;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 glassWearP=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        glassWearP=instanceMatrix*glassWearP;
      #endif
      glassWearWorld=(modelMatrix*glassWearP).xyz;`);
    s.fragmentShader='varying vec3 glassWearWorld;uniform sampler2D glassDirtMap;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float glassWearAlong=glassWearWorld.x*.71+glassWearWorld.z*.63;
      float glassRunoff=texture2D(glassDirtMap,vec2(glassWearAlong*.28,glassWearWorld.y*.012)).a;
      float glassDust=texture2D(glassDirtMap,glassWearWorld.xz*.025+glassWearWorld.y*.007).r;
      float glassDirt=clamp(glassRunoff*.32+smoothstep(.48,.76,glassDust)*.25,0.,.55);
      // Mineral haze and brown rain deposits, leaving most glazing reflective.
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,.82,.72)+vec3(.025,.024,.017),glassDirt);
    `);
  };
  material.customProgramCacheKey=()=>`${key}-glass-runoff-mineral-v1`;return material;
}
