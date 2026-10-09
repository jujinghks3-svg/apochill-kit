import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A continuous facade replaces subpixel floors/recesses/ribs in distant towers.
// Window and rib shading live in a mipmapped texture, not stacked depth surfaces.
export function verticalFacadeTexture(variant){
  const size=256,data=new Uint8Array(size*size*4);
  const coverage=[.62,.53,.70,.60][variant-9];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*4,v=y/size*4,col=Math.floor(u),floor=Math.floor(v);
    const bx=u-col,by=v-floor,edge=(1-coverage)/2;
    const window=bx>edge&&bx<1-edge;
    const room=(col*7+floor*11+variant)%5;
    let rgb=[239,239,230];
    if(window){
      const light=room*3;
      rgb=by<.07||by>.94?[129,148,145]:[143+light,165+light,166+light];
      // Soft fixed reveal shading, broad enough to survive texture filtering.
      const shade=1-Math.max(0,1-(bx-edge)/.09)*.12;
      rgb=rgb.map(c=>Math.round(c*shade));
    }else{
      const relief=bx<.035||bx>.965?.94:1;
      rgb=rgb.map(c=>Math.round(c*relief));
    }
    const i=(y*size+x)*4;data.set([...rgb,255],i);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name=`vertical-facade-lod-${variant}`;texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}

export function createVerticalFacadeLod({variant,w,d,h,floors,base}){
  const root=new THREE.Group();root.name=`kit-concrete-${variant}`;
  const stone=new THREE.MeshStandardMaterial({color:base,roughness:.94});
  stone.name=`vertical-lod-stone-${variant}`;
  const facade=new THREE.MeshStandardMaterial({color:base,map:verticalFacadeTexture(variant),roughness:.86,metalness:0});
  facade.name=`vertical-lod-continuous-facade-${variant}`;
  const pieces=new Map();
  const add=(g,m)=>{if(!pieces.has(m))pieces.set(m,[]);pieces.get(m).push(g);};
  const outline=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
  for(let i=0;i<4;i++){
    const a=outline[i],b=outline[(i+1)%4],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);
    const yaw=Math.atan2(dz/span,-dx/span),columns=Math.max(2,Math.round(span/[1.7,1.3,1.15,1.9][variant-9]));
    const g=new THREE.PlaneGeometry(span,h),uv=g.attributes.uv;
    for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*columns/4,uv.getY(j)*floors/4);
    g.rotateY(yaw).translate((a[0]+b[0])/2,h/2,(a[1]+b[1])/2);add(g,facade);
    // Parapet starts above the facade; inset roof cannot share its wall plane.
    add(new THREE.PlaneGeometry(span,.56).rotateY(yaw).translate((a[0]+b[0])/2,h+.28,(a[1]+b[1])/2),stone);
  }
  add(new THREE.BoxGeometry(w-.12,.16,d-.12).translate(0,h,0),stone);
  add(new THREE.PlaneGeometry(w,d).rotateX(Math.PI/2).translate(0,-.08,0),stone);
  // Retain the source silhouette/bounds without hundreds of small rib surfaces.
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])add(new THREE.BoxGeometry(.18,h,.18).translate(x,h/2,z),stone);
  for(const [material,geometries] of pieces){
    const mesh=new THREE.Mesh(mergeGeometries(geometries),material);
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  root.userData={treeSockets:[],shoreOutline:outline,facadeStyle:'vertical-ribbons',
    facadeLod:'continuous-mipmapped',helipadDeck:w===d||variant===9,
    buildingShape:[9,11].includes(variant)?'square':'slab',
    buildingFinish:[9,11].includes(variant)?'white-plaster':'exposed-concrete',
    roofZones:[{x:0,z:0,w,d,y:h+.08}]};
  return root;
}
