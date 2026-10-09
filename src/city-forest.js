import * as THREE from 'three';
import {branchTreeGeometry,foliageMaterial,barkMaterial} from './branch-foliage.js';
import {addTreeBillboards} from './tree-billboards.js';

function seeded(seed) {
  return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; };
}

export function createRuinShrubs() {
  const geometries=[0,1,2].map(variant=>branchTreeGeometry(variant,true));
  return (parent,x,y,z,width,variant=0) => {
    const shrub=new THREE.Group();
    for(const [kind,material] of [['wood',barkMaterial()],['leaves',foliageMaterial()]]){
      const part=new THREE.Mesh(geometries[variant%3][kind],material);part.receiveShadow=!material.userData.softFoliage;shrub.add(part);
    }
    shrub.name='connected-ruin-shrub';shrub.position.set(x,y,z);
    shrub.castShadow=true;shrub.receiveShadow=true;
    shrub.scale.set(width,width*.55,width);shrub.rotation.y=variant*2.399;
    parent.add(shrub);return shrub;
  };
}

export function addCityForest(world,{hillHeight,buildings}) {
  const random=seeded(745903), trees=[];
  // Two staggered trees per old street anchor; banks remain outside the water.
  for(let i=0;i<95;i++)for(let layer=0;layer<2;layer++) {
    const x=(i%19-9)*14+7+(layer?.8:-.7);
    const z=[-99,-157,-38,-62,-85][Math.floor(i/19)]-layer*3+random()*1.2;
    trees.push({x,y:-28,z,height:4.5+random()*3.6,wide:.88+random()*.25,far:false});
  }
  // Twice the previous hill placement budget. Variable
  // height and crown spread break the pebble-like, flattened old hill silhouette.
  for(let i=0;i<1000;i++) {
    const x=(random()-.5)*108,z=(random()-.5)*80;
    if(Math.abs(x)<4 && Math.abs(z)<5)continue;
    trees.push({x:x-82,y:-28+hillHeight(x,z),z:z-198,
      tone:.84+random()*.09,
      height:3.2+random()*3.3,wide:1.02+random()*.35,far:true,hill:true});
  }
  const hillCount=trees.length-190;
  // Seed a subset of solid rooftop slabs, giving the skyline organic edges.
  let roofCount=0;
  for(const b of buildings) {
    if(!b.overgrown || Math.hypot(b.x,b.z)>165 || random()>.65)continue;
    const count=b.w>8?2:1;
    for(let i=0;i<count;i++) {
      trees.push({x:b.x+(i?1:-1)*b.w*.19,y:-28+b.h,z:b.z+(random()-.5)*b.d*.35,
        height:2+random()*1.7,wide:.9+random()*.15,far:true});roofCount++;
    }
  }
  const crownMaterial=foliageMaterial();
  const dummy=new THREE.Object3D(), palette=new THREE.Color();
  const billboards=[];
  let batches=0,triangles=0,placedTrees=0,excludedTrees=0;
  for(const distant of [false,true])for(let variant=0;variant<3;variant++) {
    const geometries=branchTreeGeometry(variant,distant);
    // Spatial districts retain useful culling without per-tree draw calls.
    for(const west of [false,true]) {
      const candidates=trees.filter((p,i)=>p.far===distant && (p.x<0)===west && i%3===variant);
      const spots=candidates.filter(p=>!buildings.some(b=>b.replacement && Math.abs(p.x-b.x)<b.w/2+1.2 && Math.abs(p.z-b.z)<b.d/2+1.2));
      placedTrees+=spots.length;excludedTrees+=candidates.length-spots.length;
      if(!spots.length)continue;
      if(distant){billboards.push(...spots);continue;}
      const crowns=new THREE.InstancedMesh(geometries.leaves,crownMaterial,spots.length);
      const trunks=new THREE.InstancedMesh(geometries.wood,barkMaterial(),spots.length);
      trunks.castShadow=true;trunks.receiveShadow=true;trunks.name='forest-branch-skeleton';
      crowns.castShadow=false;crowns.receiveShadow=false;
      crowns.name=`forest-canopy-${distant?'far':'street'}-${variant}-${west?'west':'east'}`;
      spots.forEach((p,i)=>{
        dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,random()*Math.PI*2,0);
        dummy.scale.set(p.height*p.wide,p.height,p.height*p.wide);dummy.updateMatrix();
        crowns.setMatrixAt(i,dummy.matrix);
        trunks.setMatrixAt(i,dummy.matrix);
        const value=.91+random()*.13;
        palette.setRGB(value*(variant===1?.80:1),value, value*(variant===2?.85:.97));
        crowns.setColorAt(i,palette);
      });
      for(const mesh of [crowns,trunks]) {
        mesh.computeBoundingBox();mesh.computeBoundingSphere();world.add(mesh);
        triangles+=(mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count)/3*spots.length;
      }
      batches+=2;
    }
  }
  // Independent seed preserves the existing street/roof forest and its variants.
  // Double the accepted Namsan population, not the pre-collision candidate budget.
  const baseHillBillboards=billboards.filter(p=>p.hill).length;
  const fillRandom=seeded(928731),extra=[];
  for(let attempt=0;extra.length<baseHillBillboards&&attempt<baseHillBillboards*100;attempt++){
    const x=(fillRandom()-.5)*108,z=(fillRandom()-.5)*80,wx=x-82,wz=z-198;
    if(Math.abs(x)<4&&Math.abs(z)<5)continue;
    if(buildings.some(b=>b.replacement&&Math.abs(wx-b.x)<b.w/2+1.2&&Math.abs(wz-b.z)<b.d/2+1.2))continue;
    extra.push({x:wx,y:-28+hillHeight(x,z),z:wz,tone:.84+fillRandom()*.09,
      height:3.2+fillRandom()*3.3,wide:1.02+fillRandom()*.35,far:true,hill:true,variant:Math.floor(fillRandom()*4)});
  }
  billboards.push(...extra);placedTrees+=extra.length;
  const sprites=addTreeBillboards(world,billboards,'city-hill');batches+=sprites.batches;triangles+=sprites.triangles;
  const stats={candidateStreetTrees:190,candidateHillTrees:hillCount,candidateRoofTrees:roofCount,excludedTrees,treeInstances:placedTrees,billboardTrees:sprites.instances,baseHillBillboards,hillBillboards:baseHillBillboards+extra.length,batches,triangles};
  world.userData.cityForest=stats;
  if(import.meta.env?.DEV)console.info('[Apochill] Connected forest:',JSON.stringify(stats));
}
