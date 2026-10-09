import * as THREE from 'three';
import {weatherMaterial} from './surface-weathering.js';

// Dongjak-inspired central blue railway arches, with roadway decks on both sides.
export function addDongjakBridge(world){
 const root=new THREE.Group();root.name='replaceable-dongjak-bridge';root.position.x=-39;
 const blue=weatherMaterial(new THREE.MeshStandardMaterial({color:'#4c8c9e',metalness:.4,roughness:.66}),{strength:.55,scale:2});
 const concrete=weatherMaterial(new THREE.MeshStandardMaterial({color:'#a7a897',roughness:.88}),{strength:.8});
 const road=new THREE.MeshStandardMaterial({color:'#64716c',roughness:.94});
 const rail=new THREE.MeshStandardMaterial({color:'#777c79',metalness:.65,roughness:.55});
 function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
 function beam(a,b,r,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),mat);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=true;root.add(m);}
 for(let span=0;span<6;span++){
  const z0=-99-span*10,z1=z0-10,mid=(z0+z1)/2;
  box(9,.55,10,concrete,0,-23.5,mid);box(2.7,.2,10,blue,0,-23.08,mid);
  for(const side of [-1,1]){
   box(2.8,.12,10,road,side*3.05,-23.17,mid);box(.14,.7,10,concrete,side*4.42,-22.85,mid);
   box(.07,.10,10,rail,side*.58,-22.91,mid);
   for(let k=0;k<10;k++)box(2.2,.08,.15,road,0,-22.98,z0-k-.4);
   for(let k=0;k<14;k++){
    const t=k/14,t1=(k+1)/14,ya=-22.9+3.9*Math.sin(Math.PI*t),yb=-22.9+3.9*Math.sin(Math.PI*t1);
    beam([side*1.45,ya,z0-t*10],[side*1.45,yb,z0-t1*10],.13,blue);
    if(k%2===0){beam([side*1.45,-22.9,z0-t*10],[side*1.45,ya,z0-t*10],.065,blue);
     beam([-1.45,ya,z0-t*10],[1.45,ya,z0-t*10],.075,blue);}
   }
   box(.20,.46,10,blue,side*1.45,-23.1,mid);
   beam([side*3.5,-22.9,z0],[side*3.5,-20.7,z0],.05,rail);
  }
  if(span===0)box(9.4,.5,2,concrete,0,-23.9,z0);
  for(const x of [-2.65,2.65]){
   box(1.15,6.5,1.9,concrete,x,-27,z1);
   const footing=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.35,.65,12),concrete);footing.position.set(x,-29.85,z1);root.add(footing);
  }
  box(8.2,.8,2.0,concrete,0,-24.15,z1);
 }
 world.add(root);world.userData.bridge={type:'dongjak-inspired',spans:6,centralRailway:true,sideRoadways:2};return root;
}
