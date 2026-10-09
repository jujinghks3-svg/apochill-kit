import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import {dayUniforms} from './daylight-state.js';

// Display-space finishing: shared by desktop OutputPass and the mobile canvas
// copy. Mobile retains direct ACES rendering and needs only one RGBA8 texture.
export function sunlightShader(mobile=false) {
  return {
    uniforms:{tDiffuse:{value:null},texel:{value:new THREE.Vector2(1,1)},aspect:{value:1},
      pixelEnabled:{value:false},pixelSharpness:{value:.55},pixelGrid:{value:new THREE.Vector2(1,1)},sceneDepth:{value:null},hasDepth:{value:false},
      sunUv:{value:new THREE.Vector2(-1,2)},sunStrength:{value:0},edgeStrength:{value:0},sunEdge:{value:new THREE.Vector2(-.1,1.1)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse;uniform vec2 texel,sunUv,sunEdge,pixelGrid;uniform float aspect,sunStrength,edgeStrength;
      uniform bool pixelEnabled,hasDepth;uniform float pixelSharpness;uniform sampler2D sceneDepth;
      vec3 bright(vec2 p){vec3 c=texture2D(tDiffuse,clamp(p,vec2(0.),vec2(1.))).rgb;
        return c*smoothstep(.72,.94,dot(c,vec3(.2126,.7152,.0722)));}
      float ghost(vec2 p,vec2 center,float radius){vec2 d=(p-center)*vec2(aspect,1.);
        return exp(-dot(d,d)/(radius*radius));}
      void main(){
        // Quantize the entire finishing pass, including flare/vignette, so
        // each display pixel block stays crisp. OFF uses the original UV.
        vec2 finishUv=pixelEnabled?(floor(vUv*pixelGrid)+.5)/pixelGrid:vUv;
        vec3 c=texture2D(tDiffuse,finishUv).rgb;
        if(pixelEnabled){
          // Sharpen at the visible pixel-block scale, not one framebuffer texel.
          // Smooth sky stays quiet; bounded overshoot avoids bright edge halos.
          vec2 stepUv=1./max(pixelGrid,vec2(1.));
          vec2 edgeUv=stepUv*.5;
          vec3 n=texture2D(tDiffuse,clamp(finishUv+vec2(0.,stepUv.y),edgeUv,1.-edgeUv)).rgb;
          vec3 s=texture2D(tDiffuse,clamp(finishUv-vec2(0.,stepUv.y),edgeUv,1.-edgeUv)).rgb;
          vec3 e=texture2D(tDiffuse,clamp(finishUv+vec2(stepUv.x,0.),edgeUv,1.-edgeUv)).rgb;
          vec3 w=texture2D(tDiffuse,clamp(finishUv-vec2(stepUv.x,0.),edgeUv,1.-edgeUv)).rgb;
          vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));
          float detail=smoothstep(.025,.16,dot(hi-lo,vec3(.2126,.7152,.0722)));
          vec3 boost=clamp((c-(n+s+e+w)*.25)*pixelSharpness,vec3(-.045),vec3(.045));
          c=mix(c,clamp(c+boost,lo-.01,hi+.01),detail);
        }
        ${mobile?`
        // Sparse soft highlight glow, two radii; no floating-point render targets.
        vec3 glow=vec3(0.);
        for(int i=0;i<8;i++){
          float a=float(i)*.785398;vec2 d=vec2(cos(a)/aspect,sin(a));
          glow+=bright(finishUv+d*.007)*.60+bright(finishUv+d*.019)*.40;
        }
        c=1.-(1.-c)*exp(-glow*(.42/8.));
        `:`
        if(!pixelEnabled){
        vec3 blur=(texture2D(tDiffuse,finishUv+vec2(texel.x,0.)).rgb+texture2D(tDiffuse,finishUv-vec2(texel.x,0.)).rgb
          +texture2D(tDiffuse,finishUv+vec2(0.,texel.y)).rgb+texture2D(tDiffuse,finishUv-vec2(0.,texel.y)).rgb)*.25;
        c+=clamp(c-blur,vec3(-.06),vec3(.06))*.16;
        }
        `}
        float l=dot(c,vec3(.2126,.7152,.0722));
        float chroma=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
        c=mix(vec3(l),c,1.+.10*(1.-smoothstep(.12,.65,chroma)));
        c=(c-.5)*1.055+.5;
        c+=vec3(-.005,.007,.025)*(1.-smoothstep(.14,.58,l));
        c+=vec3(.022,.013,-.006)*smoothstep(.48,.92,l);
        // Directional lens response, not a fixed white overlay. Off-screen sun
        // gives a faint peripheral glow; small ghosts only appear near the frame.
        vec2 edge=sunEdge;
        vec2 d=(finishUv-edge)*vec2(aspect,1.);
        float halo=exp(-dot(d,d)*4.5)*edgeStrength;
        c+=vec3(1.,.83,.49)*halo*.12;
        float inFrame=1.-smoothstep(.55,1.05,max(abs(sunUv.x-.5),abs(sunUv.y-.5)));
        float source=0.;
        if(all(greaterThan(sunUv,vec2(.005)))&&all(lessThan(sunUv,vec2(.995)))){
          // Five taps soften partial occlusion across the solar disc. Desktop
          // uses real scene depth; mobile estimates visibility from highlights.
          for(int i=0;i<5;i++){
            float a=float(i)*1.256637;vec2 q=sunUv+vec2(cos(a)/aspect,sin(a))*.004;
            float clear=hasDepth?step(.9999,texture2D(sceneDepth,q).r):1.;
            source+=clear*smoothstep(.88,.985,dot(texture2D(tDiffuse,q).rgb,vec3(.2126,.7152,.0722)))*.2;
          }
        }
        vec2 axis=vec2(.5)-sunUv;
        vec3 flare=vec3(.58,.78,1.)*ghost(finishUv,sunUv+axis*1.36,.055)*.10;
        flare+=vec3(1.,.70,.30)*ghost(finishUv,sunUv+axis*1.78,.095)*.065;
        flare+=vec3(.62,1.,.78)*ghost(finishUv,sunUv+axis*.64,.024)*.085;
        vec2 solarDelta=(finishUv-sunUv)*vec2(aspect,1.);
        float radius=length(solarDelta);
        float ring=exp(-pow((length((finishUv-(sunUv+axis*1.12))*vec2(aspect,1.))-.14)/.008,2.));
        flare+=vec3(.7,.84,1.)*ring*.025;
        flare+=vec3(1.,.85,.55)*(exp(-radius*radius/.008)*.44
          +exp(-abs(solarDelta.y)*150.)*exp(-abs(solarDelta.x)*10.)*.11);
        c+=flare*sunStrength*inFrame*source;
        vec2 p=(finishUv-.5)*2.;float vignette=1.-.065*smoothstep(.45,1.75,dot(p,p));
        gl_FragColor=vec4(clamp(c*vignette,0.,1.),1.);
      }`,
  };
}

export function sunlightUpdater(uniforms,camera,lighting){
  const sun=new THREE.Vector3(),view=new THREE.Vector3();
  return ()=>{
    sun.copy(dayUniforms.daySunDirection.value);
    view.copy(sun).transformDirection(camera.matrixWorldInverse);
    sun.multiplyScalar(500).add(camera.position).project(camera);
    uniforms.sunUv.value.set(sun.x*.5+.5,sun.y*.5+.5);
    const edge=Math.max(Math.abs(sun.x),Math.abs(sun.y));
    uniforms.sunStrength.value=THREE.MathUtils.smoothstep(-view.z,.02,.40)*(1-THREE.MathUtils.smoothstep(edge,1.1,4.5));
    // Stylized off-axis lens glare: project its direction to just beyond the
    // screen edge, fading away as the light passes behind the viewer. This is
    // an artistic approximation, not a simulation of physical lens optics.
    const extent=Math.max(Math.abs(view.x),Math.abs(view.y),.001);
    uniforms.sunEdge.value.set(.5+.63*view.x/extent,.5+.63*view.y/extent);
    uniforms.edgeStrength.value=THREE.MathUtils.smoothstep(-view.z,-.45,.25)*.7;
    uniforms.sunStrength.value*=dayUniforms.daySunStrength.value;
    uniforms.edgeStrength.value*=dayUniforms.daySunStrength.value;
    uniforms.aspect.value=camera.aspect;
  };
}

export function createMobileSunlight(renderer,scene,camera,lighting){
  const material=new THREE.ShaderMaterial({...sunlightShader(true),depthTest:false,depthWrite:false,toneMapped:false});
  const quad=new FullScreenQuad(material),size=new THREE.Vector2();
  const update=sunlightUpdater(material.uniforms,camera,lighting);
  let frame;
  function resize(){
    renderer.getDrawingBufferSize(size);
    frame?.dispose();frame=new THREE.FramebufferTexture(size.x,size.y);
    frame.minFilter=frame.magFilter=THREE.LinearFilter;
    // These are already display-encoded pixels; do not decode or tone-map twice.
    frame.colorSpace=THREE.NoColorSpace;
    material.uniforms.tDiffuse.value=frame;
    material.uniforms.texel.value.set(1/size.x,1/size.y);
    const cssSize=renderer.getSize(new THREE.Vector2());
    material.uniforms.pixelGrid.value.set(Math.max(1,Math.round(cssSize.x/3)),Math.max(1,Math.round(cssSize.y/3)));
  }
  resize();
  renderer.info.autoReset=false;
  return {resize,setPixelation(enabled){material.uniforms.pixelEnabled.value=Boolean(enabled);},render(){
    renderer.setRenderTarget(null);renderer.render(scene,camera);
    renderer.copyFramebufferToTexture(frame);update();quad.render(renderer);
  },dispose(){frame.dispose();material.dispose();quad.dispose();}};
}
