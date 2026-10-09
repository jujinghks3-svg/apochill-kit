import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRoofFacilityKit} from './roof-facilities.js';
import {weatherMaterial} from './surface-weathering.js';

export function createGlassRoofFactory(){
  const kit=createRoofFacilityKit();
  const material=weatherMaterial(new T.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:.22}),{strength:.72,scale:1.5});
  material.name='glass-roof-aged-services';
  function build(variant,y,{distant=false}={}){
    const root=new T.Group();root.name='authored-glass-roof-services';root.position.y=y;
    const pieces=[],zones=[];
    function add(g,color){
      if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
      if(color){const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);
        for(let i=0;i<a.length;i+=3)a.set(c.toArray(),i);g.setAttribute('color',new T.BufferAttribute(a,3));}
      pieces.push(g);
    }
    function box(x,y,z,w,h,d,c='#a9b4a8'){add(new T.BoxGeometry(w,h,d).translate(x,y,z),c);}
    function rod(a,b,r=.045,c='#82968e'){
      const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.clone().sub(va);
      add(new T.CylinderGeometry(r,r,delta.length(),distant?4:6).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize())).translate(...va.add(vb).multiplyScalar(.5).toArray()),c);
    }
    function zone(x,z,w,d,type){zones.push({x,z,w,d,y:0,type});}
    function fixture(type,x,z,scale){
      const source=kit.get(type);add(source.geometry.clone().scale(scale,scale,scale).translate(x,0,z));
      zone(x,z,source.width*scale,source.depth*scale,type);
    }
    // Access penthouse, recessed doorway, ventilation grille and metal flashing.
    box(.7,.80,-.6,3.7,1.6,3.1);zone(.7,-.6,4,3.4,'access-core');
    box(.7,1.67,-.6,3.88,.14,3.28,'#83968c');
    box(.05,.61,.966,.68,1.20,.035,'#637f7b');
    if(!distant){
      box(.30,.60,1.00,.055,.08,.055,'#d7b97e');
      for(let i=0;i<5;i++)box(1.48,.84+i*.10,.974,.80,.042,.046,'#7b8d82');
    }
    // Three layouts maintain variation without changing the building footprint.
    const hx=variant===1?2.5:-2.75,hz=2.30;
    if(distant){
      box(hx,.35,hz,2.05,.70,1.12,'#91a39b');zone(hx,hz,2.35,1.45,'hvac');
      for(const dx of [-.48,.48])add(new T.CylinderGeometry(.28,.28,.05,8).translate(hx+dx,.725,hz),'#5c766e');
    }else fixture('hvac',hx,hz,.59);
    const other=variant===1?-3.15:3.25;
    if(distant){box(other,.5,2.25,1.1,1,1.1,'#bbc2ad');zone(other,2.25,1.4,1.4,'service');}
    else fixture(['satellite','water-tank','solar'][variant],other,2.25,variant===2?.43:.52);
    // Supported duct run, risers and a compact communications mast.
    rod([hx,.24,.55],[hx,.24,hz-.5],.11,'#a1b1ac');
    rod([hx,.24,.55],[-.7,.24,.55],.11,'#a1b1ac');
    zone(hx,.70,.55,1.7,'duct-run');
    const ax=variant===2?-3.9:3.8,az=-3.35;
    box(ax,.13,az,.6,.26,.6,'#969e8e');rod([ax,.26,az],[ax,2.7,az],.048);
    if(!distant){
      for(const dx of [-.3,.3]){rod([ax,1.9,az],[ax+dx,1.9,az],.025);box(ax+dx,2.12,az,.15,.64,.16,'#b2bdae');}
      rod([ax-.23,.22,az-.23],[ax,1.35,az],.025);rod([ax+.23,.22,az+.23],[ax,1.35,az],.025);
      for(let i=0;i<5;i++)box(-.9+i*.45,.035,2.6,.35,.07,.7,'#acac93');
      // Rail on the service side only; not another repeated facade band.
      for(const x of [-4,-2,0,2,4])rod([x,.02,-3.95],[x,.78,-3.95],.025);
      rod([-4,.78,-3.95],[4,.78,-3.95],.025);
      box(-3.7,.055,-2.4,.7,.11,.65,'#687c72');
    }
    zone(ax,az,.9,.9,'antenna');
    const geometry=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    root.userData.authoredRoofServices=true;root.userData.serviceZones=zones;
    return root;
  }
  return {build,disposeTemplates(){for(const asset of kit.values())asset.geometry.dispose();kit.values().next().value.material.dispose();}};
}
