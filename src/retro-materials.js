import * as THREE from 'three';

// One original image atlas; planar world coordinates keep texel scale consistent
// on differently sized and instanced buildings without modifying their geometry.
export function createRetroMaterials() {
  const atlas = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/retro-atlas.png`,
    () => { document.documentElement.dataset.retroTextures = 'loaded'; },
    undefined,
    (error) => {
      document.documentElement.dataset.retroTextures = 'error';
      console.error('[Apochill] Retro texture atlas failed to load.', error);
    },
  );
  document.documentElement.dataset.retroTextures = 'loading';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.anisotropy = 4;
  const tiles = { concrete: [0, .5], brick: [.5, .5], asphalt: [0, 0], metal: [.5, 0] };

  return (color, tile = 'concrete', density = .22, extra = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, map: atlas, roughness: .95, flatShading: false, ...extra });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.retroTile = { value: new THREE.Vector2(...tiles[tile]) };
      shader.uniforms.retroDensity = { value: density };
      const varyings = 'varying vec3 vRetroPosition; varying vec3 vRetroNormal;\n';
      shader.vertexShader = varyings + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vec4 retroWorld=vec4(transformed,1.);
        vec3 retroNormal=objectNormal;
        #ifdef USE_INSTANCING
          retroWorld=instanceMatrix*retroWorld;
          retroNormal=mat3(instanceMatrix)*retroNormal;
        #endif
        vRetroPosition=(modelMatrix*retroWorld).xyz;
        vRetroNormal=normalize(mat3(modelMatrix)*retroNormal);
      `);
      shader.fragmentShader = varyings + 'uniform vec2 retroTile; uniform float retroDensity;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec3 retroAxis=abs(normalize(vRetroNormal));
        vec2 retroUv=vRetroPosition.xy;
        if(retroAxis.y>retroAxis.x && retroAxis.y>retroAxis.z) retroUv=vRetroPosition.xz;
        else if(retroAxis.x>retroAxis.z) retroUv=vRetroPosition.zy;
        // Inset each quadrant to avoid adjacent material colours leaking at its edges.
        vec2 retroTexel=fract(retroUv*retroDensity);
        vec2 retroAtlasUv=retroTile+vec2(.004)+retroTexel*.492;
        vec3 retroColor=texture2D(map,retroAtlasUv).rgb;
        diffuseColor.rgb*=mix(vec3(1.),retroColor,.17);
      `);
    };
    material.customProgramCacheKey = () => 'apochill-daylight-surfaces-v2';
    return material;
  };
}
