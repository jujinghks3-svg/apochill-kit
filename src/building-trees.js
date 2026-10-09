import * as THREE from 'three';
import {branchTreeGeometry,barkMaterial,foliageMaterial} from './branch-foliage.js';
import {addTreeBillboards} from './tree-billboards.js';
import {FLOOD_LEVEL} from './seoul-terrain.js';
import {expandLeafWindBounds} from './foliage-wind.js';

const bentCache=new Map();
export function facadeTreeGeometry(variant){
  if(bentCache.has(variant))return bentCache.get(variant);
  const source=branchTreeGeometry(variant,true),result={};
  for(const part of ['wood','leaves']){
    const g=source[part].clone(),p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),t=THREE.MathUtils.clamp(y/.4,0,1);
      // Emerge through the window before turning upwards. The lower trunk is
      // rooted inside the room; the crown stays clear of the facade above it.
      const bend=.57*t*t*(3-2*t),slope=t>0&&t<1?.57*6*t*(1-t)/.4:0;
      const dx=.06*Math.sin(y*4+variant)*y,dxdy=.06*Math.sin(y*4+variant)+.24*y*Math.cos(y*4+variant);
      p.setXYZ(i,p.getX(i)+dx,y,p.getZ(i)+bend);
      const nn=new THREE.Vector3(n.getX(i),n.getY(i)-dxdy*n.getX(i)-slope*n.getZ(i),n.getZ(i)).normalize();n.setXYZ(i,nn.x,nn.y,nn.z);
    }
    g.computeBoundingBox();g.computeBoundingSphere();result[part]=g;
    if(part==='leaves')expandLeafWindBounds(g);
  }
  bentCache.set(variant,result);return result;
}

export function worldTreeSockets(root){
  root.updateMatrixWorld(true);const result=[];
  root.traverse(node=>{
    for(const socket of node.userData.treeSockets??[]){
      const position=new THREE.Vector3(...socket.position).applyMatrix4(node.matrixWorld);
      const normal=new THREE.Vector3(...socket.normal).transformDirection(node.matrixWorld);
      const scale=new THREE.Vector3().setFromMatrixScale(node.matrixWorld).y;
      result.push({position,normal,openingHeight:(socket.openingHeight??2.2)*scale,openingWidth:(socket.openingWidth??1.3)*scale});
    }
  });return result;
}

export function createBuildingTrees(){
  const buckets=new Map(),far=[],transform=new THREE.Object3D();
  const stats={roofTrees:0,facadeTrees:0,farRoofTrees:0,treeBatches:0};
  function add(point,height,variant,yaw,facade=false){
    const key=`${facade}:${variant}:${Math.floor(point.x/96)}:${Math.floor(point.z/96)}`;
    if(!buckets.has(key))buckets.set(key,{geometry:facade?facadeTreeGeometry(variant):branchTreeGeometry(variant,true),matrices:[]});
    transform.position.copy(point);transform.rotation.set(0,yaw,0);transform.scale.set(height*(facade?.87:1),height,height);transform.updateMatrix();
    buckets.get(key).matrices.push(transform.matrix.clone());
    stats[facade?'facadeTrees':'roofTrees']++;
  }
  return {
    populate(root,footprint,anchors,index){
      let seed=7429+index*971;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const distance=Math.hypot(footprint.x-13,footprint.z-20),chosen=[];
      const limit=Math.min(3,Math.max(1,Math.floor(footprint.w*footprint.d/60)));
      // Use real upward-facing roof hits, and cluster only on some buildings.
      if(random()>.17)for(const point of anchors){
        if(chosen.length>=limit)break;
        const height=Math.min(5.5,2.6+random()*2.5,Math.min(footprint.w,footprint.d)*.7);
        if((root.userData.roofEquipmentZones??[]).some(z=>Math.abs(point.x-z.x)<z.w/2+height*.48&&Math.abs(point.z-z.z)<z.d/2+height*.48))continue;
        if(point.y<FLOOD_LEVEL+.5||chosen.some(p=>p.distanceTo(point)<height*.75))continue;
        const variant=Math.floor(random()*3);chosen.push(point);
        if(distance>220){far.push({x:point.x,y:point.y,z:point.z,height,wide:.85,tone:.87+random()*.08,variant});stats.farRoofTrees++;}
        else add(point,height,variant,random()*Math.PI*2);
      }
      if(distance>250)return;
      const sockets=worldTreeSockets(root),used=[];
      const count=distance<125?4:2;
      // Stable shuffled order prevents every facade having trees on the same floor.
      const ranked=sockets.map(s=>({s,rank:random()})).sort((a,b)=>a.rank-b.rank);
      for(const {s} of ranked){
        if(used.length>=count)break;
        if(s.position.y<FLOOD_LEVEL+1||used.some(p=>p.distanceTo(s.position)<3.2))continue;
        // The bend reaches the exterior before .4 tree height, below the lintel.
        const height=Math.min(4.5,2.8+random()*1.6,s.openingHeight*2.2);
        if(height<1.7)continue;
        add(s.position,height,Math.floor(random()*3),Math.atan2(s.normal.x,s.normal.z),true);used.push(s.position);
      }
    },
    finish(world){
      for(const [key,bucket] of buckets)for(const part of ['wood','leaves']){
        const mesh=new THREE.InstancedMesh(bucket.geometry[part],part==='wood'?barkMaterial():foliageMaterial(),bucket.matrices.length);
        mesh.name=`building-grown-${part}-${key}`;mesh.castShadow=part==='wood';mesh.receiveShadow=part==='wood';
        bucket.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingBox();mesh.computeBoundingSphere();world.add(mesh);stats.treeBatches++;
      }
      if(far.length)addTreeBillboards(world,far,'rooftop-canopies',112);
      return stats;
    },
  };
}
