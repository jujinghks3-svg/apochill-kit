import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {weatherMaterial} from './surface-weathering.js';
import {meadowNoise} from './meadow-field.js';

export function createRoofFacilityKit(){
  const catalog=new Map();
  const material=weatherMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.12}),{strength:.42,scale:2});
  material.name='weathered-roof-installations';
  for(const type of ['helipad','helipad-round','helipad-abandoned','lattice-mast','water-tank','hvac','satellite','solar']){
    const parts=[];
    const add=(g,color)=>{
      if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
      const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
      for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
      g.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(g);
    };
    const box=(x,y,z,w,h,d,c='#8c9990')=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),c);
    const rod=(a,b,r=.035,c='#687a72')=>{
      const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
      const g=new THREE.CylinderGeometry(r,r,delta.length(),5).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      add(g.translate(...va.add(vb).multiplyScalar(.5).toArray()),c);
    };
    let width=3,depth=3;
    if(type.startsWith('helipad')){
      width=depth=7.6;
      const round=type==='helipad-round',abandoned=type==='helipad-abandoned';
      const paint=abandoned?'#aaa991':'#eee7c9';
      if(round)add(new THREE.CylinderGeometry(3.8,3.8,.10,8).translate(0,.05,0),'#898d7d');
      else box(0,.035,0,7.6,.07,7.6,abandoned?'#737967':'#556f67');
      add(new THREE.RingGeometry(2.7,2.82,48,1,0,abandoned?Math.PI*1.72:Math.PI*2).rotateX(-Math.PI/2).translate(0,.116,0),abandoned?'#b0aa88':'#d4c998');
      for(const x of [-.92,.92])box(x,.118,0,.40,.012,3.2,paint);
      box(0,.119,0,2.15,.014,.40,paint);
      // Broken perimeter paint and four low marker lights; no extra UI texture.
      if(!round)for(const s of [-1,1])for(let i=-3;i<=3;i+=1.5){
        if(abandoned&&i>0&&s>0)continue;
        box(i,.118,s*3.52,.7,.012,.10,'#cab987');box(s*3.52,.118,i,.10,.012,.7,'#cab987');
      }
      for(const x of [-1,1])for(const z of [-1,1])box(x*(round?2.6:3.55),.16,z*(round?2.6:3.55),.12,.15,.12,'#c8b478');
    }else if(type==='lattice-mast'){
      width=depth=2.1;
      const h=5.8;
      for(const x of [-.7,.7])for(const z of [-.7,.7]){
        box(x,.15,z,.36,.3,.36,'#96988a');rod([x,.3,z],[x*.3,h,z*.3],.055);
      }
      for(let level=0;level<4;level++){
        const y=.35+level*1.3,r=.7*(1-y/h*.7),r2=.7*(1-(y+1.3)/h*.7);
        for(const s of [-1,1]){
          rod([-r,y,s*r],[r2,y+1.3,s*r2]);rod([r,y,s*r],[-r2,y+1.3,s*r2]);
          rod([s*r,y,-r],[s*r2,y+1.3,r2]);rod([s*r,y,r],[s*r2,y+1.3,-r2]);
        }
      }
      rod([0,h,0],[0,h+1.3,0],.038);
      for(const x of [-.62,.62]){rod([0,4.8,0],[x,4.8,0]);box(x,5.05,0,.2,.9,.22,'#b9beb1');}
    }else if(type==='water-tank'){
      width=depth=2.9;
      for(const x of [-.8,.8])for(const z of [-.8,.8])rod([x,0,z],[x,1.1,z],.07);
      add(new THREE.CylinderGeometry(1.15,1.15,1.9,16).translate(0,1.95,0),'#babba6');
      for(const y of [1.08,1.5,2.3,2.85])add(new THREE.TorusGeometry(1.155,.035,4,16).rotateX(Math.PI/2).translate(0,y,0),'#74867b');
      for(const x of [-.3,.3])rod([x,.15,1.18],[x,3,1.18],.024);
      for(let y=.3;y<3;y+=.3)rod([-.3,y,1.18],[.3,y,1.18],.022);
    }else if(type==='hvac'){
      width=3.8;depth=2.4;
      for(const x of [-1,1]){
        box(x,.45,0,1.6,.9,1.8,'#8e9f96');
        add(new THREE.CylinderGeometry(.48,.48,.06,12).translate(x,.93,0),'#435953');
        // Three separate fan sectors: crossed bars shared a coplanar centre.
        for(const a of [0,Math.PI*2/3,Math.PI*4/3])add(new THREE.CylinderGeometry(.40,.40,.025,4,1,false,a,Math.PI*.32).translate(x,.986,0),'#83958a');
        for(let i=0;i<5;i++)box(x,.2+i*.12,.91,1.3,.028,.025,'#506960');
      }
      box(0,.24,-.95,2.3,.42,.38,'#9da79a');
    }else if(type==='satellite'){
      width=depth=2.6;box(0,.10,0,1.2,.2,1.2);rod([0,.2,0],[0,1.25,0],.09);
      const dish=new THREE.SphereGeometry(.9,16,8,0,Math.PI*2,0,.85).rotateX(.65).translate(0,1.05,0);
      add(dish,'#c1c4b3');rod([0,1.4,.6],[0,2.2,.9],.024);
    }else{
      width=3.8;depth=2.8;
      for(const x of [-.94,.94]){
        for(const z of [-.8,.8])rod([x,0,z],[x,z<0?.72:.32,z],.045);
        add(new THREE.BoxGeometry(1.7,.08,2.1).rotateX(.24).translate(x,.55,0),'#526f7c');
        for(let j=-2;j<=2;j++)add(new THREE.BoxGeometry(.025,.014,2.02).rotateX(.24).translate(x+j*.31,.60,0),'#a4b6b2');
      }
    }
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());catalog.set(type,{geometry,material,width,depth});
  }
  return catalog;
}

// A dense support grid must hit the same horizontal roof; never place a
// pad across the missing quadrant of an L building or over a service penthouse.
export function roofSupport(root,x,z,width,depth){
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),ray=new THREE.Raycaster(),hits=[];
  const normalMatrix=new THREE.Matrix3();
  const nx=Math.max(2,Math.ceil(width/.7)),nz=Math.max(2,Math.ceil(depth/.7));
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
    const u=ix/nx-.5,v=iz/nz-.5;
    ray.set(new THREE.Vector3(x+width*u,bounds.max.y+1,z+depth*v),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(root,true)[0];
    if(!hit?.face||hit.point.y<bounds.max.y-(bounds.max.y-bounds.min.y)*.25)return null;
    const n=hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
    if(n.y<.95)return null;hits.push(hit.point.y);
  }
  if(Math.max(...hits)-Math.min(...hits)>.055)return null;
  return Math.max(...hits)+.012;
}

export function addRoofFacilities(world,placements){
  const kit=createRoofFacilityKit(),batches=new Map(),dummy=new THREE.Object3D();
  const stats={count:0,types:{},batches:0,nearHelipads:0,helipadStyles:{},overgrownHelipads:0,padLayouts:[]};
  const occupiedPads=[];
  const hashAt=f=>(Math.imul(Math.round(f.x*17),73856093)^Math.imul(Math.round(f.z*13),19349663))>>>0;
  const overlap=(a,b,gap=.45)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap;
  function find(root,f,type,scale,zones,hash,singlePosition=false){
    const asset=kit.get(type),w=asset.width*scale,d=asset.depth*scale;
    const positions=[[-.23,-.23],[.23,.23],[-.23,.23],[.23,-.23],[0,0],[0,.29],[.29,0],[0,-.29],[-.29,0],
      [-.36,-.36],[.36,.36],[-.36,.36],[.36,-.36],[0,.36],[.36,0],[0,-.36],[-.36,0]];
    for(let i=0;i<(singlePosition?1:positions.length);i++){
      const [u,v]=positions[(i+(hash%positions.length))%positions.length],x=f.x+u*f.w,z=f.z+v*f.d;
      const zone={x,z,w,d};if(zones.some(other=>overlap(zone,other)))continue;
      const y=roofSupport(root,x,z,w+.3,d+.3);if(y===null)continue;
      return {...zone,y,type,scale,asset};
    }
    return null;
  }
  function place(root,item){
    const {asset,type,x,y,z,scale,w,d}=item,key=`${type}:${Math.floor(x/112)}:${Math.floor(z/112)}`;
    if(!batches.has(key))batches.set(key,{asset,matrices:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(scale);dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());
    root.userData.roofEquipmentZones.push({x,z,w:w+.6,d:d+.6,y,type});
    const category=type.startsWith('helipad')?'helipad':type;
    stats.count++;stats.types[category]=(stats.types[category]??0)+1;
  }
  // Coordinate-hashed order prevents the input's near-to-far order from giving
  // the camp first claim on every landing pad. Enforce city-wide separation.
  const ordered=placements.filter(p=>!p.root.userData.coverageBackdrop).sort((a,b)=>(hashAt(a.footprint)%65521)-(hashAt(b.footprint)%65521));
  ordered.forEach(({root,footprint:f})=>{
    const hash=(Math.imul(Math.round(f.x*17),73856093)^Math.imul(Math.round(f.z*13),19349663))>>>0;
    let clearDeck=false;root.traverse(o=>{if(o.userData.helipadDeck)clearDeck=true;});
    root.userData.roofEquipmentZones=[];root.userData.roofPadGrowth=[];
    let authored=false;
    root.updateMatrixWorld(true);
    root.traverse(node=>{
      if(!node.userData.authoredRoofServices)return;
      authored=true;
      for(const zone of node.userData.serviceZones??[]){
        const box=new THREE.Box3(new THREE.Vector3(zone.x-zone.w/2,0,zone.z-zone.d/2),new THREE.Vector3(zone.x+zone.w/2,1,zone.z+zone.d/2)).applyMatrix4(node.matrixWorld);
        const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
        root.userData.roofEquipmentZones.push({x:center.x,z:center.z,w:size.x+.3,d:size.z+.3,y:box.min.y,type:zone.type});
      }
    });
    if(authored)return; // Do not stack automatic pads/equipment on the authored roof.
    const distance=Math.hypot(f.x-13,f.z-20);
    const padAllowed=Math.min(f.w,f.d)>6.4&&(hash%100<(clearDeck?90:45))
      &&(distance>=100||stats.nearHelipads<2)
      &&occupiedPads.every(p=>Math.hypot(f.x-p.x,f.z-p.z)>58);
    let padPlaced=false;
    if(padAllowed){
      const style=['helipad','helipad-round','helipad-abandoned'][(hash>>>5)%3];
      const targetScale=[.68,.82,1,1.16][(hash>>>9)%4];
      padSearch:for(const scale of [targetScale,targetScale*.84])for(let layoutChoice=0;layoutChoice<17;layoutChoice++){
        if(scale<.58)continue;
        const pad=find(root,f,style,scale,[],hash+layoutChoice,true);if(!pad)continue;
        if(occupiedPads.some(p=>Math.hypot(pad.x-p.x,pad.z-p.z)<58))continue;
        // A pad is accepted only with a separately supported service structure.
        let service=null;
        const serviceTypes=['hvac','water-tank','satellite','lattice-mast'];
        for(let serviceIndex=0;serviceIndex<serviceTypes.length;serviceIndex++){
          const type=serviceTypes[(serviceIndex+(hash>>>16))%serviceTypes.length];
          service=find(root,f,type,.65+((hash>>>13)%3)*.10,[pad],hash+3);if(service)break;
        }
        if(!service)continue;
        place(root,pad);place(root,service);occupiedPads.push(pad);padPlaced=true;
        if(distance<100)stats.nearHelipads++;
        stats.helipadStyles[style]=(stats.helipadStyles[style]??0)+1;
        const overgrown=style==='helipad-abandoned'||hash%4===0;
        if(overgrown)stats.overgrownHelipads++;
        const layout={x:pad.x,z:pad.z,width:pad.w,distance,style,overgrown,companions:1};
        stats.padLayouts.push(layout);
        const extra=find(root,f,['solar','satellite','water-tank'][hash%3],.6,[pad,service],hash+6);
        if(extra){place(root,extra);layout.companions++;}
        if(overgrown){
          for(let i=0;i<160;i++){
            const u=((Math.imul(i+1,16807)+hash)%65521)/65521-.5;
            const v=((Math.imul(i+7,48271)+(hash>>>3))%65521)/65521-.5;
            const radius=Math.hypot(u,v);
            if(style==='helipad-round'&&radius>.46)continue;
            const noise=meadowNoise((pad.x+u*pad.w)*1.1,(pad.z+v*pad.d)*1.1);
            // Lopsided edge colonies creep into old paint, leaving H legible.
            if(Math.max(Math.abs(u),Math.abs(v))<.23||noise+u*.45<.48)continue;
            root.userData.roofPadGrowth.push(new THREE.Vector3(pad.x+u*pad.w*.93,pad.y+.13*scale,pad.z+v*pad.d*.93));
          }
        }
        break padSearch;
      }
    }
    if(padPlaced||hash%7===0)return;
    const type=['hvac','water-tank','solar','lattice-mast','satellite','hvac'][hash%6];
    const asset=kit.get(type),scale=Math.min(1,f.w/(asset.width+1),f.d/(asset.depth+1));
    if(scale<.7||(distance>330&&type==='satellite'))return;
    const first=find(root,f,type,scale,[],hash);if(!first)return;place(root,first);
    let glassFacade=false;root.traverse(o=>{if(o.material?.userData.glassFacade)glassFacade=true;});
    if(glassFacade){
      const zones=[first];
      for(const [i,extraType] of ['hvac','satellite','solar'].entries()){
        if(extraType===type)continue;
        const extra=find(root,f,extraType,.48,zones,hash+7+i*3);
        if(extra){place(root,extra);zones.push(extra);}
        if(zones.length===3)break;
      }
    }else if(hash%3===0){const extra=find(root,f,'satellite',.65,[first],hash+1);if(extra)place(root,extra);}
  });
  for(const [key,{asset,matrices}] of batches){
    const mesh=new THREE.InstancedMesh(asset.geometry,asset.material,matrices.length);mesh.name=`roof-facility-${key}`;mesh.castShadow=mesh.receiveShadow=true;
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingBox();mesh.computeBoundingSphere();world.add(mesh);
  }
  stats.batches=batches.size;return stats;
}
