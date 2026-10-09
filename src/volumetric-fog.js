import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import {dayUniforms} from './daylight-state.js';

const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

export class VolumetricFogPass extends Pass {
  constructor(camera,depthTexture,lighting) {
    super();this.camera=camera;this.lighting=lighting;
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    const uniforms={...dayUniforms,tDepth:{value:depthTexture},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},eye:{value:new THREE.Vector3()},
      fogTime:{value:0},sunDirection:{value:lighting.direction.clone().negate()},
      shadow0:{value:null},shadow1:{value:null},shadow2:{value:null},matrix0:{value:new THREE.Matrix4()},matrix1:{value:new THREE.Matrix4()},matrix2:{value:new THREE.Matrix4()}};
    this.fog=new THREE.ShaderMaterial({vertexShader,uniforms,depthTest:false,depthWrite:false,fragmentShader:`
      precision highp sampler2DShadow;
      varying vec2 vUv;uniform sampler2D tDepth;
      uniform sampler2DShadow shadow0,shadow1,shadow2;
      uniform mat4 inverseProjection,cameraWorld,matrix0,matrix1,matrix2;
      uniform vec3 eye,sunDirection;uniform float fogTime;
      uniform vec3 daySurfaceTint;uniform float daySunStrength;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+1.),f.x),f.y);}
      bool inside(vec3 p){return all(greaterThan(p,vec3(.002)))&&all(lessThan(p,vec3(.998)));}
      float lit(vec3 world){
        vec3 p0=(matrix0*vec4(world,1.)).xyz;
        vec3 p1=(matrix1*vec4(world,1.)).xyz;
        vec3 p2=(matrix2*vec4(world,1.)).xyz;
        float visibility=1.;
        if(inside(p0))visibility=texture(shadow0,vec3(p0.xy,p0.z-.0003));
        else if(inside(p1))visibility=texture(shadow1,vec3(p1.xy,p1.z-.0003));
        else if(inside(p2))visibility=texture(shadow2,vec3(p2.xy,p2.z-.0003));
        return visibility;
      }
      void main(){
        float depth=texture2D(tDepth,vUv).x;
        vec4 view=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);view/=view.w;
        vec3 hit=(cameraWorld*view).xyz,ray=hit-eye;
        float lengthRay=min(length(ray),340.);vec3 direction=normalize(ray);
        float stepSize=lengthRay/20.;float jitter=hash(gl_FragCoord.xy);
        float transmission=1.;vec3 scatter=vec3(0.);
        float phase=.16+.95*pow(max(dot(direction,sunDirection),0.),8.);
        for(int i=0;i<20;i++){
          float travel=(float(i)+jitter)*stepSize;vec3 p=eye+direction*travel;
          float lowland=exp(-max(p.y+19.,0.)*.065);
          float rolling=noise(p.xz*.045+vec2(fogTime*.012,fogTime*.007));
          float density=.0042*lowland*(.4+.85*rolling)*smoothstep(14.,45.,travel);
          float alpha=1.-exp(-density*stepSize);
          float sunlight=lit(p);
          vec3 radiance=(vec3(.35,.51,.64)+vec3(.65,.59,.43)*sunlight*phase*daySunStrength)*daySurfaceTint;
          scatter+=transmission*alpha*radiance;
          transmission*=1.-alpha;
        }
        gl_FragColor=vec4(scatter,transmission);
      }`});
    this.composite=new THREE.ShaderMaterial({vertexShader,depthTest:false,depthWrite:false,
      uniforms:{tDiffuse:{value:null},tFog:{value:this.target.texture},tDepth:{value:depthTexture},resolution:{value:new THREE.Vector2(1,1)},nearFar:{value:new THREE.Vector2(camera.near,camera.far)}},
      fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse,tFog,tDepth;uniform vec2 resolution,nearFar;
        float distanceAt(vec2 uv){float d=texture2D(tDepth,uv).x;return nearFar.x*nearFar.y/(nearFar.y-d*(nearFar.y-nearFar.x));}
        void main(){
          vec2 grid=vUv*resolution-.5,base=floor(grid),f=fract(grid);float depth=distanceAt(vUv);
          vec4 fog=vec4(0.);float total=0.;
          for(int y=0;y<2;y++)for(int x=0;x<2;x++){
            vec2 corner=vec2(float(x),float(y)),uv=(base+corner+.5)/resolution;
            float weight=mix(1.-f.x,f.x,corner.x)*mix(1.-f.y,f.y,corner.y);
            weight*=exp(-abs(distanceAt(uv)-depth)*.7);
            fog+=texture2D(tFog,uv)*weight;total+=weight;
          }
          // A narrow building can fall between every half-resolution fog ray.
          // Keep its existing distance haze instead of borrowing fog behind it.
          fog=total>.0001?fog/total:vec4(0.,0.,0.,1.);vec4 scene=texture2D(tDiffuse,vUv);
          gl_FragColor=vec4(scene.rgb*fog.a+fog.rgb,scene.a);
        }`});
    this.quad=new FullScreenQuad(this.fog);
  }
  setSize(width,height){
    const w=Math.max(1,Math.floor(width*.5)),h=Math.max(1,Math.floor(height*.5));
    this.target.setSize(w,h);this.composite.uniforms.resolution.value.set(w,h);
  }
  render(renderer,writeBuffer,readBuffer){
    const u=this.fog.uniforms;
    u.sunDirection.value.copy(this.lighting.direction).negate();
    u.inverseProjection.value.copy(this.camera.projectionMatrixInverse);u.cameraWorld.value.copy(this.camera.matrixWorld);u.eye.value.copy(this.camera.position);
    this.lighting.csm.lights.forEach((light,i)=>{u[`shadow${i}`].value=light.shadow.map.depthTexture;u[`matrix${i}`].value.copy(light.shadow.matrix);});
    this.quad.material=this.fog;renderer.setRenderTarget(this.target);this.quad.render(renderer);
    this.composite.uniforms.tDiffuse.value=readBuffer.texture;this.composite.uniforms.nearFar.value.set(this.camera.near,this.camera.far);
    this.quad.material=this.composite;renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
  dispose(){this.target.dispose();this.fog.dispose();this.composite.dispose();this.quad.dispose();}
}
