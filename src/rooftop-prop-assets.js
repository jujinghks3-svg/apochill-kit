import * as THREE from 'three';

// Metre-scale placements matched to apochill-rooftop-concept-v1.png.
// Source P1 assets have arbitrary scale: normalize before applying scene yaw.
export const ROOFTOP_PROPS = [
  {id:'weathered-wood-platform',name:'tent-deck',position:[-4.4,.081,.15],size:[5.2,.11,4.8],yaw:0},
  {id:'weathered-wood-platform',name:'roof-walkway',position:[-7.1,.082,6.75],size:[1.65,.09,1.15],yaw:.04},
  {id:'camp-tent',name:'tent',position:[-4.4,.195,.15],height:2.85,yaw:-.17},
  {id:'camp-chair',name:'chair-left',position:[.1,.155,-.45],height:1.25,yaw:Math.PI/2-.12},
  {id:'camp-chair',name:'chair-right',position:[2.4,.155,.1],height:1.5,yaw:Math.PI/2+.22},
  {id:'survival-storage',name:'supply-case',position:[-7.8,.09,1],length:1.3,yaw:Math.PI/2+.12},
  {id:'survival-storage',name:'stacked-case',position:[-7.78,.76,1],length:1.03,yaw:Math.PI/2-.06},
  {id:'survival-cooler',name:'cooler',position:[3.6,.09,2.85],length:1.35,yaw:Math.PI/2+.07},
  {id:'survival-toolbox',name:'medical-case',position:[4.75,.09,1.75],length:.98,yaw:Math.PI/2-.13},
  {id:'survival-backpack',name:'backpack',position:[-2.55,.09,3.25],height:1.22,yaw:-.25},
  {id:'wooden-camp-table',name:'workbench',position:[4.1,.09,-3.4],length:2.65,yaw:Math.PI/2+.04},
  {id:'survival-toolbox',name:'table-toolbox',position:[3.5,0,-3.42],length:.82,yaw:Math.PI/2+.04},
  {id:'rooftop-water-tank',name:'water-tank',position:[8.4,.09,3.5],height:3.05,yaw:-.55},
];

export function placeRooftopProp(source,slot){
  const root=new THREE.Group();root.name=`replaceable-${slot.name}`;
  const model=source.clone(true);root.add(model);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  if(!size.toArray().every(n=>Number.isFinite(n)&&n>0))throw new Error(`Invalid bounds: ${slot.id}`);
  if(slot.size)root.scale.set(slot.size[0]/size.x,slot.size[1]/size.y,slot.size[2]/size.z);
  else root.scale.setScalar(slot.height?slot.height/size.y:slot.length/Math.max(size.x,size.z));
  root.rotation.y=slot.yaw;
  root.updateMatrixWorld(true);box.setFromObject(root);
  const center=box.getCenter(new THREE.Vector3());
  root.position.set(slot.position[0]-center.x,slot.position[1]-box.min.y,slot.position[2]-center.z);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.updateMatrixWorld(true);
  root.userData.propAsset=slot.id;
  return root;
}

export async function loadRooftopProps(loader,world,base='/'){
  const ids=[...new Set(ROOFTOP_PROPS.map(s=>s.id))],catalog=new Map(),failures=[];
  document.documentElement.dataset.assetStatus='loading';
  // Three concurrent downloads; repeated chairs/crates reuse decoded geometry/textures.
  let next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<ids.length){const id=ids[next++];
    try{catalog.set(id,(await loader.loadAsync(`${base}props/${id}.glb`)).scene);}
    catch(error){failures.push(id);console.warn('[Apochill] Rooftop prop unavailable',id,error.message);}
  }}));
  const placed=[];
  for(const original of ROOFTOP_PROPS){
    if(!catalog.has(original.id))continue;
    const slot={...original,position:[...original.position]};
    if(slot.name==='table-toolbox'){
      const table=placed.find(p=>p.name==='replaceable-workbench');
      if(!table)continue;
      slot.position[1]=new THREE.Box3().setFromObject(table).max.y+.006;
    }
    if(slot.name==='stacked-case'){
      const lower=placed.find(p=>p.name==='replaceable-supply-case');
      if(lower)slot.position[1]=new THREE.Box3().setFromObject(lower).max.y+.004;
    }
    const prop=placeRooftopProp(catalog.get(slot.id),slot);
    const old=world.getObjectByName(prop.name);
    // Keep map and cup on the new tabletop; their local offsets preserve composition.
    if(slot.name==='workbench'&&old){
      const accessories=old.getObjectByName('workbench-accessories');
      if(accessories){world.updateMatrixWorld(true);world.attach(accessories);
        accessories.position.y+=new THREE.Box3().setFromObject(prop).max.y-1.225;}
    }
    old?.removeFromParent();world.add(prop);placed.push(prop);
  }
  const report={loadedTypes:catalog.size,instances:placed.length,failures,
    placements:placed.map(p=>({name:p.name,asset:p.userData.propAsset,bounds:new THREE.Box3().setFromObject(p)}))};
  document.documentElement.dataset.rooftopProps=JSON.stringify(report);
  document.documentElement.dataset.assetStatus=failures.length?'partial':'loaded';
  return report;
}
