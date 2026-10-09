import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {addBranchTree,leafCard} from './branch-foliage.js';
import {expandLeafWindBounds} from './foliage-wind.js';

const crownCache=new Map();
function closeBroadleafCrown(variant){
  if(crownCache.has(variant))return crownCache.get(variant);
  let seed=6173+variant*271;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const cards=[],centers=[];
  for(let i=0;i<7;i++){
    const upper=i>=4,a=i*2.399+variant*.31,r=upper?.115:.215;
    centers.push(new THREE.Vector3(Math.cos(a)*r,upper?.80:.59+(i%2)*.065,Math.sin(a)*r));
  }
  centers.push(new THREE.Vector3(-.015,.90,.01));
  for(const center of centers)for(let i=0;i<58;i++){
    const a=random()*Math.PI*2,y=random()*2-1;
    const radius=Math.cbrt(random()),radial=Math.sqrt(1-y*y)*radius;
    const p=center.clone().add(new THREE.Vector3(Math.cos(a)*radial*.17,y*radius*.145,Math.sin(a)*radial*.16));
    const tone=THREE.MathUtils.clamp(.23+(p.y-.42)*.82+random()*.09,.2,.85);
    cards.push(leafCard(p,.085+random()*.04,new THREE.Euler((random()-.5)*2.7,random()*Math.PI*2,(random()-.5)*1.6),tone,center));
  }
  const geometry=mergeGeometries(cards);cards.forEach(g=>g.dispose());
  // Small foreground sprays were barely moving after pixel rendering. Boost
  // their wind response only; UV roots and the shader's .16 m amplitude cap
  // stay intact. Recalculate bounds after the gain, including storm flutter.
  const wind=geometry.getAttribute('leafWindSize');
  for(let i=0;i<wind.count;i++)wind.setX(i,wind.getX(i)*3);
  expandLeafWindBounds(geometry);
  crownCache.set(variant,geometry);return geometry;
}

export function addDioramaTree(parent,x,y,z,height,seed=0){
  // The street-tree branch skeleton/material, with smaller close-view sprays
  // filling overlapping crown lobes rather than oversized fern-shaped cards.
  const tree=addBranchTree(parent,x,y,z,height,seed,false);
  const crown=tree.children.find(mesh=>mesh.material.userData.softFoliage);
  crown.geometry=closeBroadleafCrown(seed%3);
  tree.name='replaceable-rooftop-broadleaf';
  tree.rotation.y=(seed*.618)% (Math.PI*2);
  tree.scale.x*=.94;tree.scale.z*=.94;
  return tree;
}
