import * as THREE from 'three';
import {architectureAssets,placeArchitecture,intersectsArchitecture} from './architecture-assets.js';
import {namsanGround} from './seoul-terrain.js';
import {createBuildingKit} from './city-building-kit.js';
import {cleanBuildingGeometry} from './building-surface-cleanup.js';
import {bridgeSideClearing} from './yeouido-landmarks.js';
import {cityCoverageLots} from './city-coverage-lots.js';

export async function loadCityLODs(loader,catalog,baseUrl='/'){
  const lods=new Map();
  await Promise.all(architectureAssets.map(async ({id})=>{
    const source=catalog.get(id);
    if(!source)throw new Error(`Missing city source ${id}`);
    const materials=new Map();source.traverse(o=>{if(o.isMesh)materials.set(o.material.name,o.material);});
    const levels=[source];
    for(const level of [1,2,3]){
      const model=(await loader.loadAsync(`${baseUrl}buildings/lod/${id}-${level}.glb`)).scene;
      model.traverse(o=>{if(o.isMesh){
        const material=materials.get(o.material.name);
        if(!material)throw new Error(`LOD material mismatch ${id}`);
        o.material.dispose();o.material=material;
        cleanBuildingGeometry(o.geometry,{doubleSided:material.side===THREE.DoubleSide});
      }});
      levels.push(model);
    }
    lods.set(id,levels);
  }));
  return lods;
}

// Fixed distance bands are appropriate to this rooftop's limited camera orbit.
// Each district batch has its own bounds so offscreen neighbourhoods are culled.
export function createCityArchitecture(lods,lots,reserved,{mobile=false}={}){
  const exclusions=[...reserved,bridgeSideClearing];
  const root=new THREE.Group();root.name='replaceable-district-city';
  const sources=new Map([...lods,...createBuildingKit()]);
  const skyline=[];
  for(let row=0;row<6;row++)for(let col=-13;col<=12;col++){
    const variation=(row*19+col+30)%7;
    if(variation===0)continue;
    skyline.push({x:col*23+(variation-3)*1.2,z:-268-row*26,w:12+variation*1.3,d:15+variation*.8,h:14+variation*6.8,skyline:true});
  }
  const infill=[];
  for(let row=0;row<7;row++)for(let col=-14;col<=13;col++){
    const variant=(row*11+col+40)%9;
    infill.push({x:col*20+9,z:-49-row*29,w:10.5+variant*.5,d:12,h:12+variant*3.4,kit:true});
  }
  // Keep the approved city intact, then fit narrower buildings into its gaps.
  // Prioritise the visible city canyon, not an invisible extension of the map.
  const densityLots=[];
  for(let row=0;row<43;row++)for(let col=-30;col<=30;col++){
    const variant=(row*17+col+99)%13,x=col*9+(row%2?4.5:0),z=-34-row*9;
    const viewAxis=z*.34+5,nearCorridor=z>-102&&Math.abs(x-viewAxis)<17;
    densityLots.push({x,z,w:6.3+(variant%4)*.45,d:7.0+(variant%3)*.5,
      h:nearCorridor?9+(variant%3)*2:18+(variant%7)*5,
      dense:true,score:Math.abs(x-viewAxis)*.65+(-z-34)*.30});
  }
  densityLots.sort((a,b)=>a.score-b.score||a.z-b.z||a.x-b.x);
  // Broad mid-rise footprints form a tight perimeter around the camp. Use the
  // shortest authored kits so height limits don't shrink them to thin needles.
  const neighbours=[];
  const nearbyX=[-41.4,-29.4,-17.4,-5.7,5.7,17.4,29.4,41.4];
  for(let row=0;row<6;row++)for(let col=0;col<nearbyX.length;col++){
    const x=nearbyX[col],z=-16+row*12;
    if(Math.abs(x)<11&&z>-9&&z<14)continue;
    neighbours.push({x,z,w:11.3,d:11.0,h:23+(row+col)%3,neighbour:true,
      asset:(row*3+col)%7===0?'kit-skeleton-0':(row+col)%3===0?'kit-glass-0':`kit-concrete-${[9,1,10,7][(row+col+100)%4]}`,yaw:0});
  }
  neighbours.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  const closeInfill=[];
  for(let row=0;row<10;row++)for(let col=-7;col<=7;col++){
    const x=col*12+5.7,z=-28+row*12;
    closeInfill.push({x,z,w:11.3,d:11,h:24+(row+col+22)%2,neighbour:true,extraNeighbour:true,
      asset:(row+col+22)%5===0?'kit-skeleton-0':(row+col)%3===0?'kit-glass-0':`kit-concrete-${[9,1,10,7][(row+col+100)%4]}`,yaw:0});
  }
  closeInfill.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  const foothills=[];
  const hillTypes=['apartment-slab','kit-concrete-0','kit-skeleton-0','kit-concrete-4','stone-rib-tower','kit-concrete-8'];
  for(let row=0;row<14;row++)for(let col=0;col<25;col++){
    const variant=(row*13+col*7)%11,x=-170+col*7.3+(row%2)*3.4,z=-155.8-row*5.9;
    const ground=namsanGround(x,z);
    // Lower slopes only: preserve the summit and the tower's green silhouette.
    if(ground<-24||ground>-10.5||Math.hypot(x+82,(z+198)*1.2)<25)continue;
    foothills.push({x,z,w:5.8+variant%3*.5,d:5.2+variant%4*.4,h:13+variant%6*3,
      foothill:true,asset:hillTypes[(row*3+col)%hillTypes.length],yaw:(variant%5-2)*.14});
  }
  const originalLots=[...lots,...skyline,...infill],allLots=[...originalLots,...densityLots,...neighbours,...closeInfill,...foothills,...cityCoverageLots()];
  const placements=[],occupied=[],batches=new Map(),stats={lots:lots.length,skylineLots:skyline.length,infillLots:infill.length,
    buildings:0,baselineBuildings:0,targetBuildings:0,addedBuildings:0,addedNear:0,addedMid:0,addedFar:0,neighbourBuildings:0,foothillBuildings:0,
    coverageBuildings:0,coverageLeft:0,coverageRight:0,coverageTriangles:0,
    kitBuildings:0,concreteBuildings:0,brownBuildings:0,verticalBuildings:0,distantBuildings:0,distantConcrete:0,types:{},excluded:0,batches:0,triangles:0,lodCounts:[0,0,0,0]};
  const water=[{x:0,z:-129,w:620,d:46}];
  for(let i=0;i<allLots.length;i++){
    const lot=allLots[i],variant=(i*13+Math.round(lot.x))>>>0;
    if(lot.extraNeighbour&&stats.neighbourBuildings>=76)continue;
    if(i===originalLots.length){
      stats.baselineBuildings=stats.buildings+reserved.length;
      stats.targetBuildings=stats.baselineBuildings*2;
    }
    if(lot.dense&&stats.buildings+reserved.length>=stats.targetBuildings)continue;
    const skylineType=(i*7+Math.floor(lot.x/25)+100)%5;
    let id=lot.skyline?(skylineType===0?'apartment-slab':skylineType<3?'curved-glass-office':'stone-rib-tower'):
      lot.h>24?(variant%4===0?'curved-glass-office':'stone-rib-tower'):variant%3===0?'apartment-slab':variant%3===1?'curved-glass-office':'stone-rib-tower';
    if(lot.kit||lot.skyline&&i%3!==0||!lot.skyline&&i%6===2)id=`kit-${variant%3===0?'skeleton':'glass'}-${Math.floor(variant/5)%3}`;
    if(lot.dense){
      const type=variant%5;
      id=type===0?`kit-skeleton-${Math.floor(variant/5)%3}`:type===1?`kit-glass-${Math.floor(variant/5)%3}`:
        type===2?'curved-glass-office':type===3?'stone-rib-tower':'apartment-slab';
    }
    const distance=Math.hypot(lot.x-13,lot.z-20);
    if(!lot.asset&&variant%10<(distance>150?7:4))id=`kit-concrete-${Math.floor(variant/10)%9}`;
    if(lot.asset)id=lot.asset;
    if(id.startsWith('kit-concrete-')){
      const original=Number(id.split('-').at(-1));
      const mix=(Math.imul(Math.round(lot.x*11),73856093)^Math.imul(Math.round(lot.z*17),19349663))>>>0;
      if(original<9){
        if(mix%100<38&&!lot.neighbour)id=`kit-concrete-${9+(mix>>>8)%4}`;
        else if(original%3===0&&(distance<140||mix%3!==0))id=`kit-concrete-${original+1}`;
      }
    }
    const level=lot.coverage?(distance<100&&!mobile?1:3):mobile?(distance<80?2:3):lot.dense?(distance<90?1:distance<175?2:3):(distance<115?1:distance<215?2:3);
    const yaw=lot.yaw??((id==='curved-glass-office'?0:-Math.PI/2)+(variant%5-2)*(lot.skyline?.12:.045)+(lot.skyline&&variant%7===0?Math.PI:0));
    const slot={id,x:lot.x,z:lot.z,height:lot.neighbour?Math.min(25,lot.h):Math.max(lot.dense?9:12,lot.h*1.18),width:lot.neighbour||lot.dense||lot.skyline||lot.foothill?lot.w:Math.min(12.4,lot.w*1.25),depth:lot.neighbour||lot.dense||lot.skyline||lot.foothill?lot.d:Math.min(15,lot.d*1.25),yaw};
    if(lot.foothill){
      const samples=[];
      for(const x of [-.5,0,.5])for(const z of [-.5,0,.5])samples.push(namsanGround(lot.x+x*slot.width,lot.z+z*slot.depth));
      if(Math.max(...samples)-Math.min(...samples)>5.5)continue;
      slot.groundY=Math.min(...samples)-.12;
    }
    let placement=placeArchitecture(sources.get(id)[level],slot);
    // Tall source models were uniformly shrunk to low-rise height limits,
    // leaving 1.6–3m-wide miniature towers with subpixel window grids.
    // Fit a shorter authored building before occupancy/growth/batching checks.
    if(id.startsWith('kit-')&&Math.min(placement.footprint.w,placement.footprint.d)<2.4){
      id=id.startsWith('kit-glass')?'kit-glass-0':id.startsWith('kit-skeleton')?'kit-skeleton-0':'kit-concrete-9';
      slot.id=id;placement=placeArchitecture(sources.get(id)[level],slot);
      placement.root.userData.smallLotRefit=true;
    }
    const f=placement.footprint;
    if(lot.foothill&&f.roofY<namsanGround(f.x,f.z)+4.2){stats.excluded++;continue;}
    const onHill=lot.dense||lot.coverage?
      (Math.pow(Math.max(0,Math.abs(f.x+82)-f.w/2)/53,2)+Math.pow(Math.max(0,Math.abs(f.z+198)-f.d/2)/38,2))<1:
      (Math.pow((f.x+82)/51,2)+Math.pow((f.z+198)/36,2))<1;
    const camp={x:0,z:0,w:20.7,d:15.7};
    if((onHill&&!lot.foothill)||intersectsArchitecture(f,water,.45)||intersectsArchitecture(f,exclusions,1)||intersectsArchitecture(f,occupied,.5)||intersectsArchitecture(f,[camp],1.2)){
      stats.excluded++;continue;
    }
    placement.root.userData.growthSamples=lot.dense?(distance<130?36:distance<210?22:12):(distance<130?65:distance<210?38:22);
    if(lot.coverage){
      placement.root.userData.coverage=true;
      // Existing district trees supply the distant canopy. Avoid hundreds of
      // additional roof raycasts, ivy layers and subpixel service meshes.
      placement.root.userData.coverageBackdrop=distance>150;
      placement.root.userData.growthSamples=distance>150?0:18;
      stats.coverageBuildings++;stats[f.x<0?'coverageLeft':'coverageRight']++;
    }
    placement.root.userData.district=true;placements.push(placement);occupied.push(f);
    if(lot.dense){stats.addedBuildings++;stats[distance<130?'addedNear':distance<230?'addedMid':'addedFar']++;}
    if(lot.neighbour){stats.neighbourBuildings++;placement.root.userData.campNeighbour=true;}
    if(lot.foothill){stats.foothillBuildings++;placement.root.userData.foothill=true;}
    stats.buildings++;stats.lodCounts[level]++;
    if(id.startsWith('kit-concrete')){stats.concreteBuildings++;const style=Number(id.split('-').at(-1));if(style<9&&style%3===0)stats.brownBuildings++;if(style>=9)stats.verticalBuildings++;}
    if(distance>150){stats.distantBuildings++;if(id.startsWith('kit-concrete'))stats.distantConcrete++;}
    if(id.startsWith('kit-'))stats.kitBuildings++;
    stats.types[id]=(stats.types[id]??0)+1;
    const tint=new THREE.Color().setRGB(.94+(variant%4)*.018,.96+(variant%3)*.014,.93+(variant%5)*.016);
    placement.root.traverse(o=>{if(!o.isMesh)return;
      const kit=id.startsWith('kit-'),cell=kit?112:56;
      const key=`${id}:${id.startsWith('kit-concrete')?(level<2?1:2):kit?0:level}:${o.geometry.uuid}:${o.material.uuid}:${Math.floor(f.x/cell)}:${Math.floor(f.z/cell)}`;
      if(!batches.has(key))batches.set(key,{geometry:o.geometry,material:o.material,instances:[],cast:distance<210});
      batches.get(key).instances.push({matrix:o.matrixWorld.clone(),tint});
      stats.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
      if(lot.coverage)stats.coverageTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    });
  }
  for(const [key,batch] of batches){
    const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.instances.length);
    mesh.name=`city-architecture-${key}`;mesh.castShadow=batch.cast;mesh.receiveShadow=true;
    batch.instances.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);mesh.setColorAt(i,p.tint);});
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
  stats.batches=batches.size;root.userData.cityArchitecture=stats;
  return {root,placements,footprints:placements.map(p=>p.footprint),stats};
}
