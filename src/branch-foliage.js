import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CONCEPT,conceptToneInput} from './concept-palette.js';
import {applySoftFoliageLighting} from './soft-foliage-lighting.js';
import {applyLeafWind,expandLeafWindBounds} from './foliage-wind.js';
export {addIvyVines as addVines} from './ivy-vines.js';

const seedRandom=value=>()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
const cache=new Map();

// Original code-authored twig atlas; extended RGB avoids dark mip fringes.
export function foliageTexture(){
  if(cache.has('atlas'))return cache.get('atlas');
  const size=256,data=new Uint8Array(size*size*4),shapes=[];
  for(let i=0;i<7;i++)for(const side of [-1,1])shapes.push({
    x:.5+side*(.14+.035*Math.sin(i*1.7)),y:.19+i*.092,
    angle:side*(.68+(i%2)*.19),length:.15-i*.005,width:.063+(i%3)*.006,tone:(i%3)*.035,
  });
  shapes.push({x:.50,y:.875,angle:0,length:.13,width:.066,tone:.1});
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/(size-1),v=y/(size-1),p=(y*size+x)*4;
    let alpha=0,tone=.72;
    for(const leaf of shapes){
      const dx=u-leaf.x,dy=v-leaf.y,s=Math.sin(leaf.angle),c=Math.cos(leaf.angle);
      const a=dx*c-dy*s,b=dx*s+dy*c;
      const length=Math.abs(b/leaf.length),width=leaf.width*Math.pow(Math.max(0,1-length*length),.7);
      if(length<1&&Math.abs(a)<width){
        alpha=255;tone=.72+v*.20+leaf.tone+(a>0?.07:-.025);
        if(Math.abs(a)<.004)tone+=.1;
      }
    }
    if(v>.04&&v<.88&&Math.abs(u-.5-Math.sin(v*9)*.006)<.006){alpha=255;tone=.48;}
    // Neutral leaf detail lets measured vertex colours own the hue. The old
    // yellow-green texture multiplied a second green tint into every leaf.
    data[p]=data[p+1]=data[p+2]=Math.min(255,255*tone);data[p+3]=alpha;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
  texture.name='original-painted-leaf-spray';cache.set('atlas',texture);return texture;
}

export function foliageMaterial(){
  if(cache.has('material'))return cache.get('material');
  const material=new THREE.MeshBasicMaterial({map:foliageTexture(),alphaTest:.38,
    side:THREE.DoubleSide,vertexColors:true,fog:true,color:'#ffffff'});
  applySoftFoliageLighting(material);
  applyLeafWind(material);
  // Cutouts match AO/shadow depth; avoid blended sorting and alpha-hash grain.
  material.name='branch-leaf-cutouts';cache.set('material',material);return material;
}

export function barkMaterial(){
  if(!cache.has('bark'))cache.set('bark',new THREE.MeshStandardMaterial({color:'#746344',roughness:1}));
  return cache.get('bark');
}

export function branchSegment(a,b,radius,tip=radius*.46){
  const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(tip,radius,delta.length(),6,1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  return g.translate(...a.clone().add(b).multiplyScalar(.5).toArray()).toNonIndexed();
}

export function leafCard(center,size,rotation,tone=.7,crownCenter=new THREE.Vector3(0,.65,0)){
  const g=new THREE.PlaneGeometry(size,size*1.2,1,1).toNonIndexed();
  g.setAttribute('leafWindSize',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(size),1));
  g.applyQuaternion(new THREE.Quaternion().setFromEuler(rotation));g.translate(...center.toArray());
  const ramp=THREE.MathUtils.clamp(tone,0,1)*4,index=Math.min(3,Math.floor(ramp));
  const normals=g.attributes.normal,colors=[],color=conceptToneInput(CONCEPT.tree[index]).lerp(conceptToneInput(CONCEPT.tree[index+1]),ramp-index);
  for(let i=0;i<normals.count;i++){
    const radial=center.clone().sub(crownCenter);radial.y+=.12;radial.normalize();
    const n=new THREE.Vector3().fromBufferAttribute(normals,i);if(n.dot(radial)<0)n.negate();
    n.multiplyScalar(.18).addScaledVector(radial,.82).normalize();normals.setXYZ(i,n.x,n.y,n.z);
    colors.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}

export function branchTreeGeometry(variant=0,distant=false,pine=false){
  const key=`tree-${variant}-${distant}-${pine}`;if(cache.has(key))return cache.get(key);
  const random=seedRandom(7403+variant*337),wood=[],leaves=[];
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  const trunkMid=v(.018,.46,-.016),trunkTop=v(-.012,.94,.01);
  wood.push(branchSegment(v(0,0,0),trunkMid,.035,.024),branchSegment(trunkMid,trunkTop,.024,.005));
  if(pine){
    // Seven distinct whorls: broad lower boughs, open gaps, then a narrow leader.
    // Painted colour and rounded canopy normals share the soft sun response.
    for(let tier=0;tier<7;tier++){
      const t=tier/6,y=.23+t*.65,reach=.34*(1-t*.83);
      const arms=tier<4?7:5;
      for(let arm=0;arm<arms;arm++){
        const a=arm/arms*Math.PI*2+tier*1.17+variant*.31;
        const start=v(0,y+.025,0),end=v(Math.cos(a)*reach,y-.045,Math.sin(a)*reach);
        wood.push(branchSegment(start,end,.010*(1-t*.7),.002));
        for(let spray=0;spray<5;spray++){
          const f=.3+spray*.16,center=start.clone().lerp(end,f);
          center.x+=(random()-.5)*.025;center.z+=(random()-.5)*.025;
          const size=(.20-t*.125)*(1-f*.25);
          // A dark underside and a lighter top read as boughs without shadows.
          leaves.push(leafCard(center,size,new THREE.Euler(-Math.PI/2+.22,a,.12),.16+t*.31));
          leaves.push(leafCard(center.clone().add(v(0,.018,0)),size*.92,new THREE.Euler(-.82,a+.5,.22),.52+t*.28));
          if(spray%2===0)leaves.push(leafCard(center.clone().add(v(0,-.012,0)),size*.80,new THREE.Euler(-.4,a+1.3,.4),.22+t*.24));
        }
      }
    }
    leaves.push(leafCard(v(0,.955,0),.085,new THREE.Euler(0,.4,0),.92));
    leaves.push(leafCard(v(0,.95,0),.085,new THREE.Euler(0,1.97,0),.85));
    const result={wood:mergeGeometries(wood),leaves:expandLeafWindBounds(mergeGeometries(leaves))};
    [...wood,...leaves].forEach(g=>g.dispose());cache.set(key,result);return result;
  }
  const limbs=pine?22:12;
  for(let i=0;i<limbs;i++){
    const angle=i*2.399+variant*.33,layer=i/limbs;
    const y=pine?.24+layer*.67:.43+(i%4)*.113;
    const spread=pine?.34*(1-layer*.82):.20+random()*.13;
    const start=v(.01,y-.08,0),end=v(Math.cos(angle)*spread,y+(pine?-.018:.07),Math.sin(angle)*spread);
    wood.push(branchSegment(start,end,pine?.009:.012,.002));
    const sprays=distant?4:pine?10:15;
    for(let j=0;j<sprays;j++){
      const t=.42+.58*(j/sprays),side=j%2?1:-1;
      const fork=end.clone().sub(start).multiplyScalar(t).add(start);
      const reach=(pine?.095:.10)*(1-layer*.25);
      fork.x+=Math.cos(angle+side*1.0)*reach;fork.z+=Math.sin(angle+side*1.0)*reach;
      fork.y+=(random()-.3)*.09;
      if(j%3===0&&!distant)wood.push(branchSegment(start.clone().lerp(end,t),fork,.003,.001));
      const size=(pine?.15:.215)*(distant?1.3:1)*( .8+random()*.4);
      leaves.push(leafCard(fork,size,new THREE.Euler(-.65+random()*1.4,angle+random()*2,side*.45),.35+layer*.35+random()*.17));
      if(!distant&&j%2===0)leaves.push(leafCard(fork.clone().add(v(0,.025,0)),size*.85,new THREE.Euler(-1.15,angle+1.57,.2),.55+random()*.2));
    }
  }
  const result={wood:mergeGeometries(wood),leaves:expandLeafWindBounds(mergeGeometries(leaves))};
  [...wood,...leaves].forEach(g=>g.dispose());cache.set(key,result);return result;
}

export function addBranchTree(parent,x,y,z,height,variant=0,pine=false){
  const group=new THREE.Group();group.name='replaceable-branch-tree';group.position.set(x,y,z);group.scale.setScalar(height);
  const geometry=branchTreeGeometry(variant%3,false,pine);
  for(const [g,m] of [[geometry.wood,barkMaterial()],[geometry.leaves,foliageMaterial()]]){
    const mesh=new THREE.Mesh(g,m);mesh.castShadow=!m.userData.softFoliage;mesh.receiveShadow=!m.userData.softFoliage;group.add(mesh);
  }
  parent.add(group);return group;
}
