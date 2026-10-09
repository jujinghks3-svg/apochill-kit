import * as THREE from 'three';
export function createSpeechBubble(camera,{className='',label=''}={}){
  const element=document.createElement('div');element.className=`work-status-bubble ${className}`;element.hidden=true;
  const reserve=document.createElement('span');reserve.className='speech-reserve';reserve.setAttribute('aria-hidden','true');
  const ink=document.createElement('span');ink.className='speech-ink';ink.setAttribute('aria-hidden','true');
  const accessible=document.createElement('span');accessible.className='speech-accessible';
  element.append(reserve,ink,accessible);document.body.append(element);
  const position=new THREE.Vector3(),forward=new THREE.Vector3(),relative=new THREE.Vector3();
  function setLabel(text,suffix='...'){reserve.textContent=text+suffix;accessible.textContent=text;}
  setLabel(label);
  return {element,setLabel,
    update(anchor,text,opacity=1){
      if(ink.textContent!==text)ink.textContent=text;
      element.style.opacity=String(opacity);
      if(!anchor||opacity<=0){element.hidden=true;return;}
      position.copy(anchor);relative.copy(position).sub(camera.position);camera.getWorldDirection(forward);
      if(relative.dot(forward)<=0){element.hidden=true;return;}
      position.project(camera);
      element.hidden=position.z < -1 || position.z > 1 || Math.abs(position.x)>.94 || Math.abs(position.y)>.94;
      element.style.left=`${(position.x*.5+.5)*innerWidth}px`;
      element.style.top=`${(-position.y*.5+.5)*innerHeight}px`;
    },dispose(){element.remove();}};
}
