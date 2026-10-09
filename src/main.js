import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import './style.css';
import { createSeoulScene } from './seoul-scene.js';
import { ART, styleScene } from './art-direction.js';
import { batchStaticScene } from './static-batching.js';
import { createDioramaRendering } from './diorama-rendering.js';
import { createCinematicLighting } from './cinematic-lighting.js';
import { createFallingLeaves } from './falling-leaves.js';
import { loadArchitectureCatalog, architectureSlots, placeArchitecture } from './architecture-assets.js';
import { addArchitectureGreeningAsync } from './architecture-greening.js';
import { loadCityLODs,createCityArchitecture } from './city-architecture.js';
import { mobilePreview,previewPixelRatio,qualityProfile,qualityLevel } from './device-profile.js';
import {setupQuality} from './quality-ui.js';
import {setupTimeOfDay} from './time-of-day-ui.js';
import {loadNamsanLandmark} from './namsan-landmark.js';
import {setupWeather} from './weather-system.js';
import {applyWetSurfaces} from './wet-surfaces.js';
import {createLivingWorld} from './living-world.js';
import {loadYeouidoLandmarks} from './yeouido-landmarks.js';
import {loadRooftopProps} from './rooftop-prop-assets.js';
import {startupStage,setStartupLabel} from './startup-progress.js';
import {createWorkStatus} from './work-status-ui.js';
import {loadRooftopCompanions} from './rooftop-companions.js';
import {createPerformanceStats} from './performance-stats.js';

const canvas = document.querySelector('#scene');
await startupStage('webgl','그래픽 화면을 준비하고 있어요…');
// The postprocessing pipeline owns scene colour; avoid a second multisample framebuffer.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false,powerPreference:mobilePreview?'low-power':'default' });
document.documentElement.dataset.quality=qualityLevel;
renderer.setPixelRatio(previewPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ART.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Current shadow casters and sun are static; wind grass/ivy do not cast shadows.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
const restoreShadows = () => { renderer.shadowMap.needsUpdate = true; lighting.invalidate(); };
canvas.addEventListener('webglcontextrestored', restoreShadows);

const scene = new THREE.Scene();
scene.background = new THREE.Color(ART.fog);
scene.fog = new THREE.FogExp2(ART.fog, ART.fogDensity);
document.documentElement.dataset.pixelation = 'enabled';
document.documentElement.dataset.renderStyle = 'crisp-natural-sunlight-bloom-lens-glare';
document.documentElement.dataset.colourPalette='sampled-rooftop-concept-v1';
document.documentElement.dataset.sunDirection='concept-upper-right-62-82-minus32';
document.documentElement.dataset.vineStyle='irregular-ivy-clusters-engulfed-facades';
document.documentElement.dataset.cloudStyle='dense-multiscale-cumulus';
document.documentElement.dataset.cloudShadows='disabled';
document.documentElement.dataset.atmosphere='distance-haze-0.00165-soft-highlight-bloom';
document.documentElement.dataset.groundRoads='removed';
document.documentElement.dataset.vehicles='removed';
document.documentElement.dataset.ivyPalette='soft-sun-wrap-tree-palette-small-distant-leaves';
document.documentElement.dataset.artDetailPass = 'sculpted-clouds-sky-reflection-broadleaf-trees-flower-drifts';
document.documentElement.dataset.rooftopTrees='3-broadleaf-shared-city-geometry';

const framingFov = (aspect) => THREE.MathUtils.radToDeg(
  2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50) / 2) / Math.min(aspect, 1)),
);
const aspect = window.innerWidth / window.innerHeight;
// The orbit keeps objects metres from the lens; increase distant depth precision.
const camera = new THREE.PerspectiveCamera(framingFov(aspect), aspect, 1, 850);
camera.position.set(13, 12, 20);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 3, -7);
controls.enableDamping = true;
controls.dampingFactor = 0.045;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.025;
controls.minDistance = 23;
controls.maxDistance = 65;
controls.minPolarAngle = 0.92;
controls.maxPolarAngle = 1.52;
controls.minAzimuthAngle = -.35;
controls.maxAzimuthAngle = .78;
controls.enablePan = false;
let interacting = false;
let resumeAt = 0;
controls.addEventListener('start', () => { interacting = true; });
controls.addEventListener('end', () => {
  interacting = false;
  resumeAt = performance.now() + 2500;
});

const lighting=createCinematicLighting(scene,camera,renderer,{mobile:mobilePreview,quality:qualityProfile});

const draco = new DRACOLoader();
draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
draco.setWorkerLimit(mobilePreview?1:2);
const loader = new GLTFLoader().setDRACOLoader(draco);
document.documentElement.dataset.architectureStatus='loading';
await startupStage('assets','건물 모델을 불러오고 있어요…');
const {catalog:architectureCatalog,failures:architectureFailures}=await loadArchitectureCatalog(loader,import.meta.env.BASE_URL);
let cityLODs;
try{cityLODs=await loadCityLODs(loader,architectureCatalog,import.meta.env.BASE_URL);}
catch(error){architectureFailures.push('city-lods');console.warn('[Apochill] City LOD load failed:',error.message);}
const architecturePlacements=[];
for(const slot of (cityLODs?architectureSlots:architectureSlots.slice(0,6))){
  const source=architectureCatalog.get(slot.id);
  if(!source)continue;
  try{architecturePlacements.push(placeArchitecture(source,slot));}
  catch(error){architectureFailures.push(slot.id);console.warn('[Apochill] Architectural bounds invalid:',slot.id);}
}
architecturePlacements.push(...await loadYeouidoLandmarks(loader,import.meta.env.BASE_URL));
const heroFootprints=architecturePlacements.map(p=>p.footprint);
await startupStage('city','서울의 건물과 지형을 배치하고 있어요…');
const seoul = createSeoulScene({architectureFootprints:heroFootprints,
  populateArchitecture:cityLODs?lots=>createCityArchitecture(cityLODs,lots,heroFootprints,{mobile:qualityProfile.cityReduced}):undefined});
for(const placement of architecturePlacements)seoul.world.add(placement.root);
await startupStage('vegetation','건물에 나무와 식생을 배치하고 있어요…');
document.documentElement.dataset.architectureGreening=JSON.stringify(await addArchitectureGreeningAsync(seoul.world,[...architecturePlacements,...seoul.district?.placements??[]],{mobile:mobilePreview,growthDensity:qualityProfile.growthDensity,vineDistance:qualityProfile.vineDistance,
  onProgress:({done,total})=>{setStartupLabel(`건물에 식생을 배치하고 있어요… ${Math.round(done/total*100)}%`);}}));
document.documentElement.dataset.cityArchitecture=JSON.stringify(seoul.district?.stats??{});
document.documentElement.dataset.waterShore=JSON.stringify(seoul.world.userData.waterShore);
document.documentElement.dataset.cityForest=JSON.stringify(seoul.world.userData.cityForest);
document.documentElement.dataset.foliageStyle='soft-wrap-light-rounded-crowns-subtle-transmission';
document.documentElement.dataset.mountainForest=JSON.stringify(seoul.world.userData.mountainForest);
document.documentElement.dataset.surfaceWeathering='material-layer-cracks-stains-peeling';
document.documentElement.dataset.architectureStatus=architectureFailures.length?'partial':architectureCatalog.size?'loaded':'unavailable';
document.documentElement.dataset.architectureAssets=String(architectureCatalog.size);
document.documentElement.dataset.architecturePlacements=String(architecturePlacements.length+(seoul.district?.stats.buildings??0));
document.documentElement.dataset.architectureReplacement=JSON.stringify(seoul.world.userData.architectureReplacement);
const fallingLeaves=createFallingLeaves(seoul.world);
scene.add(seoul.world);
await loadNamsanLandmark(loader,seoul.world,import.meta.env.BASE_URL);
await loadRooftopProps(loader,seoul.world,import.meta.env.BASE_URL);
await startupStage('batching','장면을 정리하고 있어요…');
batchStaticScene(seoul.world);
let companions=null;
try{
  await startupStage('companions','옥상에 캠프 동료들을 배치하고 있어요…');
  companions=await loadRooftopCompanions(loader,seoul.world,import.meta.env.BASE_URL);
  document.documentElement.dataset.companions='loaded-seated-idle-and-shiba-walk';
  await startupStage('companions-ready','캠프 동료 준비 완료');
}catch(error){document.documentElement.dataset.companions='unavailable';console.warn('[Apochill] Companions unavailable:',error.message);}
styleScene(seoul.world);
document.documentElement.dataset.wetMaterials=String(applyWetSurfaces(seoul.world));
const livingWorld=createLivingWorld(scene,camera,{mobile:mobilePreview,rainCount:qualityProfile.rainCount});
styleScene(livingWorld.root);
lighting.setup(livingWorld.root);
lighting.setup(seoul.world);
const rendering = createDioramaRendering(renderer,scene,camera,lighting,{mobile:mobilePreview,quality:qualityProfile});
rendering.setPixelation(true);
const timeOfDay=setupTimeOfDay(lighting);
const weather=setupWeather(scene,lighting);
const qualityUi=setupQuality();
const workAnchor=new THREE.Vector3(),dogAnchor=new THREE.Vector3();
const workStatus=createWorkStatus({camera,getAnchor:()=>{
  const anchor=scene.getObjectByName('survivor-status-anchor');
  return anchor?anchor.getWorldPosition(workAnchor):null;
},getDogAnchor:()=>companions?.dog?companions.dog.localToWorld(dogAnchor.set(0,1.38,.22)):null,
isDogOutside:()=>!!companions?.dog&&(!companions.dog.userData.behavior||companions.dog.userData.behavior==='roaming')});
await startupStage('shaders','빛과 재질을 준비하고 있어요…');
await renderer.compileAsync(scene,camera);
await startupStage('first-frame','서울의 옥상으로 들어가는 중…');

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = framingFov(camera.aspect);
  camera.updateProjectionMatrix();
  lighting.resize();
  renderer.setPixelRatio(previewPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  rendering.resize();
}
window.addEventListener('resize', onResize);
// Asset loading can span a phone orientation change before the listener exists.
// Reconcile the canvas and camera with the current viewport before first render.
onResize();
const performanceStats=createPerformanceStats(renderer,{mobile:mobilePreview,quality:qualityLevel});

let previousTime = performance.now();
const benchmarkStart=previousTime,frameSamples=[],callSamples=[],triangleSamples=[];
let elapsed = 0;
let reportedSceneStats = false;
let readyAnnounced=false;
renderer.setAnimationLoop((time) => {
  const frameMs=time-previousTime;
  const delta = Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;
  elapsed += delta;
  controls.autoRotate = !interacting && time >= resumeAt;
  // A gentle ~10° sweep preserves the skyline instead of orbiting behind the roof.
  controls.autoRotateSpeed = .025 * Math.cos(elapsed / 35);
  controls.update(delta);
  seoul.update(elapsed);
  fallingLeaves.update(elapsed);
  timeOfDay.update(time);
  const rainAmount=weather.update(elapsed,delta);
  livingWorld.update(elapsed,rainAmount);
  companions?.update(elapsed);
  lighting.update(elapsed);
  workStatus.update(elapsed);
  rendering.render(elapsed);
  performanceStats.update(time);
  if(!readyAnnounced){readyAnnounced=true;window.dispatchEvent(new Event('apochill-ready'));void startupStage('ready','준비 완료');}
  if(import.meta.env.DEV && time-benchmarkStart>6000 && frameSamples.length<120) {
    frameSamples.push(frameMs);callSamples.push(renderer.info.render.calls);triangleSamples.push(renderer.info.render.triangles);
    if(frameSamples.length===120) {
      const sorted=[...frameSamples].sort((a,b)=>a-b);
      const stats={medianFrameMs:+sorted[60].toFixed(2),p95FrameMs:+sorted[114].toFixed(2),
        calls:[Math.min(...callSamples),Math.max(...callSamples)],triangles:[Math.min(...triangleSamples),Math.max(...triangleSamples)],
        width:canvas.width,height:canvas.height,dpr:renderer.getPixelRatio()};
      document.documentElement.dataset.renderBenchmark=JSON.stringify(stats);
      document.documentElement.dataset.waterReflection=JSON.stringify(scene.getObjectByName('han-river')?.userData.reflection??{});
      console.info('[Apochill] 120-frame browser sample:',JSON.stringify(stats));
    }
  }
  if (import.meta.env.DEV && !reportedSceneStats && elapsed > 2 && document.documentElement.dataset.assetStatus === 'loaded') {
    reportedSceneStats = true;
    console.info('[Apochill] Frame geometry:', JSON.stringify({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }));
  }
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    performanceStats.dispose();
    qualityUi.dispose();
    canvas.removeEventListener('webglcontextrestored', restoreShadows);
    rendering.dispose();
    timeOfDay.dispose();
    weather.dispose();
    workStatus.dispose();
    companions?.dispose();
    window.removeEventListener('resize', onResize);
    controls.dispose();
    draco.dispose();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of [...objectMaterials, object.customDepthMaterial]) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        for (const uniform of Object.values(material.uniforms??{})) if (uniform.value?.isTexture) textures.add(uniform.value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    lighting.dispose();
    livingWorld.dispose();
    renderer.dispose();
  });
}
