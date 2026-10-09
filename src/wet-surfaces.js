import {dayUniforms} from './daylight-state.js';
import {natureTime} from './painted-nature.js';

// Shared cheap sky reflection, without a second city render per building.
// Rain water remains dielectric: only authored glass raises its metallic response.
export function applyWetSurfaces(root){
  const materials=new Set();
  root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(m?.isMeshStandardMaterial&&!m.userData.wetSurface&&!m.userData.rainPuddle&&m.name!=='transparent-pbr-rooftop-puddle')materials.add(m);
  }});
  for(const m of materials){
    m.userData.wetSurface=true;
    const glass=Boolean(m.userData.glassFacade),previous=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=(s,r)=>{
      previous.call(m,s,r);
      Object.assign(s.uniforms,{wetAmount:dayUniforms.dayWetness,wetTime:natureTime,
        wetSkyTop:dayUniforms.daySkyTop,wetHorizon:dayUniforms.daySkyHorizon,
        wetCloud:dayUniforms.dayCloudLight,wetCoverage:dayUniforms.dayCloudCoverage});
      s.vertexShader='varying vec3 wetWorld;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 wetP=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        wetP=instanceMatrix*wetP;
        #endif
        wetWorld=(modelMatrix*wetP).xyz;`);
      s.fragmentShader=`varying vec3 wetWorld;uniform float wetAmount,wetTime,wetCoverage;
        uniform vec3 wetSkyTop,wetHorizon,wetCloud;
        float wetHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float wetNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(wetHash(i),wetHash(i+vec2(1,0)),f.x),mix(wetHash(i+vec2(0,1)),wetHash(i+1.),f.x),f.y);}
        vec3 wetSky(vec3 d){
          vec3 sky=mix(wetHorizon,wetSkyTop,smoothstep(0.,.65,d.y));
          vec2 q=d.xz/(abs(d.y)+.35)*2.3+vec2(wetTime*.003,0.);
          float clouds=smoothstep(.68-wetCoverage*.3,.83-wetCoverage*.3,wetNoise(q));
          sky=mix(sky,wetCloud,clouds*smoothstep(-.03,.3,d.y)*.65);
          return sky*mix(.3,1.,smoothstep(-.1,.15,d.y));
        }
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float wetGlass=${glass?'smoothstep(.008,.085,diffuseColor.b-diffuseColor.r)*smoothstep(.006,.04,diffuseColor.g-diffuseColor.r)':'0.'};
        float wetPatch=.7+.3*wetNoise(wetWorld.xz*.8+wetWorld.y*.06);
        float wetFilm=wetAmount*wetPatch;
        diffuseColor.rgb*=1.-wetFilm*.20*(1.-wetGlass*.7);`);
      s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor*.35,.17,.27)${m.userData.glassWeathering?'+glassDirt*.22':''},wetGlass);
        metalnessFactor=mix(metalnessFactor,.42,wetGlass);
        roughnessFactor=mix(roughnessFactor,min(roughnessFactor,.15),wetFilm*.85);`);
      // Restore specular energy suppressed by the dry painterly material style.
      s.fragmentShader=s.fragmentShader.replace('reflectedLight.directSpecular *= .36;',
        'reflectedLight.directSpecular *= mix(.36,.92,max(wetFilm,wetGlass));');
      s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 wetN=inverseTransformDirection(normal,viewMatrix);
        vec3 wetV=normalize(cameraPosition-wetWorld);
        float wetF=pow(1.-max(dot(wetV,wetN),0.),5.);
        float wetReflection=max(wetGlass*(.14+.38*wetF)${m.userData.glassWeathering?'*(1.-glassDirt*.65)':''},wetFilm*(.025+.27*wetF));
        outgoingLight=mix(outgoingLight,wetSky(reflect(-wetV,wetN)),wetReflection);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey=()=>`${key}-rain-film-glass-v1-${glass}`;m.needsUpdate=true;
  }
  return materials.size;
}
