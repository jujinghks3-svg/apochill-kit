import * as THREE from 'three';
import {namsanGround,FLOOD_LEVEL,sideMountainHeight} from './seoul-terrain.js';

// Static world-space obstacle distance, shared by PC and mobile. The field is
// baked once, so the water shader never loops through hundreds of buildings.
export function createShoreField(footprints,{width=1536,height=1300,minX=-325,minZ=-465,sizeX=650,sizeZ=550,terrain=true}={}){
  const dx=sizeX/width,dz=sizeZ/height,mask=new Uint8Array(width*height);
  const rect=(x,z,w,d)=>{
    const x0=Math.max(0,Math.floor((x-w/2-minX)/dx)),x1=Math.min(width-1,Math.ceil((x+w/2-minX)/dx));
    const z0=Math.max(0,Math.floor((z-d/2-minZ)/dz)),z1=Math.min(height-1,Math.ceil((z+d/2-minZ)/dz));
    if(x1<x0||z1<z0)return;
    for(let j=z0;j<=z1;j++)mask.fill(1,j*width+x0,j*width+x1+1);
  };
  const polygon=points=>{
    const first=Math.max(0,Math.floor((Math.min(...points.map(p=>p[1]))-minZ)/dz));
    const last=Math.min(height-1,Math.ceil((Math.max(...points.map(p=>p[1]))-minZ)/dz));
    // Scanline fill preserves rotated facades and concave L-shaped courtyards.
    for(let j=first;j<=last;j++){
      const z=minZ+(j+.5)*dz,crossings=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        if((a[1]>z)!==(b[1]>z))crossings.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      crossings.sort((a,b)=>a-b);
      for(let i=0;i+1<crossings.length;i+=2){
        const left=Math.max(0,Math.ceil((crossings[i]-minX)/dx-.5)),right=Math.min(width-1,Math.floor((crossings[i+1]-minX)/dx-.5));
        if(right>=left)mask.fill(1,j*width+left,j*width+right+1);
      }
    }
  };
  for(const f of footprints)if((f.roofY??1)>FLOOD_LEVEL&&(f.groundY??-28.1)<FLOOD_LEVEL){
    if(f.shorePolygon?.length>=3)polygon(f.shorePolygon);else rect(f.x,f.z,f.w,f.d);
  }
  if(terrain){
    rect(0,0,20,15);
    for(let span=0;span<6;span++)rect(-39,-109-span*10,8.2,2);
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      const x=minX+(i+.5)*dx,z=minZ+(j+.5)*dz;
      if(namsanGround(x,z)>FLOOD_LEVEL)mask[j*width+i]=1;
      if(z<-590||z>130)continue;
      for(const side of [-1,1])for(let layer=0;layer<2;layer++){
        const u=x-side*(365+layer*120),v=z+230;
        if(Math.abs(u)>105||Math.abs(v)>360)continue;
        const y=sideMountainHeight(u,v,side,layer);
        if(y>FLOOD_LEVEL)mask[j*width+i]=1;
      }
    }
  }
  const distance=new Float32Array(mask.length),diagonal=Math.hypot(dx,dz);
  for(let i=0;i<distance.length;i++)distance[i]=mask[i]?0:64;
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const k=j*width+i;let d=distance[k];
    if(i)d=Math.min(d,distance[k-1]+dx);
    if(j){d=Math.min(d,distance[k-width]+dz);if(i)d=Math.min(d,distance[k-width-1]+diagonal);if(i<width-1)d=Math.min(d,distance[k-width+1]+diagonal);}
    distance[k]=d;
  }
  for(let j=height-1;j>=0;j--)for(let i=width-1;i>=0;i--){
    const k=j*width+i;let d=distance[k];
    if(i<width-1)d=Math.min(d,distance[k+1]+dx);
    if(j<height-1){d=Math.min(d,distance[k+width]+dz);if(i)d=Math.min(d,distance[k+width-1]+diagonal);if(i<width-1)d=Math.min(d,distance[k+width+1]+diagonal);}
    distance[k]=d;
  }
  // Two channels preserve sub-centimetre distances with filterable RGBA8.
  const pixels=new Uint8Array(mask.length*4);
  for(let k=0;k<mask.length;k++){
    const encoded=Math.round(Math.min(63.99,Math.max(0,distance[k]-Math.min(dx,dz)*.5))*1024);
    pixels[k*4]=encoded>>8;pixels[k*4+1]=encoded&255;pixels[k*4+2]=mask[k]?255:0;pixels[k*4+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  texture.name='world-space-building-and-bank-distance';
  return {texture,bounds:new THREE.Vector4(minX,minZ,sizeX,sizeZ),width,height,distance,mask};
}
