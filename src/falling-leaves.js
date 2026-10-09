import * as THREE from 'three';

export function createFallingLeaves(parent) {
  let seed=771901;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.45,.28,0,0,.52,.14,.45,.28,0,0,1,0],3));
  geometry.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,side:THREE.DoubleSide,emissive:'#839747',emissiveIntensity:.065});
  const count=72,mesh=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D();
  mesh.name='windborne-leaves';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const paths=Array.from({length:count},(_,i)=>({x:(random()-.5)*40,z:i<36?6-random()*20:-12-random()*48,
    phase:random(),period:24+random()*28,angle:random()*6.28,size:.12+random()*.17,near:i<36}));
  paths.forEach((p,i)=>mesh.setColorAt(i,new THREE.Color(['#a2ae57','#7e9748','#c8ae60','#628047'][i%4])));
  // Explicit bounds include all motion; the leaf field never updates shadow maps.
  mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,-22),58);
  parent.add(mesh);
  function update(time) {
    paths.forEach((p,i)=>{
      const age=(time/p.period+p.phase)%1;
      const fade=THREE.MathUtils.smoothstep(age,0,.12)*(1-THREE.MathUtils.smoothstep(age,.82,1));
      const x=p.x+(age-.5)*15+Math.sin(age*9+p.angle)*1.7;
      const z=p.z+Math.sin(age*5+p.angle)*2+(age-.5)*5;
      // Stop near-field leaves above the camp surface; background leaves drift
      // outside its silhouette. Smooth scale-in/out avoids visible wrap jumps.
      const bottom=p.near?.45:-13;
      dummy.position.set(x,bottom+(1-age)*(p.near?8:23)+Math.sin(age*12+p.angle)*.28,z);
      dummy.rotation.set(time*.75+p.angle,Math.sin(time*.6+p.angle)*1.2,time*.43+p.angle);
      dummy.scale.set(p.size*fade,p.size*1.35*fade,p.size*fade);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });mesh.instanceMatrix.needsUpdate=true;
  }
  update(0);return {mesh,update};
}
