import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export {};',shortCircuit:true}:next(url,context);}});
const {createWorkStatus}=await import('./work-status-ui.js');
const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
function environment(preference=null){
  class Element extends EventTarget{
    style={};children=[];hidden=false;textContent='';attributes={};
    append(...children){this.children.push(...children);}
    setAttribute(key,value){this.attributes[key]=value;}
    remove(){this.removed=true;}
  }
  const body=new Element(),controls=new Element(),calls=[];
  let poll,clock=0,status={protocol:2,enabled:true,connected:true,app:'Notion',text:'old fixed text'},fail=false;
  const document=Object.assign(new EventTarget(),{body,hidden:false,documentElement:{dataset:{}},createElement:()=>new Element(),querySelector:()=>controls});
  const originals=new Map();
  const overrides={document,location:new URL('https://apochill.lastweek.chatgpt.site/'),navigator:{platform:'Win32'},
    localStorage:{getItem:()=>preference,setItem:(key,value)=>{preference=value;}},performance:{now:()=>clock},
    matchMedia:()=>({matches:false}),innerWidth:1280,innerHeight:720,
    setInterval:callback=>{poll=callback;return 1;},clearInterval(){},
    fetch:async(url,options)=>{calls.push({url,options});if(fail)throw Error('disconnected');
      if(url.endsWith('/stop'))status.enabled=false;if(url.endsWith('/start'))status.enabled=true;
      return {ok:true,json:async()=>status};}};
  for(const [key,value] of Object.entries(overrides)){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,100);camera.position.z=10;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const ui=createWorkStatus({camera,getAnchor:()=>new THREE.Vector3(),getDogAnchor:()=>new THREE.Vector3(1,0,0),isDogOutside:()=>true});
  return {ui,body,document,calls,status,button:controls.children[0].children[0],hint:controls.children[0].children[1],
    ink:body.children[0].children[1],label:body.children[0].children[2],poll:()=>poll(),
    fail(value){fail=value;},advance(ms){clock+=ms;},restore(){ui.dispose();for(const [key,value] of originals)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}};
}
test('desktop auto-connects, cycles three typed phrases, and changes names when apps change',async()=>{
  const e=environment();
  try{
    await flush();assert.equal(e.calls[0].url,'http://127.0.0.1:5175/start');
    assert.equal(e.calls[0].options.targetAddressSpace,'loopback');assert.equal(e.button.attributes['aria-pressed'],'true');
    assert.equal(e.label.textContent,'Notion으로 작업하는 중');
    const complete=new Set();
    for(let i=0;i<300;i++){
      e.ui.update(i/20);
      if(e.ink.textContent.startsWith(e.label.textContent))complete.add(e.label.textContent);
      if(i%30===0)await e.poll(); // Repeated identical app polls must not restart typing.
    }
    assert.deepEqual([...complete],['Notion으로 작업하는 중','Notion으로 구상하는 중','Notion으로 달리는 중']);
    e.status.app='Blender';await e.poll();assert.equal(e.label.textContent,'Blender로 작업하는 중');
    e.ui.update(15);assert.equal(e.ink.textContent,'');
    e.status.app='Chrome';e.document.dispatchEvent(new Event('visibilitychange'));await flush();
    assert.equal(e.label.textContent,'Chrome으로 작업하는 중');
    assert.ok(e.hint.textContent.includes('현재 앱: Chrome'));
  }finally{e.restore();}
});
test('a transient disconnect automatically recovers instead of permanently stopping detection',async()=>{
  const e=environment();
  try{
    await flush();e.fail(true);await e.poll();
    assert.equal(e.label.textContent,'옥상에서 잠시 쉬는 중');assert.ok(e.hint.textContent.includes('재시도'));
    e.fail(false);e.status.app='CapCut';e.advance(5000);await e.poll();
    assert.equal(e.label.textContent,'CapCut으로 작업하는 중');
    e.status.enabled=false;await e.poll();assert.equal(e.status.enabled,true,'Restart a stopped helper sampler');
  }finally{e.restore();}
});
test('saved off preference is respected and a manual stop prevents automatic restarts',async()=>{
  const e=environment('off');
  try{
    await flush();assert.equal(e.calls.length,0);
    e.button.dispatchEvent(new Event('click'));await flush();assert.equal(e.button.attributes['aria-pressed'],'true');
    e.button.dispatchEvent(new Event('click'));await flush();assert.equal(e.button.attributes['aria-pressed'],'false');
    const count=e.calls.length;e.advance(10000);await e.poll();assert.equal(e.calls.length,count);
  }finally{e.restore();}
});
