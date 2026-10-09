import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CONCEPT,conceptGLSL} from './concept-palette.js';
import {applySoftFoliageLighting} from './soft-foliage-lighting.js';
import {ivySurfaceProjector} from './ivy-surface.js';

let material;
export const ivyRandom=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export function ivyMaterial(){
  if(material)return material;
  document.documentElement.dataset.ivyTexture='loading';
  const map=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/ivy-leaf-atlas-v1.png`,
    ()=>{document.documentElement.dataset.ivyTexture='loaded';},undefined,
    error=>{document.documentElement.dataset.ivyTexture='error';console.error('[Apochill] Ivy texture failed',error);});
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  material=new THREE.MeshBasicMaterial({map,color:'#ffffff',vertexColors:true,alphaTest:.38,
    side:THREE.DoubleSide,fog:true,depthWrite:true});
  material.name='soft-lit-ivy-image-cutouts';
  // The generated atlas contains baked dark green. Retain its veins/alpha,
  // but remap that luminance to the calibrated greens before soft lighting.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float ivyTone=smoothstep(.04,.60,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      diffuseColor.rgb=mix(${conceptGLSL(CONCEPT.tree[2])},${conceptGLSL(CONCEPT.tree[3])},.08+ivyTone*.92)*(.84+ivyTone*.24);
      // Three's following color_fragment applies the continuous vertex gradient.
    `);
  };
  material.customProgramCacheKey=()=> 'ivy-concept-green-v5-rounded-clusters';
  applySoftFoliageLighting(material,{upBias:.28});
  return material;
}

// Follow each wall's own outward normal. Every ribbon keeps its leaf image
// upright along the hanging stem, including the camp's right-hand facade.
export function ivyRibbon(points,width=.6,seed=0,normal=new THREE.Vector3(0,0,1),surface=null){
  if(points.length<2)return null;
  const curve=new THREE.CatmullRomCurve3(points),length=curve.getLength(),random=ivyRandom(seed),pieces=[];
  if(length<.02)return null;
  const project=surface?ivySurfaceProjector(surface,normal):null;
  // Unequal image lengths, independent atlas picks, mirroring and lobe widths
  // break the old identical four-tile chain without adding texture variants.
  let start=0,card=0;
  while(start<1){
    const span=Math.min(1-start,width*(1.25+random()*1.9)/length),end=start+span;
    const variant=Math.floor(random()*4),col=variant%2,row=Math.floor(variant/2),mirror=random()<.5;
    const spread=.65+random()*.8,phase=random()*6.28;
    const positions=[],uv=[],colours=[],indices=[],attached=[];
    const colour=new THREE.Color().setScalar(.94+random()*.06);
    for(let band=0;band<=4;band++){
      const t=band/4,at=THREE.MathUtils.clamp(start+t*span*1.07,0,1);
      const center=curve.getPointAt(at),up=curve.getTangentAt(at).negate();
      const right=new THREE.Vector3().crossVectors(up,normal).normalize();
      const taper=(1-.42*at)*spread*(.9+.16*Math.sin(t*4.5+phase));
      center.addScaledVector(right,Math.sin(t*3.2+phase)*width*.10);
      for(const side of [-1,0,1]){
        const p=center.clone().addScaledVector(right,side*width*.85*taper);
        const hit=project?.(p,.016+(card%3)*.002);
        attached.push(!project||!!hit);
        if(hit)p.copy(hit);
        positions.push(...p.toArray());
        uv.push((col+.52+side*(mirror?-.34:.34))*.5,(1-row+(1-t)*.96+.02)*.5);
        const light=1-at;
        const volume=(1-Math.abs(side)*.24)*(.86+.14*Math.sin(t*Math.PI));
        colours.push(colour.r*(.78+.30*light)*volume,colour.g*(.87+.22*light)*volume,colour.b*(.74+.20*light)*volume);
      }
      if(band<4)for(let column=0;column<2;column++){const i=band*3+column;indices.push(i,i+3,i+1,i+1,i+3,i+4);}
    }
    const fitted=[];
    for(let i=0;i<indices.length;i+=3){
      const tri=indices.slice(i,i+3);if(tri.some(j=>!attached[j]))continue;
      if(project){
        const v=tri.map(j=>new THREE.Vector3().fromArray(positions,j*3));
        const depths=v.map(p=>p.dot(normal));
        if(Math.max(...depths)-Math.min(...depths)>.24)continue;
        // Do not span an opening or bridge the depth step of a balcony/frame.
        const samples=[v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3),...v.map((p,j)=>p.clone().lerp(v[(j+1)%3],.5))];
        if(samples.some(p=>{const hit=project(p);return !hit||Math.abs(hit.clone().sub(p).dot(normal))>.035;}))continue;
      }
      fitted.push(...tri);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
    g.setIndex(fitted);g.computeVertexNormals();if(fitted.length)pieces.push(g);else g.dispose();
    start=end;card++;
  }
  if(!pieces.length)return null;
  const result=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return result;
}

export function addIvyVines(parent,trails){
  const pieces=trails.map((p,i)=>ivyRibbon(p.points,p.width,p.seed??i+621,p.normal,p.surface)).filter(Boolean);
  if(!pieces.length)return;
  const mesh=new THREE.Mesh(mergeGeometries(pieces),ivyMaterial());
  mesh.name='attached-ivy-image-planes';mesh.castShadow=false;mesh.receiveShadow=false;
  parent.add(mesh);pieces.forEach(g=>g.dispose());return mesh;
}
