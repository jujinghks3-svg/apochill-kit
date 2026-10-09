import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createRetroMaterials } from './retro-materials.js';
import { addDaylightDetails } from './daylight-details.js';
import { createPaintedSky } from './painted-sky.js';
import { addRuinCraft } from './ruin-craft.js';
import { addRoofMeadow, natureTime } from './painted-nature.js';
import { addCityForest } from './city-forest.js';
import { createMeadowGround } from './meadow-ground.js';
import { createWorldMeadowSurface, addWorldMeadow } from './world-meadow.js';
import { createCityGrowthMaterials, attachGrowthAttributes, addCityVegetation } from './city-vegetation.js';
import { addDistantLandscape } from './distant-landscape.js';
import { intersectsArchitecture } from './architecture-assets.js';
import {weatherMaterial} from './surface-weathering.js';
import {addVines} from './branch-foliage.js';
import {createStylizedWater} from './stylized-water.js';
import {applyDayTint,daylight} from './daylight-state.js';
import {CONCEPT,conceptToneInput} from './concept-palette.js';
import {campIvyTrails} from './camp-ivy.js';
import {namsanHeight,FLOOD_LEVEL} from './seoul-terrain.js';
import {createShoreField} from './water-shore-field.js';
import {addDongjakBridge} from './dongjak-bridge.js';

// An imagined Seoul, composed for a quiet rooftop view rather than a geographic map.
export function createSeoulScene({architectureFootprints=[],populateArchitecture}={}) {
  const world = new THREE.Group();
  const animated = [];
  let seed = 71423;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: false, ...extra });
  const retro = createRetroMaterials();
  const worldMeadowSurface = createWorldMeadowSurface();
  const concrete = weatherMaterial(retro('#bcbcad'));
  const edge = weatherMaterial(retro('#818b83'));
  const dark = weatherMaterial(retro('#5c676b', 'metal', .4),{strength:1.2,scale:3});
  const wood = weatherMaterial(mat('#9a6550'),{strength:1.15,scale:3});
  const sage = weatherMaterial(retro('#899380', 'metal', .4),{strength:1.2,scale:3});
  const leaves = [mat('#368b45'), mat('#78b948'), mat('#a3ca55')];
  const clay = weatherMaterial(mat('#ad7058'),{strength:1,scale:3});
  const gold = mat('#f2d99b', { emissive: '#ffad48', emissiveIntensity: .08 });
  const mesh = (geometry, material, x, y, z, parent = world) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (w, h, d, material, x, y, z, parent) => mesh(z > -20 && Math.min(w,h,d) > .08 ? new RoundedBoxGeometry(w,h,d,2,Math.min(.08,w*.12,h*.12,d*.12)) : new THREE.BoxGeometry(w,h,d), material, x,y,z,parent);
  const rod = (a, b, radius, material, parent = world) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material, ...start.clone().add(end).multiplyScalar(.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  };

  const sky = createPaintedSky();
  world.add(sky);
  animated.push(sky.userData.animate, (t) => { natureTime.value = t; });

  // Retain the old random sequence so the existing city layout does not change.
  for(let i=0;i<93;i++)random();
  addDistantLandscape(world);

  box(650, 1, 520, worldMeadowSurface(retro(CONCEPT.grass[1], 'asphalt', .2)), 0, -28.7, -185);
  const waterMaterial = createStylizedWater({center:[0,-190],halfSize:[325,275]});
  const river = mesh(new THREE.PlaneGeometry(650, 550,260,220), waterMaterial, 0, FLOOD_LEVEL, -190);
  river.geometry.computeBoundingBox();river.geometry.boundingBox.expandByScalar(.5);
  river.geometry.computeBoundingSphere();river.geometry.boundingSphere.radius+=.5;
  river.rotation.x = -Math.PI / 2; river.castShadow = false; river.receiveShadow = false;
  river.name='han-river';

  // Thousands of facade pieces share a small number of instanced draw calls.
  const cityParts = [];
  const brickParts = [];
  const cityBuildings = [];
  let activeGrowth = null;
  const windows = [];
  const addCity = (x, y, z, w, h, d, color) => cityParts.push({ x, y, z, w, h, d, color, growth: activeGrowth });
  const palette = ['#b2cad1', '#c0cec1', '#dddcbe', '#d5dfd8', '#90b6c5', '#c2d1c8', '#93b9b6'];
  for (let row = 0; row < 13; row++) {
    const z = -27 - row * 18;
    if (z < -103 && z > -157) continue;
    for (let col = -10; col <= 10; col++) {
      if (random() < .12) continue;
      const x = col * 14 + (random() - .5) * 4;
      const w = 6 + random() * 5;
      const d = 7 + random() * 5;
      let h = 7 + random() * 23;
      if (row > 7) h += random() * 21;
      // Keep a low neighbourhood along the viewing axis so the river is visible below.
      if (Math.abs(x - (z * .32 + 5)) < 35 && row < 5) h = row < 3 ? 5 + random() * 8 : 3.5 + random() * 3;
      const color = palette[Math.floor(random() * palette.length)];
      const ruined = (row + col + 20) % 4 === 0 && h > 12;
      const solidHeight = ruined ? h * .48 : h;
      activeGrowth={x,z,w,h:solidHeight,d,roofY:-28+solidHeight+(ruined?.36:.6),variant:(row*7+col+32)%16,overgrown:false};
      cityBuildings.push(activeGrowth);
      if (row < 5 && (row + col) % 4 === 0) brickParts.push({ x, y: -28 + solidHeight / 2, z, w, h: solidHeight, d, color: '#d8c8af', growth:activeGrowth });
      else addCity(x, -28 + solidHeight / 2, z, w, solidHeight, d, color);
      if (ruined) {
        for (let level = solidHeight; level < h; level += 3) {
          const survivingWidth = w * (1 - (level / h) * .24);
          // Seat the slab on the wall top instead of overlapping its outer faces.
          addCity(x - (w - survivingWidth) / 2, -28 + level + .17, z, survivingWidth, .34, d, '#d7ded4');
          for (const side of [-1, 1]) addCity(x - w * .32, -26.33 + level, z + side * d * .38, .35, 2.66, .35, '#748e94');
        }
      } else addCity(x, -27.7 + h, z, w + .5, .6, d + .5, '#d2dacf');
      addCity(x - w * .15, -27.2 + h, z, w * .42, .9, d * .38, '#647775');
      if (random() > .65) addCity(x + w * .26, -26.6 + h, z + 1, 1.5, 2, 1.8, '#7a7776');
      const floors = Math.floor((solidHeight - 2) / 2.5);
      for (let floor = 0; floor < floors; floor++) {
        if(row<8 && floor%2===0) {
          addCity(x,-27.1+floor*2.5,z+d/2+.13,w+.18,.18,.32,'#8e9e94');
          if((row+col+floor)%3===0) {
            addCity(x+w*.23,-27+floor*2.5,z+d/2+.65,w*.48,.16,1.3,'#b3b9a7');
            addCity(x+w*.23,-26.5+floor*2.5,z+d/2+1.25,w*.48,.8,.14,'#9aa698');
          }
        }
        for (let column = 0; column < 3; column++) {
          const lit = random() > .94;
          const windowColor = lit ? '#a5dae1' : (random() > .7 ? '#6c9faa' : '#274d60');
          const brokenWindow=(floor * 7 + column * 3 + row + col + 30) % 13 === 0;
          // Glass front at +.115 stays behind the trim front at +.13.
          windows.push({ x: x + (column - 1) * w * .25, y: -26 + floor * 2.5, z: z + d / 2 + .085,
            w: w * (brokenWindow?.21:.13), h: brokenWindow?1.7:1.15, d: .06,
            color: brokenWindow?'#4d625f':windowColor, growth:activeGrowth });
          windows.push({ x: x + w / 2 + .10, y: -26 + floor * 2.5, z: z + (column - 1) * d * .25, w: .06, h: 1.15, d: d * .13, color: windowColor, growth:activeGrowth });
          if(row<4) {
            addCity(x+(column-1)*w*.25,-26.65+floor*2.5,z+d/2+.13,w*.15,.11,.25,'#a2a799');
            if((floor+column)%5===0) addCity(x+(column-1)*w*.25,-26+floor*2.5,z+d/2+.09,w*.15,.22,.08,'#847859');
          }
        }
      }
      activeGrowth.overgrown = random() > .08;
      if (activeGrowth.overgrown) {
        // Preserve the established architectural layout while using a separate
        // vegetation seed: the retired ivy generator consumed 153 random draws.
        for(let draw=0;draw<153;draw++)random();
      }
      if (row < 4 && random() > .64) { // Missing upper chunks, exposed roof stubs.
        addCity(x + w * .28, -26.8 + h, z, w * .4, 1.5, .22, '#7e7c77');
        addCity(x - w * .35, -27.2 + h, z - d * .35, .22, 2.5, .22, '#4d555a');
        addCity(x - w * .2, -27 + h, z - d * .35, .22, 2.8, .22, '#4d555a');
      }
    }
  }
  activeGrowth = null;
  // Remove facade pieces AND their roof/ivy anchors from replacement lots.
  // Keep all random draws above unchanged so unrelated city blocks stay put.
  const district=populateArchitecture?.(cityBuildings);
  if(district)world.add(district.root);
  for(const building of cityBuildings)building.replaced=Boolean(district)||intersectsArchitecture(building,architectureFootprints);
  const visibleBuildings=cityBuildings.filter(b=>!b.replaced).concat(architectureFootprints,district?.footprints??[]);
  // Removed the old repeated ground-road ribbons and lane markers.
  const instantiate = (parts, material, shadows = false, geometry = new THREE.BoxGeometry(1, 1, 1)) => {
    parts=parts.filter(p=>!p.growth?.replaced);
    if(parts.some(p=>p.growth))attachGrowthAttributes(geometry,parts);
    const instance = new THREE.InstancedMesh(geometry, material, parts.length);
    const transform = new THREE.Object3D();
    parts.forEach((p, i) => {
      transform.position.set(p.x, p.y, p.z); transform.scale.set(p.w, p.h, p.d); transform.updateMatrix();
      instance.setMatrixAt(i, transform.matrix); instance.setColorAt(i, new THREE.Color(p.color));
    });
    instance.castShadow = shadows; instance.receiveShadow = shadows;
    world.add(instance); return instance;
  };
  const cityGrowth=createCityGrowthMaterials();
  instantiate(cityParts, worldMeadowSurface(cityGrowth(retro('#ffffff')),true),true);
  instantiate(brickParts, worldMeadowSurface(cityGrowth(retro('#ffffff', 'brick', .32)),true),true);
  instantiate(windows, cityGrowth(mat('#ffffff', { roughness: .8 }))).receiveShadow=true;
  addCityVegetation(world, visibleBuildings);

  // Preserve the environment seed sequence while tree placement uses its own seed.
  for(let i=0;i<95*12;i++)random();
  // An exposed concrete frame breaks the otherwise regular residential silhouette.
  if(!district){
  box(8, 13, 9, edge, 27, -21.5, -48);
  for (const y of [-14, -10.8, -7.6]) {
    box(8.5, .38, 9.5, concrete, 27, y, -48);
    for (const x of [23.5, 27, 30.5]) for (const z of [-51.8, -44.2]) box(.4, 2.82, .4, concrete, x, y + 1.6, z);
  }
  const broken = box(4, .35, 3.4, concrete, 29, -4.6, -49); broken.rotation.z = -.23;
  }

  addDongjakBridge(world);
  const shore=createShoreField([...architectureFootprints,...district?.footprints??[]]);
  waterMaterial.uniforms.shoreField.value=shore.texture;
  waterMaterial.uniforms.shoreBounds.value.copy(shore.bounds);
  waterMaterial.uniforms.shoreReady.value=1;
  world.userData.waterShore={width:shore.width,height:shore.height,obstacles:architectureFootprints.length+(district?.footprints.length??0),method:'oriented-polygon-distance-field',waves:'3 displaced swells + 4 filtered ripple bands + advected foam'};

  // Recognisable stylised silhouettes: a Namsan hill/tower and a tapering eastern tower.
  const hillHeight = namsanHeight;
  const hillGeometry = new THREE.PlaneGeometry(112,84,56,42); hillGeometry.rotateX(-Math.PI/2);
  const hillPositions=hillGeometry.attributes.position, hillColors=[];
  for(let i=0;i<hillPositions.count;i++) {
    const x=hillPositions.getX(i),z=hillPositions.getZ(i),height=hillHeight(x,z);
    hillPositions.setY(i,height);
    // A darker olive ground joins the billboard canopy without a pale hill base.
    const tint=conceptToneInput('#596e5d').lerp(conceptToneInput('#758957'),Math.max(0,height/36));
    hillColors.push(tint.r,tint.g,tint.b);
  }
  hillGeometry.setAttribute('color',new THREE.Float32BufferAttribute(hillColors,3));hillGeometry.computeVertexNormals();
  const hillMat=new THREE.MeshBasicMaterial({vertexColors:true});applyDayTint(hillMat);
  mesh(hillGeometry,hillMat,-82,-28,-198);
  // Consume the previous hill seed sequence so unrelated camp details stay put.
  for(let i=0;i<500;i++) {
    const x=(random()-.5)*98,z=(random()-.5)*66;
    if(Math.abs(x)<5 && Math.abs(z)<5)continue;
    random();random();
  }
  addCityForest(world,{hillHeight,buildings:visibleBuildings});
  addWorldMeadow(world,{hillHeight,buildings:visibleBuildings});
  const towerMat = mat('#c1b5b0');
  const towerFallback=new THREE.Group();towerFallback.name='replaceable-namsan-placeholder';world.add(towerFallback);
  mesh(new THREE.CylinderGeometry(.65, 1.15, 35, 8), towerMat, -82, 18, -198,towerFallback);
  mesh(new THREE.CylinderGeometry(4.4, 3.8, 3.3, 12), dark, -82, 31, -198,towerFallback);
  mesh(new THREE.CylinderGeometry(4.6, 4.6, .7, 12), towerMat, -82, 33, -198,towerFallback);
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 10), towerMat, -82, 35, -198,towerFallback);
  rod([-82, 37, -198], [-82, 46, -198], .18, towerMat,towerFallback);
  // Eastern tapering landmark removed at the art director's request.

  // Foreground rooftop: the warm, inhabited refuge above the abandoned city.
  const campSurfaceStart=world.children.length;
  box(20, 28, 15, weatherMaterial(retro('#b1a797', 'brick', .32),{strength:1.3}), 0, -14.25, 0);
  box(20.7, .45, 15.7, concrete, 0, -.22, 0);
  const meadowGround=createMeadowGround();
  box(19.7, .06, 14.8, weatherMaterial(meadowGround(retro('#a7aaa0', 'asphalt', .18)),{floor:true,strength:1.5}), 0, .03, 0);
  const meadowSeams=meadowGround(mat('#818b83'),true);
  // Grout marks should read as surface detail, not cast noisy subpixel shadows.
  for (let x = -9; x < 10; x += 2) box(.018, .015, 14.6, meadowSeams, x, .069, 0).castShadow = false;
  for (let z = -6; z < 8; z += 2) box(19.5, .015, .018, meadowSeams, 0, .07, z).castShadow = false;
  box(.32, .9, 15.2, concrete, -10, .45, 0);
  box(.32, .9, 15.2, concrete, 10, .45, 0);
  // Low, intermittently broken parapet leaves the view open.
  for (const [x, width, h] of [[-8, 4, .8], [-3.4, 3, .7], [2, 4, .55], [7.5, 4.7, .85]]) {
    box(width, h, .4, concrete, x, h / 2, -7.5);
    const capLeft=Math.max(-9.82,x-width/2-.05),capRight=Math.min(9.82,x+width/2+.05);
    box(capRight-capLeft, .1, .6, edge, (capLeft+capRight)/2, h + .05, -7.5);
  }
  // Foreground ledge and exposed roof edges give a strong sense of height.
  box(20.5, .15, .55, edge, 0, .06, 7.6);
  for (let floor = 0; floor < 7; floor++) {
    const y=-3.5-floor*3.4;
    box(20.1,.16,.24,edge,0,y-1.12,7.60);
    for (let col = 0; col < 7; col++) {
      const x=-8+col*2.6;
      box(1.65,2.05,.12,dark,x,y,7.57);
      box(1.34,1.76,.04,sage,x,y,7.65);
      for(const side of [-1,1])box(.10,2.10,.22,concrete,x+side*.85,y,7.65);
      box(1.80,.14,.48,concrete,x,y-1.06,7.79);
      box(1.80,.12,.25,concrete,x,y+1.06,7.67);
      box(.065,1.76,.055,dark,x,y,7.70);
    }
  }
  const rug = box(5.3, .045, 3.6, mat('#ac7560'), -.2, .115, -.3);
  rug.rotation.y = -.12;
  for (let stripe = 0; stripe < 7; stripe++) {
    const line = box(5, .015, .05, mat(stripe % 2 ? '#d6bd8e' : '#695e67'), -.2, .147, -1.75 + stripe * .46);
    line.rotation.y = -.12;
    line.castShadow = false;
  }
  // A pair of chairs facing the skyline.
  const chair = (x, z, rotation, name) => {
    const group = new THREE.Group(); group.position.set(x, .12, z); group.rotation.y = rotation; world.add(group);
    group.name=`replaceable-${name}`;
    const canvas = weatherMaterial(mat('#d0b889'),{strength:.65,scale:4});
    box(.9, .07, .85, canvas, 0, .62, 0, group);
    const back = box(.9, .85, .065, canvas, 0, 1.04, .4, group); back.rotation.x = -.16;
    for (const side of [-.46, .46]) {
      rod([side, 0, -.5], [side, .8, .48], .04, dark, group);
      rod([side, 0, .5], [side, .8, -.46], .04, dark, group);
      rod([side, .55, .4], [side, 1.5, .55], .035, dark, group);
      box(.08, .07, .9, wood, side, .94, .06, group);
    }
  };
  chair(.1, -.45, -.12,'chair-left'); chair(2.4, .1, .22,'chair-right');
  box(1.05, .12, .9, wood, 1.1, .6, -1.7);
  for (const x of [.69, 1.51]) for (const z of [-2.04, -1.36]) box(.07, .52, .07, dark, x, .3, z);
  const lantern = (x, y, z, scale = 1) => {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); world.add(group);
    mesh(new THREE.CylinderGeometry(.18, .22, .09, 8), dark, 0, .04, 0, group);
    mesh(new THREE.CylinderGeometry(.13, .13, .3, 8), gold, 0, .23, 0, group);
    mesh(new THREE.ConeGeometry(.24, .17, 8), dark, 0, .45, 0, group);
    for (const side of [-1, 1]) rod([side * .16, .07, 0], [side * .16, .45, 0], .016, dark, group);
    const light = new THREE.PointLight('#ffcf84', .2 * scale, 3, 2); light.position.set(x, y + .35, z); world.add(light);
  };
  lantern(1.18, .67, -1.7, .8); lantern(-3.1, .1, 2, 1.2);
  mesh(new THREE.CylinderGeometry(.12, .1, .22, 10), mat('#e3d3b1'), .76, .78, -1.5);

  // Roof access and old utility objects anchor this as a Seoul rooftop.
  box(3.4, 2.6, 2.6, weatherMaterial(retro('#c0bbab'),{strength:1.4}), -7.4, 1.3, 4.7);
  box(3.7, .18, 2.9, concrete, -7.4, 2.68, 4.7);
  box(1.05, 2.08, .06, weatherMaterial(retro('#8eaaaa', 'metal', .5),{strength:1.55,scale:2}), -7.1, 1.05, 6.02);
  box(.08, .08, .08, gold, -6.76, 1.05, 6.08);
  const solar = box(2.6, .08, 1.8, mat('#334a60', { roughness: .4, metalness: .3 }), 7.1, .55, .5); solar.rotation.x = -.25;
  for (let i = 0; i < 5; i++) box(.025, .02, 1.72, edge, 6 + i * .55, .69, .5).rotation.x = -.25;

  // Vegetation is geometry, not particles; fixed seeds make reloads reproducible.
  const campIvySurface=world.children.slice(campSurfaceStart);
  addRoofMeadow(world);
  for (const x of [-9.2, 8.8]) for (let z = -6.5; z < 6; z += 2.5) {
    box(.08, .023, .7 + random(), dark, x + random() * .4, .081, z).rotation.y = random() * 2;
  }
  addVines(world,campIvyTrails().map(trail=>({...trail,surface:campIvySurface})));
  // Suspended lamps form a delicate foreground line, with no screen UI.
  const cablePoints = [];
  for (const x of [-9.3, 5.7]) rod([x, .1, -4.9], [x, 4.6, -4.9], .045, dark);
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    cablePoints.push(new THREE.Vector3(-9.3 + t * 15, 4.6 - Math.sin(t * Math.PI) * 1.15, -4.9));
  }
  world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cablePoints), new THREE.LineBasicMaterial({ color: '#3f4547' })));
  const hangingGlow=gold.clone();hangingGlow.emissive.set('#ffd087');
  for (let i = 1; i < 12; i++) {
    const t = i / 12; const x = -9.3 + t * 15; const y = 4.6 - Math.sin(t * Math.PI) * 1.15;
    rod([x, y, -4.9], [x, y - .16, -4.9], .015, dark);
    mesh(new THREE.SphereGeometry(.075, 8, 6), hangingGlow, x, y - .21, -4.9);
  }
  // Shared bulb emission plus two broad, shadow-free lights keeps the nightly
  // switch inexpensive even on mobile; intensity changes don't recompile shaders.
  const stringLights=[-5.8,1.8].map(x=>{const l=new THREE.PointLight('#ffcf89',0,9,2);l.position.set(x,3.5,-4.9);world.add(l);return l;});
  animated.push(()=>{
    const hour=daylight.hour;
    const night=Math.max(1-THREE.MathUtils.smoothstep(hour,5.4,7),THREE.MathUtils.smoothstep(hour,17.7,19.2));
    hangingGlow.emissiveIntensity=.03+night*4.2;
    for(const light of stringLights)light.intensity=night*5;
  });
  const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 128;
  const ctx = signCanvas.getContext('2d'); ctx.fillStyle = '#48686a'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#d8c9a3'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('서울  ·  SEOUL', 256, 88);
  const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = mesh(new THREE.PlaneGeometry(5.2, 1.3), mat('#ffffff', { map: signTexture }), -6, -2, 7.56);
  sign.rotation.z = -.06;

  addDaylightDetails(world, { retro,replaceBuildings:Boolean(district) });
  addRuinCraft(world, retro,Boolean(district));
  world.userData.cityBuildingCount = cityParts.length;
  world.userData.architectureReplacement={removedBuildings:cityBuildings.filter(b=>b.replaced).length,placedBuildings:architectureFootprints.length+(district?.stats.buildings??0),oldBlockBuildings:cityBuildings.filter(b=>!b.replaced).length};
  return { world,district,update: (time) => animated.forEach((fn) => fn(time)), tentPosition: new THREE.Vector3(-4.6, .1, .25) };
}
