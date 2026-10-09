import * as THREE from 'three';
import { paintedAtmosphereGLSL } from './painted-atmosphere.js';
import {dayUniforms} from './daylight-state.js';

export function createPaintedSky() {
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{...dayUniforms,time:{value:0}},
    vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);gl_Position.z=gl_Position.w;}',
    fragmentShader:`
      varying vec3 skyDirection; uniform float time;
      ${paintedAtmosphereGLSL}
      void main(){
        gl_FragColor=vec4(paintedAtmosphere(skyDirection,time),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,24),material);
  sky.name='painted-sky';sky.userData.animate=(t)=>{material.uniforms.time.value=t;};return sky;
}
