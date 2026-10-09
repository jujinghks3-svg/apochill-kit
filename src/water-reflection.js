import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

// One shared planar capture for the connected floodwater. Reflector provides
// mirrored-camera projection and an oblique near plane that clips submerged land.
// It is never added to the scene: only its linear HDR render target is consumed.
export function createWaterReflection(renderer,scene,camera,{mobile=false,quality=null}={}){
  const water=scene.getObjectByName('han-river');
  if(!water)return {resize(){},update(){},dispose(){}};
  const u=water.material.uniforms;
  const geometry=new THREE.PlaneGeometry(1,1);
  const mirror=new Reflector(geometry,{textureWidth:1,textureHeight:1,multisample:0,clipBias:.0003});
  const target=mirror.getRenderTarget();
  // Keep the phone path independent of floating-point colour attachments.
  if(mobile)target.texture.type=THREE.UnsignedByteType;
  const inverseWater=new THREE.Matrix4(),size=new THREE.Vector2();
  const period=1/(quality?.reflectionHz??(mobile?8:15)),maxSize=quality?.reflectionSize??(mobile?512:1024);
  let lastCapture=-Infinity,disposed=false,captures=0;
  u.cityReflection.value=target.texture;
  const stats={method:'planar-mirrored-camera',maxHz:1/period,width:1,height:1,captures:0};
  water.userData.reflection=stats;
  function resize(){
    renderer.getDrawingBufferSize(size);
    const scale=Math.min(.5,maxSize/Math.max(size.x,size.y));
    const width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
    target.setSize(width,height);u.reflectionTexel.value.set(1/width,1/height);
    Object.assign(stats,{width,height});u.reflectionReady.value=0;lastCapture=-Infinity;
  }
  function update(time){
    if(disposed)return;
    camera.updateMatrixWorld();water.updateWorldMatrix(true,false);
    const height=water.matrixWorld.elements[13];
    if(camera.position.y<=height+.1){u.reflectionReady.value=0;return;}
    if(time-lastCapture<period&&u.reflectionReady.value)return;
    // Keep the capture's matrix frozen with its texture between updates, so the
    // reflected city does not slide as the main camera slowly moves.
    mirror.matrixWorld.copy(water.matrixWorld);
    const visible=water.visible,previousTarget=renderer.getRenderTarget();
    const autoShadow=renderer.shadowMap.autoUpdate,dirtyShadow=renderer.shadowMap.needsUpdate;
    const xr=renderer.xr.enabled,viewport=renderer.getViewport(new THREE.Vector4());
    water.visible=false;renderer.shadowMap.needsUpdate=false;
    try{
      mirror.onBeforeRender(renderer,scene,camera);
      inverseWater.copy(water.matrixWorld).invert();
      u.reflectionMatrix.value.copy(mirror.material.uniforms.textureMatrix.value).multiply(inverseWater);
      u.reflectionHeight.value=height;u.reflectionReady.value=1;
      lastCapture=time;stats.captures=++captures;
    }finally{
      water.visible=visible;renderer.shadowMap.autoUpdate=autoShadow;
      renderer.shadowMap.needsUpdate=dirtyShadow;renderer.xr.enabled=xr;
      renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);
    }
  }
  resize();
  return {resize,update,dispose(){disposed=true;u.reflectionReady.value=0;u.cityReflection.value=null;mirror.dispose();geometry.dispose();}};
}
