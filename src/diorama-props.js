import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {weatherMaterial} from './surface-weathering.js';

// Original prop kit: soft edges, broad colour blocks and deliberately legible fittings.
export function addDioramaCamp(world) {
  const material=(color)=>weatherMaterial(new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0}),{strength:1.25,scale:3.5});
  const olive=material('#777f56'), dark=material('#343f39'), ochre=material('#ba884b');
  const cream=material('#d9cfb4'), red=material('#ae5946'), blue=material('#698a8b');
  const wood=material('#9b7d54'), steel=material('#65726c'), canvas=material('#9a9769');
  const group=(name,x,y,z,angle=0)=>{const g=new THREE.Group();g.name=`replaceable-${name}`;g.position.set(x,y,z);g.rotation.y=angle;world.add(g);return g;};
  const mesh=(g,geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  const box=(g,size,mat,p,r=.06)=>mesh(g,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.22))),mat,...p);
  const cylinder=(g,r,h,mat,p)=>mesh(g,new THREE.CylinderGeometry(r,r,h,16),mat,...p);
  const handle=(g,x,y,z,w,mat)=>{
    box(g,[w,.085,.12],mat,[x,y+.1,z],.035);
    for(const side of [-1,1])box(g,[.075,.17,.12],mat,[x+side*(w/2-.037),y,z],.025);
  };
  function caseProp(name,x,z,mat,w=1.25,angle=0,y=.1) {
    const g=group(name,x,y,z,angle);
    box(g,[w,.64,.84],mat,[0,.32,0],.1);
    box(g,[w+.035,.15,.875],mat,[0,.7,0],.045);
    box(g,[w+.02,.035,.86],dark,[0,.61,0],.008);
    for(const side of [-1,1]) {
      box(g,[.13,.25,.075],steel,[side*w*.31,.61,.46],.025);
      box(g,[.05,.08,.02],cream,[side*w*.31,.68,.51],.01);
      for(const zSide of [-1,1])box(g,[.16,.3,.12],steel,[side*w*.43,.16,zSide*.37],.025);
    }
    handle(g,0,.86,0,.48,dark);
    for(let i=0;i<3;i++)box(g,[.035,.025,.55],steel,[-.28+i*.28,.785,0],.009);
    return g;
  }
  caseProp('supply-case',-5.9,3.5,olive,1.4,.12);
  caseProp('stacked-case',-5.9,3.5,ochre,1.12,-.05,.92);
  const med=caseProp('medical-case',3.7,1.0,red,1.05,-.09);
  box(med,[.4,.105,.025],cream,[0,.36,.44],.02);box(med,[.105,.4,.025],cream,[0,.36,.445],.02);
  const cooler=caseProp('cooler',3.6,2.85,blue,1.4,.07);
  box(cooler,[1.43,.17,.89],cream,[0,.72,0],.065);

  for(const [x,z,mat,angle] of [[5.1,.85,olive,.12],[5.65,1.6,blue,-.15]]) {
    const g=group('jerrycan',x,.1,z,angle);
    box(g,[.64,.96,.42],mat,[0,.48,0],.095);
    handle(g,.07,1.04,0,.32,mat);cylinder(g,.075,.085,dark,[-.21,1.01,.015]);
    for(const tilt of [-.6,.6])box(g,[.045,.68,.027],mat,[0,.48,.223],.02).rotation.z=tilt;
    box(g,[.31,.17,.014],cream,[0,.68,.245],.015);
  }
  const bag=group('backpack',-2.7,.12,2.7,-.2);
  box(bag,[.76,1.04,.46],ochre,[0,.58,0],.19);
  box(bag,[.69,.26,.55],ochre,[0,1.1,.015],.11);
  box(bag,[.57,.43,.18],canvas,[0,.41,.29],.085);
  for(const side of [-1,1]){
    box(bag,[.07,.92,.035],dark,[side*.21,.64,.258],.02);
    box(bag,[.24,.49,.32],canvas,[side*.47,.43,.02],.065);
    box(bag,[.1,.12,.025],cream,[side*.21,.83,.29],.02);
  }
  handle(bag,0,1.31,0,.32,dark);
  const roll=group('bedroll',-3.9,.39,3.2,0);
  cylinder(roll,.27,1.22,blue,[0,0,0]).rotation.z=Math.PI/2;
  for(const x of [-.4,.4]){const s=mesh(roll,new THREE.TorusGeometry(.277,.035,6,16),dark,x,0,0);s.rotation.y=Math.PI/2;}
  // The rolled end has its own concentric fabric seam.
  for(const r of [.12,.21]){const seam=mesh(roll,new THREE.TorusGeometry(r,.012,4,16),cream,.617,0,0);seam.rotation.y=Math.PI/2;}

  const bench=group('workbench',4.1,.1,-3.4,.04);
  box(bench,[2.8,.17,1.05],wood,[0,1.04,0]);
  for(const x of [-1.15,1.15])for(const z of [-.35,.35])box(bench,[.15,.96,.15],dark,[x,.48,z]);
  box(bench,[2.5,.1,.7],wood,[0,.3,0]);
  const toolbox=box(bench,[.9,.43,.5],red,[-.58,1.34,0],.075);
  handle(bench,-.58,1.6,0,.34,dark);box(bench,[.12,.12,.025],cream,[-.58,1.42,.27]);
  const accessories=new THREE.Group();accessories.name='workbench-accessories';bench.add(accessories);
  const map=box(accessories,[.77,.018,.56],cream,[.48,1.14,.05],.008);map.rotation.y=.2;
  for(let i=0;i<3;i++)box(accessories,[.45,.006,.018],olive,[.45,1.154,-.11+i*.14],.002).rotation.y=.2;
  cylinder(accessories,.11,.21,steel,[1.06,1.24,.16]);
  const gen=group('generator',7,.12,-2.4,-.25);
  box(gen,[1.28,.81,.75],ochre,[0,.53,0],.12);
  box(gen,[.8,.56,.045],dark,[0,.49,.407]);
  for(let i=0;i<6;i++)box(gen,[.54,.026,.027],steel,[0,.29+i*.074,.44],.008);
  handle(gen,0,1.09,0,.67,dark);
  for(const x of [-.53,.53])box(gen,[.13,.15,1],dark,[x,.1,0]);
  cylinder(gen,.07,.045,cream,[.41,.96,.2]);
  const radio=group('radio',-.9,.13,2.25,.08);
  box(radio,[.72,.43,.29],dark,[0,.215,0],.05);
  box(radio,[.26,.18,.02],blue,[-.16,.25,.156],.02);
  for(let i=0;i<4;i++)box(radio,[.025,.2,.015],steel,[.06+i*.055,.23,.157],.004);
  cylinder(radio,.014,.69,steel,[.27,.7,0]).rotation.z=-.13;
  const barrel=group('barrel',6.65,.12,2.7,0);
  cylinder(barrel,.46,1.15,red,[0,.575,0]);
  for(const y of [.17,.92]){const band=mesh(barrel,new THREE.TorusGeometry(.465,.035,6,20),steel,0,y,0);band.rotation.x=Math.PI/2;}
  cylinder(barrel,.46,.04,steel,[0,1.17,0]);cylinder(barrel,.07,.025,dark,[.2,1.21,.1]);

  const tank=group('water-tank',8.65,.1,3.7,0);
  for(const x of [-.57,.57])for(const z of [-.48,.48])box(tank,[.105,.9,.105],steel,[x,.45,z]);
  const profile=[[0,0],[.67,0],[.78,.1],[.8,.25],[.8,1.4],[.76,1.56],[.58,1.68],[0,1.71]].map(([r,h])=>new THREE.Vector2(r,h));
  mesh(tank,new THREE.LatheGeometry(profile,32),cream,0,.88,0);
  for(const y of [1.04,1.65,2.25]){const ring=mesh(tank,new THREE.TorusGeometry(.801,.03,6,32),steel,0,y,0);ring.rotation.x=Math.PI/2;}
  cylinder(tank,.2,.08,steel,[0,2.63,0]);
  box(tank,[.25,.38,.04],blue,[0,1.6,.809],.035);
  for(const x of [-.22,.22])box(tank,[.035,2.5,.035],steel,[x,1.25,.99],.008);
  for(let i=0;i<9;i++)box(tank,[.48,.035,.04],steel,[0,.22+i*.27,.99],.008);
  cylinder(tank,.045,.48,steel,[-.6,.67,.37]);
  const valve=mesh(tank,new THREE.TorusGeometry(.12,.018,6,14),red,-.6,.84,.44);
  box(tank,[.21,.023,.03],red,[-.6,.84,.44],.004);
  // Paired planks make the access door feel used and keep the walkway readable.
  const walk=group('roof-walkway',-5.8,.1,5.7,.04);
  for(let i=0;i<5;i++)box(walk,[1.6,.04,.32],wood,[0,.02,-.68+i*.35],.02);

  // Thick boards and metal fittings keep the supplies readable at the default camera distance.
  const deck=group('tent-deck',-4.6,.081,.25,0);
  for(let i=0;i<11;i++)box(deck,[4.95,.035,.42],wood,[0,.018,(i-5)*.44],.018);
  for(let i=0;i<5;i++) {
    const can=group('food-tin',2.3+i*.36,.11,3.9+Math.sin(i)*.22,i*.5);
    cylinder(can,.105,.24,i%2?cream:red,[0,.12,0]);cylinder(can,.108,.015,steel,[0,.247,0]);
  }
}
