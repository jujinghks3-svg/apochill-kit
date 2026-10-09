import * as THREE from 'three';
import { MEADOW } from './meadow-field.js';

export function createMeadowGround() {
  document.documentElement.dataset.meadowTexture = 'loading';
  const texture = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/meadow-ground.png`,
    () => { document.documentElement.dataset.meadowTexture = 'loaded'; },
    undefined,
    (error) => {
      document.documentElement.dataset.meadowTexture = 'error';
      console.error('[Apochill] Meadow ground texture failed to load.', error);
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (material, seam = false) => {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey();
    // A named texture property also participates in the scene's HMR disposal.
    material.meadowMap = texture;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.meadowMap = { value: texture };
      shader.vertexShader = 'varying vec2 vMeadowUv;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vec4 meadowWorld = modelMatrix * vec4(transformed, 1.);
        vMeadowUv = vec2(meadowWorld.x / ${MEADOW.width}, -meadowWorld.z / ${MEADOW.depth}) + .5;
      `);
      shader.fragmentShader = 'varying vec2 vMeadowUv; uniform sampler2D meadowMap;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 meadow = texture2D(meadowMap, vMeadowUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, meadow.rgb * ${seam ? '.9' : '1.'}, meadow.a);
      `);
    };
    material.customProgramCacheKey = () => `${previousKey}-meadow-ground-v1-${seam}`;
    return material;
  };
}
