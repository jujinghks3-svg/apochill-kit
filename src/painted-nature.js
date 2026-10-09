import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MEADOW, sampleMeadow, meadowNoise, smooth } from './meadow-field.js';
import {CONCEPT} from './concept-palette.js';

export const natureTime = { value: 0 };
const seeded = (initial) => { let s = initial; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function windMaterial(color, strength, vertexColors = false, groundLighting = false) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, vertexColors, emissive: CONCEPT.grass[1], emissiveIntensity: vertexColors ? .015 : .045 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.natureTime = natureTime;
    shader.vertexShader = 'uniform float natureTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 windAnchor = position;
      #ifdef USE_INSTANCING
        windAnchor = instanceMatrix[3].xyz;
      #endif
      float gust = sin(natureTime*.75 + windAnchor.x*.42 + windAnchor.z*.3);
      float flutter = sin(natureTime*1.8 + windAnchor.z*1.2 + windAnchor.x*.6);
      transformed.x += (gust + flutter*.22) * ${strength.toFixed(3)} * max(position.y,0.);
      transformed.z += gust * ${(.3 * strength).toFixed(3)} * max(position.y,0.);
    `);
    if (groundLighting) {
      // Both sides of a grass blade use the same upward canopy normal. Three's
      // default backface flip otherwise turns half the meadow almost black.
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        normal *= gl_FrontFacing ? 1. : -1.;
      `);
    }
  };
  material.customProgramCacheKey = () => `nature-wind-${strength}-${vertexColors}-${groundLighting}`;
  return material;
}

function leafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,0, -.38,.36,0, 0,.5,.13, .38,.36,0, -.25,.72,0, 0,1,0, .25,.72,0,
  ], 3));
  g.setIndex([0,1,2, 0,2,3, 1,4,2, 4,5,2, 5,6,2, 6,3,2]);
  g.computeVertexNormals();
  return g;
}

export function addPaintedTree(parent, x, y, z, height, seed = 1) {
  const random = seeded(seed);
  const group = new THREE.Group(); group.name = 'replaceable-tree'; group.position.set(x,y,z); parent.add(group);
  const bark = new THREE.MeshStandardMaterial({ color: '#756c4c', roughness: 1 });
  const limb = (a, b, radiusA, radiusB) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const object = new THREE.Mesh(new THREE.CylinderGeometry(radiusB,radiusA,start.distanceTo(end),9),bark);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
    object.castShadow = true; object.receiveShadow = true; group.add(object);
  };
  const bend = height*.07;
  limb([0,0,0],[bend,height*.48,0],height*.053,height*.033);
  limb([bend,height*.48,0],[-bend*.4,height*.87,.1],height*.033,height*.013);
  for (let i=0;i<6;i++) {
    const angle=i*2.4;
    limb([0,.5,0],[Math.cos(angle)*height*.18,.02,Math.sin(angle)*height*.18],height*.033,.02);
  }
  const crowns=[];
  for (let i=0;i<9;i++) {
    const angle=i*2.4;
    const spread=height*(i<6?.29:.12);
    const center=new THREE.Vector3(Math.sin(angle)*spread,height*(.65+(i%3)*.14),Math.cos(angle)*spread);
    limb([bend,height*.42,0],center.toArray(),height*.025,.022);
    crowns.push(center);
  }
  const leaves=new THREE.InstancedMesh(leafGeometry(),windMaterial('#ffffff',.16),2700);
  leaves.name='animated-tree-leaves';
  const dummy=new THREE.Object3D(), tint=new THREE.Color();
  const dark=new THREE.Color('#54794c'), bright=new THREE.Color('#a4bc54');
  for(let i=0;i<leaves.count;i++) {
    const c=crowns[i%crowns.length];
    const angle=random()*Math.PI*2, vertical=random()*2-1, radius=Math.sqrt(random())*height*.23;
    const horizontal=Math.sqrt(1-vertical*vertical);
    dummy.position.set(c.x+Math.cos(angle)*radius*horizontal,c.y+vertical*radius*.65,c.z+Math.sin(angle)*radius*horizontal);
    dummy.rotation.set((random()-.5)*2.4,random()*6.28,(random()-.5)*2);
    const size=height*(.045+random()*.038); dummy.scale.set(size,size*1.35,size);
    dummy.updateMatrix(); leaves.setMatrixAt(i,dummy.matrix);
    tint.copy(dark).lerp(bright,THREE.MathUtils.clamp((dummy.position.y/height-.4)*1.25+random()*.2,0,1));
    leaves.setColorAt(i,tint);
  }
  leaves.castShadow=true; leaves.receiveShadow=true;
  leaves.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
  leaves.customDepthMaterial.onBeforeCompile=leaves.material.onBeforeCompile;
  leaves.customDepthMaterial.customProgramCacheKey=leaves.material.customProgramCacheKey;
  group.add(leaves);
  return group;
}

export function grassGeometry(blades = 5, segments = 3) {
  const positions=[], colors=[], indices=[];
  const root=new THREE.Color(MEADOW.root), tip=new THREE.Color(MEADOW.tip);
  for(let blade=0;blade<blades;blade++) {
    const angle=blade*2.4, offsetX=Math.sin(angle)*.13, offsetZ=Math.cos(angle)*.13;
    const start=positions.length/3;
    for(let segment=0;segment<=segments;segment++) {
      const t=segment/segments, width=(1-t)*(.082-blade*.006);
      for(const side of [-1,1]) {
        positions.push(offsetX+Math.cos(angle)*width*side+Math.sin(angle)*t*t*.25,t*(.72+(blade%3)*.12),offsetZ+Math.sin(angle)*width*side+Math.cos(angle)*t*t*.25);
        const c=root.clone().lerp(tip,smooth(0,1,t)*.82); colors.push(c.r,c.g,c.b);
      }
      if(segment<segments) { const n=start+segment*2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  // Up-biased normals let narrow blades share the ground's broad lighting response.
  const normals=g.attributes.normal, normal=new THREE.Vector3();
  for(let i=0;i<normals.count;i++) {
    normal.fromBufferAttribute(normals,i).multiplyScalar(.28);normal.y=.9;normal.normalize();
    normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  return g;
}

export function addRoofMeadow(world) {
  const random=seeded(4107), placements=[];
  for(let i=0;i<18400;i++) {
    const x=(random()-.5)*19.5,z=(random()-.5)*14.5;
    const field=sampleMeadow(x,z);
    if(field.coverage<.1 || random()>field.density*.85)continue;
    const edge=smooth(.12,.7,field.coverage);
    placements.push([x,.073,z,(.24+random()*.39)*(.5+edge*.5),field.tone]);
  }
  const grass=new THREE.InstancedMesh(grassGeometry(),windMaterial('#ffffff',.22,true,true),placements.length);
  const transform=new THREE.Object3D(),tint=new THREE.Color();
  placements.forEach(([x,y,z,size,tone],i)=>{
    transform.position.set(x,y,z);transform.scale.set(size*1.28,size,size*1.28);
    transform.rotation.y=meadowNoise(x*.22,z*.22)*6.28+(random()-.5)*1.8;
    transform.updateMatrix();grass.setMatrixAt(i,transform.matrix);
    const value=.91+tone*.12;tint.setRGB(value,value,.97*value);grass.setColorAt(i,tint);
  });
  grass.receiveShadow=true;grass.name='wind-swept-rooftop-meadow';world.add(grass);
  grass.computeBoundingSphere();grass.boundingSphere.radius+=.3;
  world.userData.meadowTufts=placements.length;
  if(import.meta.env?.DEV)console.info('[Apochill] Meadow tufts:',placements.length);
  addMeadowDetails(world,placements);
  return grass;
}

function addMeadowDetails(world,placements) {
  const random=seeded(771), transform=new THREE.Object3D();
  const positions=placements.filter((p,i)=>i%13===0);
  const leaves=new THREE.InstancedMesh(leafGeometry(),windMaterial(CONCEPT.grass[1],.1),positions.length*4);
  leaves.name='low-meadow-groundcover';leaves.receiveShadow=true;
  positions.forEach(([x,,z],i)=>{
    for(let l=0;l<4;l++) {
      const angle=l*Math.PI*.5+random()*.4;
      transform.position.set(x+Math.sin(angle)*.06,.083,z+Math.cos(angle)*.06);
      transform.rotation.set(1.02,angle,0);transform.scale.set(.21,.27,.21);transform.updateMatrix();
      leaves.setMatrixAt(i*4+l,transform.matrix);
    }
  });
  world.add(leaves);
  // Sparse complete flowers: stems and flat petals, rather than floating colour dots.
  const pieces=[];
  const part=(geometry,color)=>{
    const g=geometry.toNonIndexed(),c=new THREE.Color(color),colors=[];
    for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));pieces.push(g);geometry.dispose();
  };
  part(new THREE.CylinderGeometry(.009,.012,.25,5).translate(0,.125,0),'#637d46');
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    part(new THREE.SphereGeometry(1,6,4).scale(.048,.012,.075).rotateY(a).translate(Math.sin(a)*.049,.25,Math.cos(a)*.049),'#e1dfb3');
  }
  part(new THREE.SphereGeometry(.025,6,4).translate(0,.265,0),'#d0ae58');
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  // Loose drifts with empty gaps, following the same ground/grass coverage mask.
  const spots=placements.filter(([x,,z],i)=>i%11===0 && z>-3 && meadowNoise(x*.65+4,z*.65)>.47);
  const flowers=new THREE.InstancedMesh(geometry,windMaterial('#ffffff',.16,true),spots.length);
  flowers.name='meadow-wildflowers';flowers.receiveShadow=true;
  spots.forEach(([x,,z],i)=>{
    transform.position.set(x,.078,z);transform.rotation.set(0,random()*6.28,0);transform.scale.setScalar(.95+random()*.80);
    transform.updateMatrix();flowers.setMatrixAt(i,transform.matrix);
  });
  world.add(flowers);
}

export function addCanopyLeaves(world, centers) {
  const random=seeded(547), count=centers.length*65;
  const leaves=new THREE.InstancedMesh(leafGeometry(),windMaterial('#ffffff',.13),count);
  const dummy=new THREE.Object3D(), tint=new THREE.Color();
  for(let i=0;i<count;i++) {
    const c=centers[Math.floor(i/65)], theta=random()*Math.PI*2, v=random()*2-1;
    const radius=Math.sqrt(1-v*v);
    dummy.position.set(c.x+Math.cos(theta)*radius*c.w*.96,c.y+v*c.h*.9,c.z+Math.sin(theta)*radius*c.d);
    dummy.rotation.set(random()*2,random()*6.28,random()*2);
    dummy.scale.setScalar(.5+random()*.5);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    tint.set(v>0?'#96b858':'#4b8555');leaves.setColorAt(i,tint);
  }
  world.add(leaves);
}

export function addWallIvy(world, patches) {
  const random=seeded(6251), placements=[];
  for(const p of patches) {
    const count=p.h>4?Math.ceil(p.h*2):p.z < -140?9:16;
    for(let i=0;i<count;i++)placements.push({
      x:p.x+(random()-.5)*p.w, y:p.y+(random()-.5)*p.h,
      z:p.z+(random()-.5)*p.d, size:.55+random()*.65,
      tone:random(),
    });
  }
  const leaves=new THREE.InstancedMesh(leafGeometry(),windMaterial('#ffffff',.1),placements.length);
  leaves.name='hanging-ivy-leaves';
  const dummy=new THREE.Object3D(), tint=new THREE.Color(), base=new THREE.Color('#477958'),light=new THREE.Color('#9eaf5c');
  placements.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set((random()-.5)*.8,(random()-.5)*1.2,Math.PI+(random()-.5)*2.5);
    dummy.scale.set(p.size,p.size*1.2,p.size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    tint.copy(base).lerp(light,p.tone);leaves.setColorAt(i,tint);
  });
  world.add(leaves);
}
