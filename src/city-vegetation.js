import * as THREE from 'three';
import {CONCEPT} from './concept-palette.js';
import { sampleCityGrowth } from './city-growth-field.js';

export function attachGrowthAttributes(geometry,parts) {
  const origins=[],sizes=[];
  for(const part of parts) {
    const b=part.growth;
    origins.push(b?.x??0,-28,b?.z??0);
    sizes.push(b?.w??1,b?.h??1,b?.d??1,b?.overgrown?b.variant+1:0);
  }
  geometry.setAttribute('growthOrigin',new THREE.InstancedBufferAttribute(new Float32Array(origins),3));
  geometry.setAttribute('growthSize',new THREE.InstancedBufferAttribute(new Float32Array(sizes),4));
}

export function createCityGrowthMaterials() {
  document.documentElement.dataset.cityGrowthTexture='loading';
  const texture=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/city-growth.png`,
    ()=>{document.documentElement.dataset.cityGrowthTexture='loaded';},undefined,
    error=>{document.documentElement.dataset.cityGrowthTexture='error';console.error('[Apochill] City growth texture failed to load.',error);});
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return (material)=>{
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.cityGrowthMap=texture;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.cityGrowthMap={value:texture};
      const varyings='varying vec4 vGrowth; varying vec3 vGrowthNormal;\n';
      shader.vertexShader='attribute vec3 growthOrigin; attribute vec4 growthSize;\n'+varyings+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`
        #include <worldpos_vertex>
        vec4 growthWorld=modelMatrix*instanceMatrix*vec4(transformed,1.);
        vGrowth=vec4((growthWorld.xyz-growthOrigin)/growthSize.xyz,growthSize.w);
        vGrowthNormal=objectNormal;
      `);
      shader.fragmentShader=varyings+'uniform sampler2D cityGrowthMap;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        if(vGrowth.w>.5) {
          vec3 axes=abs(vGrowthNormal);
          bool roof=axes.y>.65;
          vec2 uv=vec2(axes.x>axes.z?vGrowth.z:vGrowth.x,vGrowth.y)+vec2(.5,0.);
          if(roof)uv=vec2(vGrowth.x+.5,vGrowth.z+.5);
          float variant=vGrowth.w-1.;
          // Separate side-wall variant; a 2px inset prevents atlas colour bleed.
          if(!roof && axes.x>axes.z)variant=mod(variant+5.,16.);
          vec2 tile=vec2(mod(variant,4.),3.-floor(variant/4.));
          vec2 atlasUv=(tile+vec2(.016)+clamp(uv,0.,1.)*.968)/4.;
          vec4 growth=texture2D(cityGrowthMap,atlasUv);
          float valid=roof?1.:1.-smoothstep(1.01,1.04,vGrowth.y);
          float amount=growth.a*valid;
          if(roof)amount=mix(.18,.92,growth.a);
          diffuseColor.rgb=mix(diffuseColor.rgb,growth.rgb,amount*.96);
        }
      `);
    };
    material.customProgramCacheKey=()=>`${key}-city-growth-v1`;
    return material;
  };
}

function leafGeometry() {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,-.5,0,-.35,0,0,0,.1,.12,.35,0,0,0,.5,0],3));
  g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();
  const colors=[],root=new THREE.Color(CONCEPT.tree[2]),tip=new THREE.Color(CONCEPT.tree[4]);
  for(let i=0;i<5;i++) {
    const c=root.clone().lerp(tip,g.attributes.position.getY(i)+.5);colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}

export function addCityVegetation(world,buildings) {
  let seed=92811;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const districts=new Map();
  let near=0,mid=0,far=0;
  for(const b of buildings) {
    if(!b.overgrown)continue;
    // The bounded rooftop camera stays near the camp. Far blocks rely on the
    // material alone; no tiny transparent leaf cards or wind shaders are needed.
    const distance=Math.hypot(b.x-13,b.z-20);
    const isNear=distance<100;
    const count=isNear?128:distance<165?32:0;
    if(isNear)near++;else if(count)mid++;else far++;
    if(!count)continue;
    const key=`${b.x<0?'west':'east'},${b.z<-90?'back':'front'}`;
    if(!districts.has(key))districts.set(key,[]);
    const leaves=districts.get(key);
    for(let side=0;side<2;side++) {
      const variant=side?(b.variant+5)%16:b.variant;
      for(let attempt=0,placed=0;attempt<count*7 && placed<count;attempt++) {
        const u=.035+random()*.93,v=.06+random()*.91;
        if(sampleCityGrowth(u,v,variant).mask<.68)continue;
        const size=(isNear?.34:.62)+random()*.34;
        leaves.push({x:side?b.x+b.w/2+.12:b.x+(u-.5)*b.w,
          y:-28+v*b.h,z:side?b.z+(u-.5)*b.d:b.z+b.d/2+.12,
          size,side,tilt:(random()-.5)*.9});placed++;
      }
      // Leaves on the roof lip break the otherwise flat painted silhouette.
      for(let i=0;i<(isNear?28:10);i++) {
        const u=.035+random()*.93;
        if(sampleCityGrowth(u,.98,variant).mask<.5)continue;
        leaves.push({x:side?b.x+b.w/2+.08:b.x+(u-.5)*b.w,
          y:-28+b.h-.04,z:side?b.z+(u-.5)*b.d:b.z+b.d/2+.08,
          size:.45+random()*.32,side,tilt:(random()-.5)*1.3});
      }
    }
  }
  const geometry=leafGeometry();
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:THREE.DoubleSide});
  const transform=new THREE.Object3D();let count=0;
  for(const [district,leaves] of districts) {
    const mesh=new THREE.InstancedMesh(geometry,material,leaves.length);
    mesh.name=`city-ivy-district-${district}`;
    mesh.receiveShadow=true;
    leaves.forEach((p,i)=>{
      transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.side?Math.PI/2:0,p.tilt);
      transform.scale.set(p.size,p.size*1.3,p.size);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
    });
    mesh.computeBoundingBox();mesh.computeBoundingSphere();world.add(mesh);count+=leaves.length;
  }
  const stats={nearBuildings:near,midBuildings:mid,materialOnlyBuildings:far,leafInstances:count,leafTriangles:count*4,districts:districts.size};
  world.userData.cityVegetation=stats;
  if(import.meta.env?.DEV)console.info('[Apochill] City vegetation:',JSON.stringify(stats));
}
