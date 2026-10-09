import * as THREE from 'three';
import { meadowNoise, smooth } from './meadow-field.js';
import { grassGeometry, windMaterial, natureTime } from './painted-nature.js';
import {CONCEPT,hexRGB} from './concept-palette.js';

const FIELD={minX:-192,minZ:-280,width:384,depth:320};
const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

export function sampleWorldMeadow(x,z) {
  const broad=meadowNoise(x*.055+41,z*.055-17);
  const patch=meadowNoise(x*.29-8,z*.29+91);
  const coverage=smooth(.23,.69,broad*.58+patch*.42);
  return {coverage,tone:broad,fine:patch};
}

export function isWorldWater(x,z) {
  return (Math.abs(x)<311 && z>-153 && z<-105)
    || (x>-24.5 && x<-15.5 && z>-107 && z<-21);
}

// One compact world-space colour/coverage field joins terrain, roof caps and
// individual plants. It is a material layer, with no floating decal planes.
export function createWorldMeadowSurface() {
  const size=512,data=new Uint8Array(size*size*4);
  const base=hexRGB(CONCEPT.grass[0]),light=hexRGB(CONCEPT.grass[1]);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const wx=FIELD.minX+(x+.5)/size*FIELD.width,wz=FIELD.minZ+(y+.5)/size*FIELD.depth;
    const f=sampleWorldMeadow(wx,wz),i=(y*size+x)*4;
    const tone=f.tone*.7+f.fine*.3;
    for(let c=0;c<3;c++)data[i+c]=base[c]+(light[c]-base[c])*tone;
    data[i+3]=Math.round(f.coverage*255);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return (material,city=false)=>{
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.worldMeadowMap=texture;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.worldMeadowMap={value:texture};
      shader.uniforms.meadowWindTime=natureTime;
      const varyings='varying vec2 vWorldMeadowUv; varying float vMeadowUp;\n';
      shader.vertexShader=varyings+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 meadowPoint=vec4(transformed,1.);vec3 meadowNormal=normal;
        #ifdef USE_INSTANCING
          meadowPoint=instanceMatrix*meadowPoint;
          meadowNormal=mat3(instanceMatrix)*meadowNormal;
        #endif
        meadowPoint=modelMatrix*meadowPoint;
        vMeadowUp=normalize(mat3(modelMatrix)*meadowNormal).y;
        vWorldMeadowUv=(meadowPoint.xz-vec2(${FIELD.minX}.,${FIELD.minZ}.))/vec2(${FIELD.width}.,${FIELD.depth}.);`);
      shader.fragmentShader=varyings+'uniform sampler2D worldMeadowMap; uniform float meadowWindTime;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        vec4 fieldMeadow=texture2D(worldMeadowMap,vWorldMeadowUv);
        float fieldMask=fieldMeadow.a*smoothstep(.55,.85,vMeadowUp);
        ${city?'fieldMask*=step(.5,vGrowth.w);':''}
        vec2 fieldWorld=vWorldMeadowUv*vec2(${FIELD.width}.,${FIELD.depth}.)+vec2(${FIELD.minX}.,${FIELD.minZ}.);
        float fieldBreeze=sin(meadowWindTime*.75+fieldWorld.x*.42+fieldWorld.y*.3);
        fieldMeadow.rgb*=1.+fieldBreeze*.025;
        diffuseColor.rgb=mix(diffuseColor.rgb,fieldMeadow.rgb,fieldMask*.98);
        #include <roughnessmap_fragment>`);
    };
    material.customProgramCacheKey=()=>`${key}-world-meadow-v2-${city}`;
    return material;
  };
}

export function addWorldMeadow(world,{buildings,hillHeight}) {
  const random=seeded(993105),buckets=new Map(),stats={ground:0,hill:0,roofs:0};
  const add=(x,y,z,size,type)=>{
    const distance=Math.hypot(x-13,z-20),near=distance<95;
    // Frustum-cull districts separately; all geometry is instanced and opaque.
    const key=`${Math.floor(x/64)},${Math.floor(z/64)},${near?'near':'far'}`;
    if(!buckets.has(key))buckets.set(key,{near,points:[]});
    buckets.get(key).points.push({x,y,z,size,tone:sampleWorldMeadow(x,z).tone});stats[type]++;
  };
  const occupied=(x,z)=>buildings.some(b=>Math.abs(x-b.x)<b.w/2+.35 && Math.abs(z-b.z)<b.d/2+.35)
    || (Math.abs(x)<11 && Math.abs(z)<8)
    || [[-49,-57],[37,-76],[-75,-96],[27,-48]].some(([bx,bz])=>Math.abs(x-bx)<6&&Math.abs(z-bz)<6);
  // Low-detail tuft ribbons cover the river banks and abandoned street edges.
  for(let i=0;i<68000;i++) {
    const x=(random()-.5)*316,z=32-random()*278;
    if(isWorldWater(x,z)||occupied(x,z))continue;
    const hx=x+82,hz=z+198;
    if(Math.abs(hx)<56 && Math.abs(hz)<42)continue;
    const f=sampleWorldMeadow(x,z);
    if(random()>f.coverage*.66)continue;
    const streetDistance=Math.abs(((x+140)%14+14)%14-7);
    if(z>-102 && z<-20 && streetDistance<.9 && random()>.10)continue;
    // Outside the visible city, distant colour fields carry the grass impression.
    if(Math.hypot(x-13,z-20)>225)continue;
    add(x,-28.13,z,.55+random()*.62,'ground');
  }
  // Grass follows the same continuous terrain function as the hill surface.
  for(let i=0;i<13500;i++) {
    const hx=(random()-.5)*111,hz=(random()-.5)*83,x=hx-82,z=hz-198;
    if((Math.abs(hx)<4&&Math.abs(hz)<5)||occupied(x,z))continue;
    if(random()>sampleWorldMeadow(x,z).coverage*.83)continue;
    add(x,-28+hillHeight(hx,hz)+.07,z,.65+random()*.6,'hill');
  }
  for(const b of buildings) {
    if(!b.overgrown)continue;
    const distance=Math.hypot(b.x-13,b.z-20);
    const candidates=Math.ceil(b.w*b.d*(distance<100?7:distance<170?3.2:1.1));
    for(let i=0;i<candidates;i++) {
      const x=b.x+(random()-.5)*(b.w-.65),z=b.z+(random()-.5)*(b.d-.65);
      // Leave rooftop vents, utility boxes and the broken slab edge clear.
      if(Math.abs(x-(b.x-b.w*.15))<b.w*.21+.25 && Math.abs(z-b.z)<b.d*.19+.25)continue;
      if(Math.abs(x-(b.x+b.w*.26))<1.1 && Math.abs(z-b.z-1)<1.2)continue;
      if(random()>sampleWorldMeadow(x,z).coverage*.9)continue;
      add(x,b.roofY+.035,z,(distance<100?.42:.65)+random()*.48,'roofs');
    }
  }
  const geometries=[grassGeometry(4,2),grassGeometry(3,1)];
  const material=windMaterial('#ffffff',.16,true,true),transform=new THREE.Object3D(),tint=new THREE.Color();
  let triangles=0;
  for(const [key,bucket] of buckets) {
    const geometry=geometries[bucket.near?0:1];
    const mesh=new THREE.InstancedMesh(geometry,material,bucket.points.length);
    mesh.name=`world-meadow-${key}`;
    mesh.receiveShadow=true;
    bucket.points.forEach((p,i)=>{
      transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,random()*6.283,0);
      transform.scale.set(p.size*(bucket.near?1.2:1.7),p.size,p.size*(bucket.near?1.2:1.7));transform.updateMatrix();
      mesh.setMatrixAt(i,transform.matrix);
      const v=.91+p.tone*.12;tint.setRGB(v,v,v*.97);mesh.setColorAt(i,tint);
    });
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.4;
    world.add(mesh);triangles+=geometry.index.count/3*mesh.count;
  }
  stats.batches=buckets.size;stats.triangles=triangles;
  world.userData.worldMeadow=stats;
  if(import.meta.env?.DEV)console.info('[Apochill] World meadow:',JSON.stringify(stats));
  return stats;
}
