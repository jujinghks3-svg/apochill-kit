import * as THREE from 'three';
import { meadowNoise } from './meadow-field.js';
import {addTreeBillboards} from './tree-billboards.js';
import {CONCEPT,conceptToneInput} from './concept-palette.js';
import {SUN_TO_LIGHT} from './sun-direction.js';
import {applyDayTint} from './daylight-state.js';
import {sideMountainHeight} from './seoul-terrain.js';

// Sculpted ridges retain volume in the background instead of flat zigzag cards.
export function addDistantLandscape(world) {
  const sun=SUN_TO_LIGHT;
  let seed=81332;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const forestStats={instances:0,batches:0,triangles:0};
  for(let layer=0;layer<3;layer++) {
    const geometry=new THREE.PlaneGeometry(1200,124,140,26);geometry.rotateX(-Math.PI/2);
    const positions=geometry.attributes.position,colors=[];
    const base=conceptToneInput(CONCEPT.distant[2-layer]);
    for(let i=0;i<positions.count;i++) {
      const x=positions.getX(i),z=positions.getZ(i),front=(z+62)/124;
      const ridge=28+18*Math.sin(x*.014+layer*1.8)+12*Math.sin(x*.033+2.7+layer);
      const crest=Math.pow(Math.max(0,Math.sin(front*Math.PI)),.8);
      const leftScale=.72+.28*THREE.MathUtils.smoothstep(x,-380,-80);
      positions.setY(i,-29+(Math.max(8,ridge)*crest+Math.sin(x*.061+z*.05)*3*crest)*leftScale);
    }
    geometry.computeVertexNormals();
    const normal=new THREE.Vector3();
    for(let i=0;i<positions.count;i++) {
      normal.fromBufferAttribute(geometry.attributes.normal,i);
      const light=.53+Math.max(0,normal.dot(sun))*.47;
      const patch=meadowNoise(positions.getX(i)*.06+layer*11,positions.getZ(i)*.08);
      const tint=base.clone().multiplyScalar(light*(.87+patch*.23));
      tint.lerp(conceptToneInput(CONCEPT.distant[2]),Math.max(0,positions.getY(i)+10)/110*.25);
      colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const ridge=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true}));
    applyDayTint(ridge.material);
    ridge.position.z=-625+layer*55;ridge.name=`sculpted-distant-ridge-${layer}`;world.add(ridge);
    const terrainY=(x,z)=>{
      const gx=(x+600)/1200*140,gz=(z+62)/124*26;
      const ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;
      const a=positions.getY(iz*141+ix),b=positions.getY(iz*141+ix+1);
      const c=positions.getY((iz+1)*141+ix),d=positions.getY((iz+1)*141+ix+1);
      return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
    };
    const trees=[];
    for(let z=-54;z<=54;z+=6)for(let x=-558;x<=558;x+=7){
      const px=x+(random()-.5)*4.5,pz=z+(random()-.5)*3.8;
      const patch=meadowNoise(px*.055+layer*21,pz*.073);
      if(patch<.18)continue;
      const height=(6.5+random()*5.5)*(.82+.18*THREE.MathUtils.smoothstep(px,-380,-80));
      trees.push({x:px,y:terrainY(px,pz)-.10,z:ridge.position.z+pz,height,wide:.9+random()*.3,
        terrainTint:colors.slice((Math.round((pz+62)/124*26)*141+Math.round((px+600)/1200*140))*3,(Math.round((pz+62)/124*26)*141+Math.round((px+600)/1200*140))*3+3),tone:.67+layer*.075+random()*.08,variant:Math.floor(random()*4)});
    }
    const stats=addTreeBillboards(world,trees,`mountain-${layer}`,140);
    for(const key of Object.keys(forestStats))forestStats[key]+=stats[key];
  }
  // Wrap both sides of the city. Broad overlapping ridges hide the old
  // straight end of the ground plane as the rooftop camera orbits left.
  for(const side of [-1,1])for(let layer=0;layer<2;layer++){
    const geometry=new THREE.PlaneGeometry(210,720,28,96);geometry.rotateX(-Math.PI/2);
    const pos=geometry.attributes.position,colors=[],trees=[];
    const height=(x,z)=>sideMountainHeight(x,z,side,layer);
    for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));
    geometry.computeVertexNormals();
    const normal=new THREE.Vector3(),base=conceptToneInput(CONCEPT.distant[layer?2:1]);
    for(let i=0;i<pos.count;i++){
      normal.fromBufferAttribute(geometry.attributes.normal,i);
      const tone=base.clone().multiplyScalar(.65+.32*Math.max(0,normal.dot(sun)));
      colors.push(tone.r,tone.g,tone.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const ridge=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true}));applyDayTint(ridge.material);
    ridge.position.set(side*(365+layer*120),0,-230);ridge.name=`side-mountain-${side}-${layer}`;world.add(ridge);
    for(let z=-346;z<346;z+=8)for(let x=-94;x<94;x+=8){
      const px=x+(random()-.5)*6,pz=z+(random()-.5)*6;
      trees.push({x:ridge.position.x+px,z:ridge.position.z+pz,y:height(px,pz)-.3,height:(8+random()*5)*(side<0?.75:1),wide:1.15+random()*.2,terrainTint:colors.slice((Math.round((pz+360)/720*96)*29+Math.round((px+105)/210*28))*3,(Math.round((pz+360)/720*96)*29+Math.round((px+105)/210*28))*3+3),tone:.68+random()*.10,variant:Math.floor(random()*4)});
    }
    const stats=addTreeBillboards(world,trees,`side-${side}-${layer}`,140);
    for(const key of Object.keys(forestStats))forestStats[key]+=stats[key];
  }
  world.userData.mountainForest=forestStats;
}
