import * as THREE from 'three';
import {ivyMaterial} from './ivy-vines.js';

const seeded=(value)=>()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};

function leafGeometry() {
  // A single broad lobed leaf sampled from the first image-atlas quadrant.
  const geometry=new THREE.PlaneGeometry(.9,1).translate(0,.5,0),uv=geometry.attributes.uv,colors=[];
  for(let i=0;i<uv.count;i++){
    uv.setXY(i,.18+uv.getX(i)*.14,.86+uv.getY(i)*.11);
    colors.push(1,1,1);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
}

export function addConceptArtDetails(world,retro) {
  const random=seeded(24091);
  const stone=retro('#b9b7a1'),edge=retro('#777f78'),rust=new THREE.MeshStandardMaterial({color:'#79583d',roughness:1});
  const green=ivyMaterial();
  const mesh=(geometry,material,position,parent=world)=>{
    const object=new THREE.Mesh(geometry,material);object.position.set(...position);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  };
  const rod=(a,b,r,parent=world)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const object=mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),5),rust,start.clone().add(end).multiplyScalar(.5).toArray(),parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());return object;
  };

  const placements=[];
  const addEdgePatch=(axis,fixed,start,end,count,face,hangingRate=.42)=>{
    for(let i=0;i<count;i++) {
      const along=start+(end-start)*random();
      const clump=.28+.72*Math.pow(Math.sin((along-start)/(end-start)*Math.PI*4.5+1.2),4);
      if(random()>clump)continue;
      const hanging=random()<hangingRate;
      placements.push({x:axis==='x'?along:fixed+face*.06,y:hanging?.04-random()*(.35+random()*.9):.11+random()*.13,
        z:axis==='z'?along:fixed+face*.06,scale:.18+random()*.22,yaw:random()*Math.PI*2,
        roll:hanging?(face>0?Math.PI*.52:-Math.PI*.52):(random()-.5)*.45});
    }
  };
  addEdgePatch('z',-9.92,-7.2,7.25,210,-1);
  addEdgePatch('z',9.92,-7.2,7.25,210,1);
  const ivy=new THREE.InstancedMesh(leafGeometry(),green,placements.length);
  ivy.name='concept-rooftop-edge-ivy-image';ivy.receiveShadow=false;ivy.castShadow=false;
  const transform=new THREE.Object3D(),tint=new THREE.Color();
  placements.forEach((p,i)=>{
    transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.roll,p.yaw,(random()-.5)*.35);
    transform.scale.set(p.scale,p.scale*(.9+random()*.65),p.scale);transform.updateMatrix();ivy.setMatrixAt(i,transform.matrix);
    tint.set(random()>.7?'#ffffff':random()>.45?'#dcdfcb':'#b5bcb0');ivy.setColorAt(i,tint);
  });
  ivy.computeBoundingBox();ivy.computeBoundingSphere();world.add(ivy);

  const frames=[[-17,-42,9,.04],[3,-48,7,-.03],[22,-55,11,.06]];
  for(const [x,z,height,lean] of frames) {
    const group=new THREE.Group();group.name='replaceable-flooded-ruin';group.position.set(x,-28,z);group.rotation.z=lean;world.add(group);
    for(let level=0;level<height;level+=3) {
      const width=7-level*.16,depth=6-level*.08;
      const slab=mesh(new THREE.BoxGeometry(width,.32,depth),stone,[0,level,0],group);
      if(level>height-3.2)slab.rotation.y=.04;
      for(const [cx,cz] of [[-width*.4,-depth*.38],[width*.4,-depth*.38],[-width*.4,depth*.38],[width*.4,depth*.38]]) {
        const broken=level+3>height&&random()>.46;
        if(!broken)mesh(new THREE.BoxGeometry(.38,3,.38),edge,[cx,level+1.5,cz],group);
        else for(let bar=0;bar<3;bar++)rod([cx+(bar-1)*.07,level,cz],[cx+(bar-1)*.07,level+1.35+random()*.5,cz],.025,group);
      }
    }
    const topLevel=(Math.ceil(height/3)-1)*3;
    const topWidth=7-topLevel*.16,topDepth=6-topLevel*.08;
    for(let i=0;i<9;i++) {
      const chip=mesh(new THREE.DodecahedronGeometry(.18+random()*.3,0),stone,[(random()-.5)*(topWidth-.8),topLevel+.3,(random()-.5)*(topDepth-.8)],group);
      chip.scale.set(1.7,.5,1);chip.rotation.set(random(),random(),random());
    }
    const roofGreen=mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#718e4d',roughness:1}),[-1.1,topLevel+.4,.5],group);
    roofGreen.scale.set(2.2,.28,1.6);
  }

  const crackPoints=[];
  for(let chain=0;chain<9;chain++) {
    let x=-8.5+random()*17,z=1.8+random()*4.8;
    for(let segment=0;segment<3;segment++) {
      const nx=x+(random()-.5)*.85,nz=z+.25+random()*.6;
      crackPoints.push(new THREE.Vector3(x,.083,z),new THREE.Vector3(nx,.083,nz));x=nx;z=nz;
    }
  }
  const cracks=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crackPoints),new THREE.LineBasicMaterial({color:'#5f665d',transparent:true,opacity:.58}));
  cracks.name='rooftop-hairline-cracks';world.add(cracks);
}
