import * as THREE from 'three';
import {CONCEPT} from './concept-palette.js';
import {dayUniforms,dayLightingGLSL} from './daylight-state.js';

// Shared art controls; detailed replacement assets can use this same lighting response.
export const ART = {
  exposure: CONCEPT.exposure, sun: '#fff2d6', skyLight: CONCEPT.sky[1], groundLight: CONCEPT.grass[1],
  fog: CONCEPT.sky[2], fogDensity: .00165,
};

export function paintMaterial(material) {
  if (!material.isMeshStandardMaterial || material.userData.painted) return material;
  material.userData.painted = true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms,dayUniforms);
    shader.fragmentShader=dayLightingGLSL+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      // Broad, soft light bands retain texture and real cast shadows.
      vec3 paintIrradiance = reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(.025));
      float paintLight = dot(paintIrradiance, vec3(.2126,.7152,.0722));
      float paintBand = .11 + .40*smoothstep(.12,.26,paintLight) + .43*smoothstep(.48,.72,paintLight);
      reflectedLight.directDiffuse *= mix(1., paintBand / max(paintLight,.06), .12);
      reflectedLight.indirectDiffuse *= vec3(.94,1.,1.07);
      reflectedLight.directSpecular *= .36;
    `);
  };
  material.customProgramCacheKey = () => `${previousKey}-painted-daylight-v7-shared-clouds`;
  material.needsUpdate = true;
  return material;
}

export function styleScene(root) {
  root.traverse((object) => {
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (material) paintMaterial(material);
    }
  });
}
