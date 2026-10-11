import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export {};',shortCircuit:true}:next(url,context);}});
const {createWorkStatus}=await import('./work-status-ui.js');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function environment({saved='rest',platform='Win32',deferred=false}={}){
  class Element extends EventTarget{
    style={};children=[];hidden=false;textContent='';attributes={};value='';
    append(...children){this.children.push(...children);}setAttribute(k,v){this.attributes[k]=v;}
    remove(){}showModal(){this.open=true;}close(){this.open=false;}focus(){}
  }
  const body=new Element(),controls=new Element(),calls=[],all=[];let poll,clock=0,fail=false,release;
  const status={protocol:2,enabled:true,connected:true,app:'Notion'};
  const document=Object.assign(new EventTarget(),{body,hidden:false,documentElement:{dataset:{}},createElement:()=>{const e=new Element();all.push(e);return e;},querySelector:()=>controls});
  const originals=new Map(),prefs={'apochill-manual-state':saved};
  const overrides={document,location:new URL('https://apochill.lastweek.chatgpt.site/'),navigator:{platform},localStorage:{getItem:k=>prefs[k]??null,setItem:(k,v)=>{prefs[k]=v;}},performance:{now:()=>clock},
    matchMedia:()=>({matches:false}),innerWidth:1280,innerHeight:720,setInterval:cb=>{poll=cb;return 1;},clearInterval(){},
    fetch:async(url,options)=>{calls.push({url,options});if(fail)throw Error('disconnected');
      if(url.endsWith('/start')){if(deferred)await new Promise(r=>{release=r;});status.enabled=true;}
      if(url.endsWith('/stop'))status.enabled=false;return {ok:true,json:async()=>({...status})};}};
  for(const [key,value] of Object.entries(overrides)){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,100);camera.position.z=10;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const ui=createWorkStatus({camera,getAnchor:()=>new THREE.Vector3(),getDogAnchor:()=>new THREE.Vector3(1,0,0),isDogOutside:()=>true});
  return {ui,calls,status,prefs,all,body,document,button:controls.children[0].children[0],hint:controls.children[0].children[1],
    select:all.find(e=>e.id==='manual-work-state'),connect:all.find(e=>e.textContent==='도우미 실행했어요 · 연결하기'),manual:all.find(e=>e.textContent==='선택한 상태 사용'),label:all.find(e=>e.className==='speech-accessible'),
    poll:()=>poll(),fail:v=>{fail=v;},advance:ms=>{clock+=ms;},release:()=>release(),restore(){ui.dispose();for(const [k,v] of originals)if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}};
}
test('first visit and saved manual state make no PC requests; mobile can select a status',async()=>{
  const e=environment({saved:'coding',platform:'iPhone'});try{await flush();await e.poll();assert.equal(e.calls.length,0);assert.equal(e.label.textContent,'집중해서 코딩하는 중');assert.equal(e.connect.disabled,true);
    e.select.value='design';e.select.dispatchEvent(new Event('change'));await flush();assert.equal(e.label.textContent,'새로운 장면을 디자인하는 중');assert.equal(e.prefs['apochill-manual-state'],'design');assert.equal(e.calls.length,0);
    e.button.dispatchEvent(new Event('click'));assert.ok(e.all.find(x=>x.className==='work-connect-dialog').open);
  }finally{e.restore();}
});
test('explicit connect reads apps, changes phrases, and manual selection stops sampling',async()=>{
  const e=environment();try{await flush();assert.equal(e.calls.length,0);e.connect.dispatchEvent(new Event('click'));await flush();assert.equal(e.calls[0].options.targetAddressSpace,'loopback');assert.equal(e.label.textContent,'Notion으로 작업하는 중');
    for(let i=0;i<130;i++)e.ui.update(i/20);assert.notEqual(e.label.textContent,'Notion으로 작업하는 중');
    e.status.app='Blender';await e.poll();assert.equal(e.label.textContent,'Blender로 작업하는 중');
    e.select.value='study';e.manual.dispatchEvent(new Event('click'));await flush();assert.equal(e.status.enabled,false);assert.equal(e.label.textContent,'차근차근 공부하는 중');const n=e.calls.length;await e.poll();assert.equal(e.calls.length,n);
  }finally{e.restore();}
});
test('missing helper keeps the manual phrase and retries only after opting in',async()=>{
  const e=environment({saved:'work'});try{e.fail(true);e.connect.dispatchEvent(new Event('click'));await flush();assert.equal(e.label.textContent,'집중해서 작업하는 중');assert.match(e.hint.textContent,/실행 여부와 브라우저 권한/);
    e.fail(false);e.advance(6000);await e.poll();assert.equal(e.label.textContent,'Notion으로 작업하는 중');
  }finally{e.restore();}
});
test('switching to manual during an outstanding start ignores stale response and sends stop last',async()=>{
  const e=environment({deferred:true});try{e.connect.dispatchEvent(new Event('click'));await flush();e.select.value='design';e.manual.dispatchEvent(new Event('click'));e.release();await flush();
    assert.equal(e.label.textContent,'새로운 장면을 디자인하는 중');assert.equal(e.status.enabled,false);assert.ok(e.calls.at(-1).url.endsWith('/stop'));await e.poll();assert.equal(e.status.enabled,false);
  }finally{e.restore();}
});
test('stopping in the native helper is respected instead of restarting sampling',async()=>{
  const e=environment();try{e.connect.dispatchEvent(new Event('click'));await flush();e.status.enabled=false;await e.poll();
    const n=e.calls.length;await e.poll();assert.equal(e.calls.length,n);assert.equal(e.label.textContent,'옥상에서 잠시 쉬는 중');assert.match(e.hint.textContent,/꺼졌어요/);
  }finally{e.restore();}
});
