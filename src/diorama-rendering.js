import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { VolumetricFogPass } from './volumetric-fog.js';
import { createMobileSunlight, sunlightShader, sunlightUpdater } from './sunlight-post.js';
import {createWaterNormalMaterial} from './water-waves.js';
import {createWaterReflection} from './water-reflection.js';

export function createDioramaRendering(renderer,scene,camera,lighting,{mobile=false,quality=null}={}) {
  const base=quality?.id==='medium'?createMediumRendering(renderer,scene,camera,lighting):createBaseRendering(renderer,scene,camera,lighting,{mobile});
  // Recovery/mobile mode keeps the procedural sky reflection without a second city render.
  const reflection=mobile?{resize(){},update(){},dispose(){}}:createWaterReflection(renderer,scene,camera,{mobile,quality});
  return {
    resize(){base.resize();reflection.resize();},
    setPixelation:base.setPixelation,
    render(time=0){renderer.info.reset();reflection.update(time);base.render(time);},
    dispose(){reflection.dispose();base.dispose();},
  };
}

// Medium omits the entire normal/depth/AO/volumetric pipeline, not just its
// final blend. Scene fog remains; modest bloom and planar reflections survive.
function createMediumRendering(renderer,scene,camera,lighting){
  const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:0}));
  const base=new RenderPass(scene,camera),bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.28,.5,1.35);
  const output=new OutputPass(),aa=new ShaderPass(FXAAShader),grade=new ShaderPass(sunlightShader());
  const updateSun=sunlightUpdater(grade.uniforms,camera,lighting);
  const passes=[base,bloom,output,aa,grade];passes.forEach(p=>composer.addPass(p));
  const resize=()=>{
    const size=renderer.getSize(new THREE.Vector2()),dpr=renderer.getPixelRatio();
    composer.setPixelRatio(dpr);composer.setSize(size.x,size.y);
    grade.uniforms.texel.value.set(1/(size.x*dpr),1/(size.y*dpr));aa.uniforms.resolution.value.copy(grade.uniforms.texel.value);
    grade.uniforms.pixelGrid.value.set(Math.max(1,Math.round(size.x/3)),Math.max(1,Math.round(size.y/3)));
  };
  resize();renderer.info.autoReset=false;
  return {resize,setPixelation(enabled){grade.uniforms.pixelEnabled.value=Boolean(enabled);},
    render(){updateSun();composer.render();},dispose(){passes.forEach(p=>p.dispose());composer.dispose();}};
}

function createBaseRendering(renderer,scene,camera,lighting,{mobile=false}={}) {
  if(mobile)return createMobileSunlight(renderer,scene,camera,lighting);
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:0});
  const composer=new EffectComposer(renderer,target);
  const base=new RenderPass(scene,camera);
  const contact=new GTAOPass(scene,camera,1,1);
  // Packed normals and the 0/1 foliage mask fit RGBA8. Keep full-resolution
  // depth edges without paying for a full-resolution HDR normal buffer.
  contact.normalRenderTarget.texture.type=THREE.UnsignedByteType;
  // GTAO's default scene override ignores alpha cutouts. Preserve the leaf
  // silhouette in both its normals and depth (also consumed by volumetric fog).
  const leafNormals=new Map(),cutoutObjects=[];
  scene.traverse(object=>{
    const material=object.material;
    if(!object.isMesh||!material?.map||!material.alphaTest)return;
    if(!leafNormals.has(material)){
      const normal=new THREE.MeshNormalMaterial({side:material.side});normal.allowOverride=false;
      normal.onBeforeCompile=shader=>{
        material.userData.billboard?.(shader);
        material.userData.vertexDeform?.(shader);
        shader.uniforms.leafCutout={value:material.map};
        shader.vertexShader='varying vec2 leafCutoutUv;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nleafCutoutUv=${material.userData.billboard?'vec2((uv.x+treeVariant)*.25,uv.y)':'uv'};`);
        shader.fragmentShader='uniform sampler2D leafCutout; varying vec2 leafCutoutUv;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('void main() {',`void main() {
          if(texture2D(leafCutout,leafCutoutUv).a<${material.alphaTest.toFixed(3)})discard;`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= gl_FrontFacing ? 1. : -1.;');
        if(material.userData.softFoliage)shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/, 'gl_FragColor.a=0.;\n}');
      };
      normal.customProgramCacheKey=()=>`cutout-normal-${material.alphaTest}-${Boolean(material.userData.billboard)}-${Boolean(material.userData.softFoliage)}-${Boolean(material.userData.vertexDeform)}-wind-v1`;leafNormals.set(material,normal);
    }
    cutoutObjects.push({object,material,normal:leafNormals.get(material)});
  });
  const renderNormalOverride=contact._renderOverride.bind(contact);
  const water=scene.getObjectByName('han-river');
  const waterMaterial=water?.material,waterNormal=water?createWaterNormalMaterial(waterMaterial):null;
  const sky=scene.getObjectByName('painted-sky');
  const transparentSurfaces=[];
  scene.traverse(o=>{if(o.material?.transparent&&!o.material.depthWrite)transparentSurfaces.push(o);});
  contact._renderOverride=(...args)=>{
    const skyVisible=sky?.visible;
    const surfaceVisibility=transparentSurfaces.map(o=>o.visible);
    transparentSurfaces.forEach(o=>{o.visible=false;});
    if(sky)sky.visible=false;
    cutoutObjects.forEach(p=>{p.object.material=p.normal;});
    if(water)water.material=waterNormal;
    try{return renderNormalOverride(...args);}
    finally{cutoutObjects.forEach(p=>{p.object.material=p.material;});if(sky)sky.visible=skyVisible;
      if(water)water.material=waterMaterial;
      transparentSurfaces.forEach((o,i)=>{o.visible=surfaceVisibility[i];});}
  };
  // Soft-lit cards retain depth for fog/occlusion. Suppress screen-space AO
  // on the cards so overlapping alpha planes do not form hard dark patches.
  contact.blendMaterial.uniforms.unlitMask={value:contact.normalRenderTarget.texture};
  Object.assign(contact.blendMaterial.uniforms,{
    facadeDepth:{value:contact.depthTexture},aoSize:{value:new THREE.Vector2(1,1)},
    facadeNearFar:{value:new THREE.Vector2(camera.near,camera.far)},
  });
  contact.blendMaterial.fragmentShader=`uniform sampler2D unlitMask,facadeDepth;
    uniform vec2 aoSize,facadeNearFar;
    float facadeDistance(vec2 uv){float d=texture2D(facadeDepth,uv).x;return facadeNearFar.x*facadeNearFar.y/(facadeNearFar.y-d*(facadeNearFar.y-facadeNearFar.x));}
    `+contact.blendMaterial.fragmentShader;
  contact.blendMaterial.fragmentShader=contact.blendMaterial.fragmentShader.replace(
    'texel.rgb, intensity)',
    'texel.rgb, intensity*texture2D(unlitMask,vUv).a*exp(-abs(facadeDistance(vUv)-facadeDistance((floor(vUv*aoSize)+.5)/aoSize))*1.5))');
  contact.updateGtaoMaterial({radius:1.15,distanceExponent:1.35,thickness:.8,scale:1,samples:12});
  contact.updatePdMaterial({radius:5,rings:2,samples:12});
  contact.blendIntensity=.46;
  const fog=new VolumetricFogPass(camera,contact.depthTexture,lighting);
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.55,.75,1.05);
  // Painted white clouds are art colours, not luminous surfaces. Reuse the
  // existing depth buffer to keep their HDR calibration out of bloom extraction.
  bloom.highPassUniforms.sceneDepth={value:contact.depthTexture};
  bloom.materialHighPassFilter.fragmentShader='uniform sampler2D sceneDepth;\n'+bloom.materialHighPassFilter.fragmentShader;
  bloom.materialHighPassFilter.fragmentShader=bloom.materialHighPassFilter.fragmentShader.replace(
    'float v = luminance( texel.xyz );','float v = luminance( texel.xyz );\nif(texture2D(sceneDepth,vUv).x>.9999)texel.rgb=vec3(0.);');
  const output=new OutputPass();
  const antialias=new ShaderPass(FXAAShader);
  const grade=new ShaderPass(sunlightShader());
  grade.uniforms.sceneDepth.value=contact.depthTexture;
  grade.uniforms.hasDepth.value=true;
  const updateSun=sunlightUpdater(grade.uniforms,camera,lighting);
  composer.addPass(base);composer.addPass(contact);composer.addPass(fog);composer.addPass(bloom);composer.addPass(output);composer.addPass(antialias);composer.addPass(grade);
  const resize=()=>{
    const size=renderer.getSize(new THREE.Vector2());const dpr=renderer.getPixelRatio();
    composer.setPixelRatio(dpr);composer.setSize(size.x,size.y);
    // setSize also shrinks the depth/normal buffer. Restore that buffer to the
    // colour resolution so thin facades do not acquire a second fog silhouette.
    // AO and its denoiser remain half-resolution; the global pixel cap still applies.
    contact.setSize(Math.max(1,Math.floor(size.x*dpr*.5)),Math.max(1,Math.floor(size.y*dpr*.5)));
    contact.normalRenderTarget.setSize(Math.floor(size.x*dpr),Math.floor(size.y*dpr));
    contact.blendMaterial.uniforms.aoSize.value.set(contact.width,contact.height);
    grade.uniforms.texel.value.set(1/(size.x*dpr),1/(size.y*dpr));
    antialias.uniforms.resolution.value.copy(grade.uniforms.texel.value);
    grade.uniforms.pixelGrid.value.set(Math.max(1,Math.round(size.x/3)),Math.max(1,Math.round(size.y/3)));
  };
  resize();renderer.info.autoReset=false;
  return {resize,setPixelation(enabled){grade.uniforms.pixelEnabled.value=Boolean(enabled);},render:(time=0)=>{fog.fog.uniforms.fogTime.value=time;updateSun();composer.render();},
    dispose:()=>{leafNormals.forEach(m=>m.dispose());waterNormal?.dispose();base.dispose();contact.dispose();fog.dispose();bloom.dispose();output.dispose();antialias.dispose();grade.dispose();composer.dispose();}};
}
