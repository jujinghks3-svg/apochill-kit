import * as THREE from 'three';
import {daylight,dayUniforms} from './daylight-state.js';

const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b);
export function flockPass(seconds){
  const cycle=Math.floor((seconds-16)/92);
  if(cycle<0)return {active:false,cycle};
  const start=16+cycle*92+hash(cycle+4)*12;
  const duration=24+hash(cycle+9)*8,t=(seconds-start)/duration;
  return {active:t>=0&&t<=1,cycle,t,duration,direction:hash(cycle+1)>.5?1:-1,
    visibility:smooth(t,0,.12)*(1-smooth(t,.85,1))};
}
export function butterflyPresence(hour,rain){
  const h=((hour%24)+24)%24;
  return smooth(h,7,8)*(1-smooth(h,17,18))*(1-smooth(rain,.2,.75));
}
// Flower patches away from the tent, work desk, fire and roof access building.
const gardens=[[-8,-4.7],[-3.5,5.9],[5.8,5.8],[7,-5.8],[-4,-5.4]];
export function butterflyPose(index,seconds){
  const [x,z]=gardens[index%gardens.length],phase=hash(index+30)*Math.PI*2;
  const speed=.5+hash(index+41)*.3,a=seconds*speed+phase;
  const radius=.48+hash(index+82)*.43;
  const flutter=Math.sin(seconds*1.7+phase);
  const dx=-Math.sin(a)*radius*speed,dz=Math.cos(a*1.31)*radius*.65*1.31*speed;
  return {x:x+Math.cos(a)*radius,y:1.15+hash(index+6)*.5+Math.sin(a*1.6)*.27+flutter*.09,
    z:z+Math.sin(a*1.31)*radius*.65,yaw:Math.atan2(dx,dz),bank:Math.sin(a+phase)*.24,
    scale:.54+hash(index+70)*.24};
}

function butterflyGeometry(){
  const positions=[],colors=[];
  const triangle=(a,b,c,color)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(...color);};
  const outline=[[.025,.12],[.15,.23],[.28,.19],[.27,.07],[.18,.015],[.22,-.09],[.14,-.18],[.04,-.15],[.018,-.03]];
  for(const side of [-1,1]){
    const center=[side*.048,0,.015];
    const points=outline.map(([x,z])=>[x*side,0,z]);
    const inner=points.map(p=>[center[0]+(p[0]-center[0])*.82,0,center[2]+(p[2]-center[2])*.82]);
    for(let i=0;i<points.length;i++){
      const j=(i+1)%points.length;
      triangle(center,inner[i],inner[j],i%3===0?[1,.95,.77]:[1,1,1]);
      triangle(inner[i],points[i],points[j],[.24,.25,.23]);
      triangle(inner[i],points[j],inner[j],[.24,.25,.23]);
      // Thin radial veins, built into the same mesh rather than separate lines.
      triangle(center,inner[i],[inner[i][0]+side*.006,0,inner[i][2]+.012],[.48,.43,.30]);
    }
  }
  triangle([0,.006,.15],[-.019,.006,-.14],[.019,.006,-.14],[.17,.19,.18]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

export function createRooftopWildlife({mobile=false}={}){
  const root=new THREE.Group();root.name='rooftop-wildlife';
  const time={value:0},dummy=new THREE.Object3D();
  const birdCount=mobile?12:22,butterflyCount=mobile?7:13;
  const birdGeometry=new THREE.BufferGeometry();
  birdGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,.35,-.10,0,-.30,.10,0,-.30,0,0,.12,-.8,0,-.2,-.22,0,-.27,
    0,0,.12,.22,0,-.27,.8,0,-.2],3));birdGeometry.computeVertexNormals();
  birdGeometry.setAttribute('wingPhase',new THREE.InstancedBufferAttribute(Float32Array.from({length:birdCount},(_,i)=>hash(i+12)*6.28),1));
  const birdMaterial=new THREE.MeshBasicMaterial({color:'#354244',side:THREE.DoubleSide,fog:true,transparent:true,depthWrite:false});
  birdMaterial.onBeforeCompile=shader=>{
    shader.uniforms.wildlifeTime=time;
    shader.vertexShader='uniform float wildlifeTime;attribute float wingPhase;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float flap=sin(wildlifeTime*7.4+wingPhase);
      float glide=smoothstep(-.35,.35,sin(wildlifeTime*.7+wingPhase));
      transformed.y+=abs(position.x)*mix(.09,flap*.63,glide);`);
  };
  birdMaterial.customProgramCacheKey=()=> 'apochill-passing-flock-v1';
  const birds=new THREE.InstancedMesh(birdGeometry,birdMaterial,birdCount);
  birds.name='intermittent-bird-flock';birds.frustumCulled=false;birds.visible=false;
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(birds);

  const geometry=butterflyGeometry();
  geometry.setAttribute('wingPhase',new THREE.InstancedBufferAttribute(Float32Array.from({length:butterflyCount},(_,i)=>hash(i+19)*6.28),1));
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:true,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.wildlifeTime=time;shader.uniforms.wildlifeTint=dayUniforms.daySurfaceTint;
    shader.vertexShader='uniform float wildlifeTime;attribute float wingPhase;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float angle=.28+(.5+.5*sin(wildlifeTime*(17.+sin(wingPhase)*3.)+wingPhase))*1.02;
      if(abs(position.x)>.02){transformed.x=position.x*cos(angle);transformed.y+=abs(position.x)*sin(angle);}`);
    shader.fragmentShader='uniform vec3 wildlifeTint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.82),wildlifeTint,.65);');
  };
  material.customProgramCacheKey=()=> 'apochill-day-butterflies-v1';
  const butterflies=new THREE.InstancedMesh(geometry,material,butterflyCount);
  butterflies.name='daytime-rooftop-butterflies';butterflies.frustumCulled=false;
  butterflies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette=['#ffe8a5','#e9efda','#a6d5df','#efbe76'];
  for(let i=0;i<butterflyCount;i++)butterflies.setColorAt(i,new THREE.Color(palette[i%palette.length]));
  root.add(butterflies);
  let visibility=butterflyPresence(daylight.hour,0),last=null;
  function update(seconds,rain){
    const dt=last===null?0:THREE.MathUtils.clamp(seconds-last,0,.1);last=seconds;time.value=seconds;
    const pass=flockPass(seconds);birds.visible=pass.active&&rain<.85;
    if(birds.visible){
      const direction=pass.direction,cycle=pass.cycle;
      birds.count=Math.min(birdCount,8+Math.floor(hash(cycle+62)*(birdCount-7)));
      birdMaterial.opacity=pass.visibility*(1-smooth(rain,.4,.85));
      for(let i=0;i<birds.count;i++){
        const rank=Math.ceil(i/2),side=i%2?1:-1,phase=hash(i+8)*6.28;
        const px=direction*(-225+pass.t*450-rank*2.6);
        const pz=-140-hash(cycle+55)*45+side*rank*2.1+Math.sin(pass.t*4+phase)*1.2;
        dummy.position.set(px,32+hash(cycle+2)*11+Math.sin(pass.t*3+phase)*1.5+i%3*.55,pz);
        dummy.rotation.set(0,direction*Math.PI/2,Math.sin(seconds*.7+phase)*.12);
        dummy.scale.setScalar(.63+hash(i+4)*.28);dummy.updateMatrix();birds.setMatrixAt(i,dummy.matrix);
      }
      birds.instanceMatrix.needsUpdate=true;
    }
    const target=butterflyPresence(daylight.hour,rain);
    // Night is strictly empty, including when a visitor moves the time slider.
    visibility=daylight.hour<7||daylight.hour>=18?0:THREE.MathUtils.damp(visibility,target,2,dt);
    butterflies.visible=visibility>.01;material.opacity=visibility;
    if(butterflies.visible){
      for(let i=0;i<butterflyCount;i++){
        const p=butterflyPose(i,seconds);
        dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(Math.sin(seconds*.8+i)*.10,p.yaw,p.bank);
        dummy.scale.setScalar(p.scale);dummy.updateMatrix();butterflies.setMatrixAt(i,dummy.matrix);
      }
      butterflies.instanceMatrix.needsUpdate=true;
    }
    root.userData.activeBirds=birds.visible?birds.count:0;
    root.userData.activeButterflies=butterflies.visible?butterflyCount:0;
  }
  update(0,0);
  return {root,update,birdCount,butterflyCount};
}
