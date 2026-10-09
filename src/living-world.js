import * as THREE from 'three';
import {dayUniforms} from './daylight-state.js';
import {createRooftopWildlife} from './rooftop-wildlife.js';

export function createLivingWorld(scene,camera,{mobile=false,rainCount=mobile?650:1600}={}){
  const root=new THREE.Group();root.name='living-flooded-city';scene.add(root);
  let seed=38172;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const time={value:0},fireTime={value:0},rain={value:0};
  const mesh=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;};
  // Safe stone hearth occupies the open part of the rug in front of the chairs.
  const firePosition=new THREE.Vector3(.15,.18,1.5);
  const stone=new THREE.MeshStandardMaterial({color:'#858c7b',roughness:1});
  const charcoal=new THREE.MeshStandardMaterial({color:'#3e3026',roughness:1});
  const ember=new THREE.MeshStandardMaterial({color:'#4c2415',emissive:'#f66c16',emissiveIntensity:1.4,roughness:1});
  mesh(new THREE.CylinderGeometry(.65,.67,.12,18),charcoal,...firePosition.toArray());
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2,m=mesh(new THREE.DodecahedronGeometry(.19,0),stone,firePosition.x+Math.cos(a)*.7,.22,firePosition.z+Math.sin(a)*.7);
    m.scale.set(1.15,.72,.92);m.rotation.set(i*.2,i,0);m.castShadow=true;
  }
  for(let i=0;i<4;i++){
    const log=mesh(new THREE.CylinderGeometry(.09,.13,.92,7),charcoal,firePosition.x,.28+i*.024,firePosition.z);
    log.rotation.set(Math.PI/2,i*1.05,0);log.castShadow=true;
  }
  mesh(new THREE.SphereGeometry(.34,12,6),ember,firePosition.x,.26,firePosition.z).scale.y=.18;
  const flameMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:fireTime,rain},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time,rain;
      void main(){
        float y=vUv.y;float sway=sin(y*9.-time*5.)*.08*y+sin(time*7.+y*17.)*.035;
        float width=(1.-y)*(.27+.055*sin(time*10.+y*27.));
        float edge=abs(vUv.x-.5-sway);
        float shape=(1.-smoothstep(width*.55,width+.015,edge))*smoothstep(0.,.10,y)*(1.-smoothstep(.80,1.,y));
        float core=1.-smoothstep(.04,.20,edge+y*.18);
        vec3 color=mix(vec3(2.9,.28,.012),vec3(4.,2.5,.30),core);
        gl_FragColor=vec4(color,shape*(1.-rain*.4));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const flames=[];
  for(let i=0;i<3;i++){
    const f=mesh(new THREE.PlaneGeometry(.95,1.15),flameMaterial,firePosition.x,.84,firePosition.z);
    f.rotation.y=i*Math.PI/3;flames.push(f);
  }
  const fireLight=new THREE.PointLight('#ffad51',5,5,2);fireLight.position.copy(firePosition).y=.8;root.add(fireLight);
  const smokeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{time,rain,...dayUniforms},
    vertexShader:`attribute float puff;uniform float time;varying float age;varying float shade;
      void main(){age=fract(puff+time*.075);float y=age*4.2;
        vec3 p=position+vec3(sin(puff*31.+age*4.)*.14+age*age*.8,y,cos(puff*19.+age*3.)*.15);
        vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((.23+age*.9)*650./max(1.,-view.z),1.,70.);shade=.8+puff*.2;}`,
    fragmentShader:`varying float age,shade;uniform vec3 daySurfaceTint;uniform float rain;
      void main(){vec2 p=gl_PointCoord*2.-1.;float a=exp(-dot(p,p)*4.)*(1.-smoothstep(.65,1.,length(p)));
        a*=smoothstep(0.,.12,age)*(1.-smoothstep(.35,1.,age))*.14;
        gl_FragColor=vec4(vec3(.49,.51,.48)*shade*daySurfaceTint,a*(1.+rain*.25));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const smokeGeometry=new THREE.BufferGeometry();smokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(24*3),3));
  smokeGeometry.setAttribute('puff',new THREE.Float32BufferAttribute(Array.from({length:24},(_,i)=>i/24),1));
  const smoke=new THREE.Points(smokeGeometry,smokeMaterial);smoke.position.copy(firePosition).y=.65;smoke.frustumCulled=false;root.add(smoke);
  const wildlife=createRooftopWildlife({mobile});root.add(wildlife.root);
  // Fixed-budget GPU rain. Near drops stop at the roof, distant drops at flood level.
  const count=rainCount,positions=[],seeds=[],ends=[];
  for(let i=0;i<count;i++){
    const x=(random()-.5)*95,z=-85+random()*120,phase=random();
    for(let end=0;end<2;end++){positions.push(x,0,z);seeds.push(phase);ends.push(end);}
  }
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  rainGeometry.setAttribute('rainSeed',new THREE.Float32BufferAttribute(seeds,1));rainGeometry.setAttribute('rainEnd',new THREE.Float32BufferAttribute(ends,1));
  const rainMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time,rain,...dayUniforms},
    vertexShader:`uniform float time,rain;attribute float rainSeed,rainEnd;varying float visibility;
      void main(){float floorY=(abs(position.x)<10.5&&abs(position.z)<8.)?.13:-24.1;
        float fall=fract(rainSeed-time*.45);vec3 p=position+vec3((fall-.5)*(.8+rain*2.1),mix(floorY,34.,fall),0.);
        p.y=max(floorY,p.y-rainEnd*(.28+rain*.85));p.x-=rainEnd*(.02+rain*.10);
        vec4 view=modelViewMatrix*vec4(p,1.);visibility=1.-smoothstep(40.,130.,-view.z);
        gl_Position=projectionMatrix*view;}`,
    fragmentShader:`uniform float rain;uniform vec3 daySurfaceTint;varying float visibility;
      void main(){gl_FragColor=vec4(vec3(.72,.83,.87)*daySurfaceTint,smoothstep(0.,.06,rain)*visibility*(.16+rain*.22));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const drops=new THREE.LineSegments(rainGeometry,rainMaterial);drops.frustumCulled=false;root.add(drops);
  document.documentElement.dataset.livingWorld=`up to ${wildlife.birdCount} passing birds · ${wildlife.butterflyCount} daytime butterflies · fire + 24 smoke puffs · ${count} rain streaks`;
  return {root,update(seconds,amount){
    time.value=seconds;fireTime.value=seconds*1.85;rain.value=amount;drops.visible=amount>.005;
    rainGeometry.setDrawRange(0,Math.round(count*THREE.MathUtils.clamp(amount,0,1))*2);
    fireLight.intensity=(4.7+Math.sin(fireTime.value*13.)*.6+Math.sin(fireTime.value*23.)*.35)*(1-amount*.35);
    flames.forEach((f,i)=>{f.scale.y=(.91+.09*Math.sin(fireTime.value*9.+i))*(1-amount*.24);f.position.y=.28+.575*f.scale.y;});
    wildlife.update(seconds,amount);
  },dispose(){scene.remove(root);}};
}
