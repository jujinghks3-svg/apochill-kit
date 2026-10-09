import * as THREE from 'three';

// Authored broken outlines, reusable until reference-driven GLBs replace these slots.
export function brokenPanel(width,height,depth,material) {
  const shape=new THREE.Shape();
  shape.moveTo(-width/2,0);shape.lineTo(width/2,0);
  shape.lineTo(width/2,height*.48);shape.lineTo(width*.28,height*.57);
  shape.lineTo(width*.22,height*.43);shape.lineTo(width*.08,height*.65);
  shape.lineTo(-width*.06,height*.61);shape.lineTo(-width*.18,height*.9);
  shape.lineTo(-width*.36,height*.82);shape.lineTo(-width/2,height);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  const panel=new THREE.Mesh(geometry,material);panel.castShadow=true;panel.receiveShadow=true;return panel;
}

export function addRuinCraft(world,retro,replaceBuildings=false) {
  const stone=retro('#bcbda7'), rust=new THREE.MeshStandardMaterial({color:'#73634d',roughness:1});
  const slab=(width,depth)=>{
    const shape=new THREE.Shape();shape.moveTo(-width/2,-depth/2);shape.lineTo(width/2,-depth/2);
    shape.lineTo(width/2,depth*.13);shape.lineTo(width*.31,depth*.19);shape.lineTo(width*.27,depth*.4);
    shape.lineTo(width*.05,depth*.32);shape.lineTo(-width*.08,depth/2);shape.lineTo(-width/2,depth/2);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:false}),stone);mesh.rotation.x=-Math.PI/2;return mesh;
  };
  const beam=(a,b,radius,parent)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,start.distanceTo(end),5),rust);
    mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());parent.add(mesh);
  };
  for(const [x,z,height,lean] of (replaceBuildings?[]:[[-49,-57,36,-.13],[37,-76,43,.16],[-75,-96,48,-.11]])) {
    const group=new THREE.Group();group.name='replaceable-ruined-facade';group.position.set(x,-28+height*.45,z);group.rotation.z=lean;world.add(group);
    for(let i=0;i<5;i++) {
      const level=i*3.6;
      const panel=brokenPanel(4.8-i*.35,3.1,.22,stone);panel.position.set(-2.4,level,5.3);group.add(panel);
      const side=brokenPanel(7,3,.22,stone);side.position.set(-4.7,level,-.5);side.rotation.y=Math.PI/2;group.add(side);
      if(i%2===0) {
        const broken=slab(4.2,3.5);broken.position.set(1.4,level+.25,4.4);broken.rotation.z=-.19-i*.03;broken.rotation.x-=.13;group.add(broken);
      }
      for(let bar=0;bar<4;bar++)beam([-4+bar*.7,level+2,-.5],[-4.1+bar*.75,level+3.3+bar*.18,-.35],.028,group);
      const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(2.8,level+3.4,5.6),new THREE.Vector3(3.2,level+1.4,5.9),new THREE.Vector3(4.1,level+.1,5.7)]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(cable,10,.025,4,false),rust));
    }
  }
  // A fractured foreground ledge makes weathering readable close to the camera.
  for(const [x,z,angle] of [[-7,-7.42,.05],[7,-7.42,-.08]]) {
    const panel=brokenPanel(2.4,.9,.25,stone);panel.position.set(x,.1,z);panel.rotation.y=angle;world.add(panel);
    for(let i=0;i<3;i++)beam([x-.6+i*.45,.55,z],[x-.55+i*.42,1.1-i*.11,z+.02],.022,world);
  }
  // Fan of lifted, broken paving rather than a perfectly flat tiled sheet.
  for(let i=0;i<7;i++) {
    const piece=slab(.75+i*.05,.6);piece.position.set(-7.6+i*.32,.1,1.9+Math.sin(i*2.4)*.6);
    piece.scale.set(1,1,.28);piece.rotation.z=.07*Math.sin(i);world.add(piece);
  }
}
