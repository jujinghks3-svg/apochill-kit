import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {weatherMaterial} from './surface-weathering.js';

export const DOG_HOME={x:-.15,y:.09,z:5,scale:.9,doorX:-.15+.985*.9,bedY:.09+.15*.9};
const material=(color,roughness=.8,metalness=0)=>weatherMaterial(new T.MeshStandardMaterial({color,roughness,metalness}),{strength:.6,scale:5});
function mesh(parent,geo,mat,p){const m=new T.Mesh(geo,mat);m.position.fromArray(p);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(g,s,m,p)=>mesh(g,new RoundedBoxGeometry(...s,1,Math.min(.025,...s.map(v=>v*.18))),m,p);
const cylinder=(g,r1,r2,h,m,p)=>mesh(g,new T.CylinderGeometry(r1,r2,h,20),m,p);
function ring(g,r,t,m,p,rotationX=Math.PI/2){const o=mesh(g,new T.TorusGeometry(r,t,5,24),m,p);o.rotation.x=rotationX;return o;}
function rod(g,a,b,r,m){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=cylinder(g,r,r,start.distanceTo(end),m,start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;}
function vessel(g,r,h,m,p){
  const points=[[0,0],[r*.78,0],[r,h*.25],[r,h],[r-.025,h],[r-.04,.035],[0,.035]].map(v=>new T.Vector2(...v));
  return mesh(g,new T.LatheGeometry(points,24),m,p);
}

export function createDogHouse(){
  const g=new T.Group();g.name='replaceable-shiba-house';g.position.set(DOG_HOME.x,DOG_HOME.y,DOG_HOME.z);g.rotation.y=Math.PI/2;
  g.scale.setScalar(DOG_HOME.scale);
  const timber=[material('#a5875b'),material('#b0966b'),material('#927551')],trim=material('#69543b'),roof=material('#536e67'),metal=material('#69746e',.55,.45),bed=material('#8c9465');
  for(let i=0;i<8;i++)box(g,[.196,.06,1.94],timber[i%3],[(i-3.5)*.203,.03,0]);
  for(const side of [-1,1])for(let i=0;i<7;i++)box(g,[.085,.158,1.91],timber[i%3],[side*.79,.145+i*.161,0]);
  const face=door=>{
    const s=new T.Shape();s.moveTo(-.825,0);s.lineTo(.825,0);s.lineTo(.825,1.2);s.lineTo(0,1.73);s.lineTo(-.825,1.2);s.closePath();
    if(door){const h=new T.Path();h.moveTo(-.47,.025);h.lineTo(-.47,.84);h.quadraticCurveTo(-.47,1.14,0,1.16);h.quadraticCurveTo(.47,1.14,.47,.84);h.lineTo(.47,.025);h.closePath();s.holes.push(h);}
    return new T.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1,curveSegments:12});
  };
  mesh(g,face(true),timber[1],[0,0,.91]);mesh(g,face(false),timber[0],[0,0,-.98]);
  for(const side of [-1,1]){
    const slope=Math.atan2(.59,.93);
    for(let i=0;i<8;i++){
      const d=(i+.5)/8,board=box(g,[.142,.065,2.17],roof,[side*d*.93,1.76-d*.59,0]);board.rotation.z=-side*slope;
    }
    rod(g,[0,1.77,1.10],[side*.96,1.16,1.10],.038,trim);
    box(g,[.10,1.16,.1],trim,[side*.79,.58,.99]);
    for(const y of [.18,.9])cylinder(g,.02,.02,.018,metal,[side*.79,y,1.055]).rotation.x=Math.PI/2;
  }
  box(g,[.10,.09,2.22],trim,[0,1.79,0]);
  const mat=box(g,[1.28,.10,1.40],bed,[0,.10,-.07]);mat.name='shiba-bed';
  const ramp=box(g,[.94,.025,.35],timber[0],[0,.025,1.13]);ramp.rotation.x=.17;
  box(g,[.55,.17,.045],trim,[0,1.38,1.005]);
  const paw=material('#dccda7');mesh(g,new T.SphereGeometry(.043,8,6),paw,[0,1.37,1.043]).scale.set(1,.8,.25);
  for(const [x,y] of [[-.065,1.41],[-.023,1.435],[.023,1.435],[.065,1.41]])mesh(g,new T.SphereGeometry(.02,6,5),paw,[x,y,1.045]).scale.z=.3;
  g.userData.entranceWidth=.94*DOG_HOME.scale;g.userData.entranceHeight=1.16*DOG_HOME.scale;
  return g;
}

export function createCampKitchen(){
  const g=new T.Group();g.name='replaceable-camp-kitchen';
  const steel=material('#7f8b85',.36,.68),dark=material('#343e3c',.67,.4),enamel=material('#c8d5c5',.42,.18),wood=material('#97734e'),red=material('#a15e45');
  // Low cooking tray beside the hearth, clear of chairs and the dog corridor.
  const station=new T.Group();station.position.set(-1.7,.09,1.12);station.rotation.y=-.16;g.add(station);
  for(let i=0;i<4;i++)box(station,[.25,.07,.83],wood,[(i-1.5)*.255,.035,0]);
  vessel(station,.22,.22,dark,[-.21,.07,0]);cylinder(station,.22,.23,.035,steel,[-.21,.30,0]);
  ring(station,.046,.014,dark,[-.21,.337,0],Math.PI/2);
  for(const side of [-1,1])ring(station,.06,.014,steel,[-.21+side*.26,.22,0],0);
  const pan=vessel(station,.20,.045,dark,[.28,.08,.05]);pan.rotation.z=.06;
  box(station,[.07,.035,.31],wood,[.28,.105,.34]);
  // Enamel mug, plate, kettle, chopping board and a spoon/utensil roll.
  const mug=vessel(g,.09,.16,enamel,[-.75,.09,2.66]);ring(g,.055,.015,enamel,[-.63,.18,2.66],0);
  vessel(g,.19,.034,enamel,[-1.13,.09,2.86]);
  const kettle=new T.Group();kettle.position.set(-1.55,.09,2.55);g.add(kettle);
  mesh(kettle,new T.SphereGeometry(.19,16,10),steel,[0,.17,0]).scale.y=.83;
  cylinder(kettle,.115,.13,.032,dark,[0,.323,0]);cylinder(kettle,.025,.034,.04,wood,[0,.36,0]);
  const spout=rod(kettle,[.13,.16,0],[.31,.27,0],.045,steel);ring(kettle,.19,.023,dark,[0,.32,0],0);
  box(g,[.46,.045,.31],wood,[-2.05,.12,2.42]);
  box(g,[.23,.012,.038],steel,[-2.08,.15,2.42]);box(g,[.13,.035,.05],red,[-1.90,.157,2.42]);
  rod(g,[-.95,.12,2.96],[-.76,.12,3.05],.012,steel);
  mesh(g,new T.SphereGeometry(.045,10,6),steel,[-.72,.125,3.065]).scale.set(1,.2,.7);
  // Dog bowls are away from hot cookware and outside the doorway.
  vessel(g,.17,.09,steel,[.83,.09,6.3]);vessel(g,.17,.09,enamel,[.39,.09,6.3]);
  cylinder(g,.13,.13,.01,material('#839c97',.16,.3),[.39,.158,6.3]);
  for(let i=0;i<12;i++)mesh(g,new T.DodecahedronGeometry(.022,0),wood,[.83+Math.sin(i*2.4)*.10,.155,6.3+Math.cos(i*2.4)*.10]);
  return g;
}

export function addLaptopDisplay(survivorRoot){
  // Fitted to the P1 screen surface in survivor-local coordinates. A separate
  // emissive panel leaves the keyboard and rugged casing non-emissive.
  const g=new T.Group();g.name='laptop-blue-display';g.position.set(.005,1.515,.964);
  g.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(0,.407,-.913).normalize());
  const glow=new T.MeshStandardMaterial({color:'#315c93',emissive:'#599cfa',emissiveIntensity:2.7,roughness:.38,metalness:0});
  mesh(g,new T.PlaneGeometry(.66,.365),glow,[0,0,0]).castShadow=false;
  const ink=new T.MeshBasicMaterial({color:'#b9e0ff',toneMapped:false});
  for(let i=0;i<5;i++)mesh(g,new T.PlaneGeometry(.36-(i%3)*.065,.008),ink,[-.065,.09-i*.039,.002]).castShadow=false;
  survivorRoot.add(g);
  const light=new T.PointLight('#71aaff',.35,1.65,2);light.position.set(0,1.57,.70);survivorRoot.add(light);
  return {screen:g,light};
}
