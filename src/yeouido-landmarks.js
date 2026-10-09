import {placeArchitecture} from './architecture-assets.js';

export const yeouidoSlots=[
];
// Keep the removed bridge-side landmark footprint clear of procedural infill.
export const bridgeSideClearing={x:-24,z:-122,w:19,d:19};

export async function loadYeouidoLandmarks(loader,baseUrl='/'){
 const ids=[...new Set(yeouidoSlots.map(s=>s.id))],catalog=new Map();
 const results=await Promise.allSettled(ids.map(async id=>{
  const gltf=await loader.loadAsync(`${baseUrl}buildings/${id}.glb`);
  // Keep highlights broad in the existing stylized lighting, preserving PBR maps.
  gltf.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(m.isMeshStandardMaterial){
     m.userData.glassFacade='masked';
     const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
     m.onBeforeCompile=(shader,renderer)=>{
      previous.call(m,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float coolGlazing=smoothstep(.005,.045,diffuseColor.b-diffuseColor.r)*smoothstep(.002,.025,diffuseColor.g-diffuseColor.r);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.45+vec3(.035,.055,.060),coolGlazing);
      `);
     };
     m.customProgramCacheKey=()=>key+'-lift-cool-glazing-v3-'+id;
     if(id==='seoul-silver-glass-office')m.normalScale?.setScalar(.42);
     m.roughness=.7;m.metalness=.12;}
  }});
  catalog.set(id,gltf.scene);
 }));
 const failures=ids.filter((_,i)=>results[i].status==='rejected');
 const placements=yeouidoSlots.filter(slot=>catalog.has(slot.id)).map(slot=>placeArchitecture(catalog.get(slot.id),slot));
 document.documentElement.dataset.yeouidoStatus=failures.length?'partial':'loaded';
 document.documentElement.dataset.yeouidoBuildings=String(placements.length);
 if(failures.length)console.warn('[Apochill] Yeouido assets unavailable:',failures.join(', '));
 return placements;
}
