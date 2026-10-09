import * as THREE from 'three';
import { natureTime } from './painted-nature.js';
import { paintedAtmosphereGLSL } from './painted-atmosphere.js';
import {dayUniforms} from './daylight-state.js';
import {waterWavesGLSL} from './water-waves.js';

export function createStylizedWater({kind='river',center=[0,-129],halfSize=[310,23]}={}) {
  if(kind==='puddle')return createPuddle(center,halfSize);
  const material=new THREE.ShaderMaterial({
    name:`painted-${kind}-water`,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...dayUniforms,time:natureTime,
      shoreField:{value:null},shoreBounds:{value:new THREE.Vector4(-325,-465,650,550)},shoreReady:{value:0},
      cityReflection:{value:null},reflectionMatrix:{value:new THREE.Matrix4()},reflectionReady:{value:0},
      reflectionTexel:{value:new THREE.Vector2(1,1)},reflectionHeight:{value:0}},
    vertexShader:`varying vec3 vWorld;uniform float time,dayWeatherRain;
      ${waterWavesGLSL}
      #include <fog_pars_vertex>
      void main(){vec4 w=modelMatrix*vec4(position,1.);w.y+=waterSwell(w.xz,time,dayWeatherRain).x;vWorld=w.xyz;
        vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:/* glsl */`
      varying vec3 vWorld;uniform float time,shoreReady;uniform sampler2D shoreField;uniform vec4 shoreBounds;
      uniform sampler2D cityReflection;uniform mat4 reflectionMatrix;
      uniform float reflectionReady,reflectionHeight;uniform vec2 reflectionTexel;
      #include <fog_pars_fragment>
      ${paintedAtmosphereGLSL}
      ${waterWavesGLSL}
      vec2 coastData(vec2 p){
        vec2 uv=(p-shoreBounds.xy)/shoreBounds.zw;
        vec4 fieldSample=texture2D(shoreField,clamp(uv,vec2(.001),vec2(.999)));
        return vec2(mix(64.,dot(fieldSample.rg,vec2(65280.,255.))/1024.,shoreReady),1.-fieldSample.b);
      }
      void ripple(inout vec2 gradient,vec2 p,vec2 direction,float k,float amplitude,float speed){
        vec2 d=normalize(direction);float phase=dot(p,d)*k-time*speed;
        // Fade unresolved ripples instead of distant glitter / aliasing.
        float resolved=1.-smoothstep(.8,2.8,fwidth(phase));
        gradient+=d*k*amplitude*cos(phase)*resolved;
      }
      void main(){
        vec2 p=vWorld.xz;
        vec2 coast=coastData(p);float shore=coast.x;
        vec2 flow=vec2(time*.19,-time*.11);
        vec2 warp=vec2(skyNoise(p*.27+flow*.21),skyNoise(p*.29-flow*.17+17.))-.5;
        vec3 swell=waterSwell(p,time,dayWeatherRain);
        vec2 gradient=swell.yz;
        vec2 rippled=p+warp*.85;
        ripple(gradient,rippled,vec2(.92,.39),1.31,.042,1.72);
        ripple(gradient,rippled,vec2(-.52,.85),2.47,.022,2.05);
        ripple(gradient,rippled,vec2(.73,-.68),4.65,.012,2.68);
        ripple(gradient,rippled,vec2(.96,.24),8.73,.005,3.55);
        gradient*=1.+dayWeatherRain*.20;
        vec3 n=normalize(vec3(-gradient.x,1.,-gradient.y));
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=.035+.965*pow(1.-max(dot(view,n),0.),5.);
        vec3 reflectedDirection=reflect(-view,n);
        vec3 reflection=paintedAtmosphere(reflectedDirection,time);
        // Broad sky energy approximates roughness filtering, preventing each
        // tiny normal oscillation from drawing a hard white cloud stripe.
        vec3 broadSky=mix(daySkyHorizon,daySkyTop,smoothstep(-.035,.36,reflectedDirection.y));
        reflection=mix(reflection,broadSky,.28);
        vec4 projected=reflectionMatrix*vec4(vWorld.x,reflectionHeight,vWorld.z,1.);
        vec2 mirrorUv=projected.xy/max(projected.w,.0001);
        // Project the mean water plane, then disturb its image with the same
        // wave slopes used for shading. A small cross filter softens glass edges.
        vec2 distortion=vec2(gradient.x,gradient.y)*.014/(1.+length(cameraPosition-vWorld)*.004);
        vec2 sampleUv=mirrorUv+distortion;
        float border=min(min(sampleUv.x,sampleUv.y),min(1.-sampleUv.x,1.-sampleUv.y));
        float captureWeight=reflectionReady*step(.001,projected.w)*smoothstep(.0,.035,border);
        vec2 uv=clamp(sampleUv,reflectionTexel*2.,1.-reflectionTexel*2.);
        vec2 blur=reflectionTexel*(1.1+dayWeatherRain*.8);
        vec3 city=texture2D(cityReflection,uv).rgb*.4;
        city+=(texture2D(cityReflection,uv+vec2(blur.x,0.)).rgb
          +texture2D(cityReflection,uv-vec2(blur.x,0.)).rgb
          +texture2D(cityReflection,uv+vec2(0.,blur.y)).rgb
          +texture2D(cityReflection,uv-vec2(0.,blur.y)).rgb)*.15;
        reflection=mix(reflection,city,captureWeight*.94);
        float gray=dot(reflection,vec3(.2126,.7152,.0722));
        reflection=mix(vec3(gray),reflection,.68);
        float shallow=1.-smoothstep(.0,5.,shore);
        vec3 absorption=mix(vec3(.028,.064,.058),vec3(.095,.124,.088),shallow*.65)*daySurfaceTint;
        vec3 c=mix(absorption,reflection,.16+captureWeight*.12+fresnel*.62);
        vec3 halfVector=normalize(view+daySunDirection);
        float ndh=max(dot(n,halfVector),0.);
        float spec=pow(ndh,75.)*.12+pow(ndh,360.)*.85;
        c+=vec3(1.0,.90,.72)*spec*daySunStrength;
        // Turbulent drifting patches, NOT repeated isolines of the rectangular
        // obstacle distance. Only a faint broken contact film follows the wall.
        float noise=skyNoise(p*.68-flow+warp*1.4);
        float fine=skyNoise(p*2.9+flow*.65+warp);
        float pixelSpan=length(fwidth(p));float aa=clamp(pixelSpan*.12,.025,.15);
        float contact=(1.-smoothstep(.02,.12+aa,shore))*smoothstep(.44,.72,noise)*.18;
        float churnDistance=max(0.,shore+(noise-.5)*1.2);
        float envelope=exp(-churnDistance*.85)*smoothstep(.02,.28,shore);
        float surge=.5+.5*sin(dot(p,vec2(.43,.27))-time*1.4+warp.x*2.8);
        float patches=smoothstep(.54,.79,noise*.72+fine*.28+surge*.12);
        float crest=smoothstep(.18,.30,swell.x)*smoothstep(.52,.76,noise)*.11;
        float foam=(contact+envelope*patches*(.36+.22*surge)+crest)*coast.y;
        foam*=1.-smoothstep(.65,2.8,pixelSpan)*.88;
        vec3 froth=vec3(.87,.92,.83)*daySurfaceTint;
        c=mix(c,froth,clamp(foam,0.,.6));
        // Rain rings remain soft and derivative-filtered in the distant floodplain.
        vec2 cell=floor(p*1.4),local=fract(p*1.4)-.5;
        float age=fract(time*.8+skyHash(cell));
        float ring=1.-smoothstep(.015,.040+fwidth(length(local)),abs(length(local)-age*.5));
        c+=vec3(.075)*ring*(1.-age)*dayWeatherRain*daySurfaceTint;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return material;
}

function createPuddle(center,halfSize){
 const material=new THREE.MeshPhysicalMaterial({name:'transparent-pbr-rooftop-puddle',color:'#646c5e',
   roughness:.085,metalness:0,ior:1.333,clearcoat:1,clearcoatRoughness:.07,
   transparent:true,opacity:.48,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 material.userData.painted=true; // Uses its own sky/day uniforms and physical light response.
 material.userData.rainPuddle=true;
 material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,dayUniforms,{poolFill:dayUniforms.dayPuddleFill,poolTime:natureTime,poolCenter:{value:new THREE.Vector2(...center)},poolSize:{value:new THREE.Vector2(...halfSize)}});
   if(material.meadowMap){shader.uniforms.poolMeadow={value:material.meadowMap};shader.defines??={};shader.defines.HAS_POOL_MEADOW=1;}
   shader.vertexShader='varying vec3 poolWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
     poolWorld=(modelMatrix*vec4(transformed,1.)).xyz;`);
   shader.fragmentShader=`varying vec3 poolWorld;uniform float poolTime,poolFill;uniform vec2 poolCenter,poolSize;
     #ifdef HAS_POOL_MEADOW
     uniform sampler2D poolMeadow;
     #endif
     ${paintedAtmosphereGLSL}
     float rainRing(vec2 p){
       float rings=0.;
       for(int i=0;i<3;i++){
         float seed=float(i)*7.13+dot(poolCenter,vec2(.3,.8));
         vec2 center=vec2(sin(seed*3.1),cos(seed*4.7))*poolSize*.55;
         float age=fract(poolTime*(.63+float(i)*.12)+seed);
         float radius=length(p-center);
         rings+=sin((radius-age*.8)*43.)*exp(-abs(radius-age*.8)*32.)*(1.-age)*smoothstep(0.,.08,age);
       }
       return rings*dayWeatherRain;
     }
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\nif(poolFill<.015)discard;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
     vec2 micro=vec2(sin(poolWorld.x*8.+poolWorld.z*4.+poolTime*.65),cos(poolWorld.z*9.-poolWorld.x*3.-poolTime*.42))*.025;
     vec2 rippleP=poolWorld.xz-poolCenter;
     micro+=vec2(rainRing(rippleP+vec2(.012,0.))-rainRing(rippleP-vec2(.012,0.)),rainRing(rippleP+vec2(0.,.012))-rainRing(rippleP-vec2(0.,.012)))*.055;
     normal=normalize(normal+(viewMatrix*vec4(micro.x,0.,micro.y,0.)).xyz);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     vec2 q=(poolWorld.xz-poolCenter)/poolSize;
     float poolRadius=mix(.12,1.,smoothstep(.015,.85,poolFill));
     float edge=(1.-smoothstep(poolRadius*.70,poolRadius,length(q)+skyNoise(poolWorld.xz*4.)*.14))*smoothstep(.015,.12,poolFill);
     #ifdef HAS_POOL_MEADOW
       edge*=1.-texture2D(poolMeadow,vec2(poolWorld.x/19.7,-poolWorld.z/14.8)+.5).a*.95;
     #endif
     vec3 poolView=normalize(cameraPosition-poolWorld);
     vec3 poolNormal=normalize(vec3(sin(poolWorld.x*8.+poolTime*.65)*.025,1.,cos(poolWorld.z*9.-poolTime*.42)*.025));
     float fresnel=.02+.98*pow(1.-max(dot(poolView,poolNormal),0.),5.);
     vec3 reflection=paintedAtmosphere(reflect(-poolView,poolNormal),poolTime);
     float gray=dot(reflection,vec3(.2126,.7152,.0722));
     reflection=mix(vec3(gray),reflection,.42);
     outgoingLight=mix(outgoingLight,reflection,.12+fresnel*.70);
     outgoingLight+=max(0.,rainRing(poolWorld.xz-poolCenter))*.06*daySurfaceTint;
     diffuseColor.a=edge*(.18+fresnel*.65);
     #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'puddle-pbr-rain-fill-ripples-v2-'+Boolean(material.meadowMap);
 return material;
}
