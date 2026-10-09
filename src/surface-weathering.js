import * as THREE from 'three';

// Tileable, deterministic data texture: mottling / pits / fracture / paint loss.
// A material layer avoids extra coplanar meshes and their depth flicker.
let weatherMap;
export function weatherTexture(){
  if(weatherMap)return weatherMap;
  const size=256,data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=Math.imul((x+131)&255,374761393)^Math.imul((y+73)&255,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;};
  const noise=(x,y,period)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const h=(a,b)=>hash((a+period)%period,(b+period)%period);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix,iy),h(ix+1,iy),sx),THREE.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),sx),sy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,p=(y*size+x)*4;
    const coarse=noise(u*8,v*8,8)*.65+noise(u*23,v*23,23)*.35;
    const cx=u*5,cy=v*5;let first=99,second=99;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
      const ix=Math.floor(cx)+a,iy=Math.floor(cy)+b;
      const dx=ix+hash((ix+5)%5,(iy+5)%5)-cx,dy=iy+hash((iy+5)%5,(ix+5)%5)-cy,d=dx*dx+dy*dy;
      if(d<first){second=first;first=d;}else if(d<second)second=d;
    }
    data[p]=coarse*255;data[p+1]=noise(u*64,v*64,64)*255;
    data[p+2]=Math.max(0,1-(Math.sqrt(second)-Math.sqrt(first))*45)*(coarse>.46?255:0);
    data[p+3]=THREE.MathUtils.smoothstep(coarse,.48,.64)*255;
  }
  weatherMap=new THREE.DataTexture(data,size,size);weatherMap.wrapS=weatherMap.wrapT=THREE.RepeatWrapping;
  weatherMap.magFilter=THREE.LinearFilter;weatherMap.minFilter=THREE.LinearMipmapLinearFilter;weatherMap.generateMipmaps=true;weatherMap.anisotropy=4;weatherMap.needsUpdate=true;
  return weatherMap;
}

export function weatherMaterial(material,{floor=false,strength=1,scale=1}={}){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();material.weatherMap=weatherTexture();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);shader.uniforms.surfaceWeather={value:material.weatherMap};
    shader.vertexShader='varying vec3 weatherPosition; varying vec3 weatherNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 weatherWorld=vec4(position,1.);
      vec3 weatherN=normal;
      #ifdef USE_INSTANCING
      weatherWorld=instanceMatrix*weatherWorld;
      weatherN=mat3(instanceMatrix)*weatherN;
      #endif
      weatherPosition=(modelMatrix*weatherWorld).xyz;
      weatherNormal=normalize(mat3(modelMatrix)*weatherN);`);
    shader.fragmentShader='varying vec3 weatherPosition; varying vec3 weatherNormal; uniform sampler2D surfaceWeather;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 weatherAxis=abs(weatherNormal);
      vec2 weatherUV=${floor?'weatherPosition.xz':'weatherAxis.y>.65 ? weatherPosition.xz : weatherAxis.x>weatherAxis.z ? weatherPosition.zy : weatherPosition.xy'};
      weatherUV*=${scale.toFixed(2)};
      vec4 wear=texture2D(surfaceWeather,weatherUV*.19);
      vec4 grit=texture2D(surfaceWeather,weatherUV*1.35);
      float fineFade=1.-smoothstep(.025,.13,length(fwidth(weatherUV)));
      float cracks=wear.b*fineFade;
      float stain=smoothstep(.47,.78,wear.r)*${strength.toFixed(2)};
      vec3 oldSurface=diffuseColor.rgb;
      oldSurface*=1.-stain*.36-(1.-grit.g)*.10*fineFade;
      oldSurface=mix(oldSurface,vec3(.27,.25,.18),wear.a*.23*${strength.toFixed(2)});
      oldSurface*=1.-cracks*.45;
      float chips=smoothstep(.66,.79,grit.r)*wear.a*fineFade;
      oldSurface=mix(oldSurface,oldSurface*.55+vec3(.09,.075,.05),chips*.45*${strength.toFixed(2)});
      ${floor?`float damp=smoothstep(.54,.73,texture2D(surfaceWeather,weatherUV*.105+1.7).r);
        oldSurface=mix(oldSurface,oldSurface*vec3(.60,.72,.54),damp*.55);`:
      `float streak=texture2D(surfaceWeather,weatherUV*vec2(.8,.028)).a;
       float deposits=smoothstep(.48,.76,texture2D(surfaceWeather,weatherUV*.33+2.4).r);
       oldSurface=mix(oldSurface,vec3(.24,.16,.085),streak*deposits*.32);
       oldSurface=mix(oldSurface,vec3(.19,.26,.11),smoothstep(.59,.78,wear.r)*.30);`}
      diffuseColor.rgb=oldSurface;`);
  };
  material.customProgramCacheKey=()=>`${key}-surface-weather-v2-${floor}-${strength}-${scale}`;
  return material;
}
