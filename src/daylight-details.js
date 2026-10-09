import * as THREE from 'three';
import { addDioramaTree } from './diorama-trees.js';
import { addDioramaCamp } from './diorama-props.js';
import { addConceptArtDetails } from './concept-art-details.js';
import { createRuinShrubs } from './city-forest.js';
import { createStylizedWater } from './stylized-water.js';

export function addDaylightDetails(world, { retro,replaceBuildings=false }) {
  let seed = 9083;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: false, ...extra });
  const stone = retro('#c7d7cd');
  const metal = retro('#6c8c87', 'metal', .5);
  const rust = mat('#a66540');
  const wood = mat('#a48854');
  const rubber = mat('#263c3d');
  const white = mat('#f0eee0');
  const red = mat('#d66042');
  const blue = mat('#5493b0');
  const foliage = [mat('#398c3c'), mat('#79b840'), mat('#a5ce51')];
  const shrub = createRuinShrubs();
  const mesh = (geometry, material, position, parent = world) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  };
  const box = (size, material, position, parent) => mesh(new THREE.BoxGeometry(...size), material, position, parent);
  const rod = (a, b, r, material, parent = world) => {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const object = mesh(new THREE.CylinderGeometry(r, r, av.distanceTo(bv), 6), material, av.clone().add(bv).multiplyScalar(.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize()); return object;
  };

  addDioramaTree(world, -8.2, .15, -4.5, 6.0, 407);
  addDioramaTree(world, 8.8, .15, -4.8, 5.6, 811);
  addDioramaTree(world, 9.1, .15, -1.8, 3.1, 213);
  addDioramaCamp(world);
  addConceptArtDetails(world,retro);

  // Ground growth now shares its texture mask with the meadow's plant distribution.
  let meadowMap;
  world.traverse(o=>{if(o.material?.meadowMap)meadowMap=o.material.meadowMap;});
  // Exposed low spots, clear of the tent deck, fire, access shed and dog house.
  for(const [index,[x,z,w,d]] of [[5,5.5,1.4,.7],[-3.2,5.3,1.2,.55],[.7,5.6,1.5,.7],
    [-8,-2.9,.8,.55],[2.5,-5.8,1.3,.65],[6.7,-3.7,.9,.5],[5.6,2.8,.7,.55],[-3.6,-5.3,1,.55]].entries()){
    const shape=new THREE.Shape();
    for(let i=0;i<=32;i++){
      const angle=i/32*Math.PI*2,radius=.88+Math.sin(angle*5+index)*.07+Math.cos(angle*3-index)*.05;
      const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius;
      if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py);
    }
    const material=createStylizedWater({kind:'puddle',center:[x,z],halfSize:[w,d]});
    material.meadowMap=meadowMap;
    const puddle=mesh(new THREE.ShapeGeometry(shape),material,[x,.091,z]);
    puddle.name=`rain-puddle-${index}`;puddle.rotation.x=-Math.PI/2;puddle.scale.set(w,d,1);
    puddle.castShadow=false;puddle.receiveShadow=true;
  }

  // Old tyres, broken boards and masonry collect at the roof edge.
  for (let i = 0; i < 3; i++) {
    const tyre = mesh(new THREE.TorusGeometry(.43, .13, 6, 14), rubber, [8.4 - i * .65, .26, 5.9]);
    tyre.rotation.x = Math.PI / 2 + i * .15;
  }
  for (let i = 0; i < 13; i++) {
    const x = i % 2 ? -8.5 + random() * 2 : 6.7 + random() * 2;
    const z = 2.5 + random() * 4;
    const debris = mesh(new THREE.DodecahedronGeometry(.16 + random() * .2, 0), i % 3 ? stone : rust, [x, .19, z]);
    debris.scale.set(1.6, .6, 1); debris.rotation.set(random(), random(), random());
  }
  for (let i = 0; i < 4; i++) { const board = box([1.5, .065, .18], wood, [-7.5 + i * .25, .16 + i * .025, 2.1]); board.rotation.y = -.6 + i * .2; }

  // Midground broken towers: visible floor plates and leaning upper structures.
  for (const [x, z, height, lean] of (replaceBuildings?[]:[[-49, -57, 36, -.13], [37, -76, 43, .16], [-75, -96, 48, -.11]])) {
    const ruin = new THREE.Group(); ruin.position.set(x, -28, z); world.add(ruin);
    box([10, height * .45, 11], stone, [0, height * .225, 0], ruin);
    const upper = new THREE.Group(); upper.position.y = height * .45; upper.rotation.z = lean; ruin.add(upper);
    for (let level = 0; level < height * .55; level += 3.6) {
      const width = 10 - (level / height) * 3;
      box([width, .38, 11], stone, [-.5, level, 0], upper);
      for (const cx of [-3.8, 3.5]) for (const cz of [-4.5, 4.5]) box([.5, 3.6, .5], metal, [cx, level + 1.8, cz], upper);
      if (level % 7.2 < 1) {
        for(let clump=0;clump<3;clump++) {
          shrub(upper,-3.7+clump*1.8,level+.2,3.7+(clump%2)*.5,
            3.1+(clump%2)*.6,Math.round(level/3.6)+clump);
        }
      }
    }
    for (let i = 0; i < 9; i++) { const rubble = mesh(new THREE.DodecahedronGeometry(1 + random() * 1.5, 0), stone, [x + (random() - .5) * 16, -27, z + 7 + random() * 6]); rubble.scale.y = .6; }
  }

  // No vehicles in the current art pass. Preserve the seed for water plants.
  for(let i=0;i<12;i++)random();
  for (let i = 0; i < 18; i++) {
    const x = -23 + random() * 6, z = -28 - random() * 70;
    const pad = mesh(new THREE.CircleGeometry(.35 + random() * .4, 9), foliage[i % 3], [x, -27.86, z]); pad.rotation.x = -Math.PI / 2; pad.castShadow = false;
  }
}
