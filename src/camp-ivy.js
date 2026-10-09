import * as THREE from 'three';
import {ivyRandom} from './ivy-vines.js';

export function campIvyTrails(){
  const random=ivyRandom(91725),trails=[];
  function edge(axis,fixed,min,max,top,normal,count,centres){
    for(let i=0;i<count;i++){
      const clustered=random()<.78,centre=centres[Math.floor(random()*centres.length)];
      const along=THREE.MathUtils.clamp(clustered?centre+(random()-.5)*2.8:min+random()*(max-min),min,max);
      const length=.85+Math.pow(random(),.65)*(clustered?12.5:5.2);
      const width=.42+random()*(clustered?1.0:.50),phase=random()*6.28,drift=(random()-.5)*.6;
      const start=top-(random()<.23?random()*2.8:0),steps=Math.ceil(length/.45);
      const points=Array.from({length:steps+1},(_,j)=>{
        const t=j/steps,lateral=THREE.MathUtils.clamp(along+Math.sin(t*5.8+phase)*width*.24+t*drift,min,max);
        return axis==='x'?new THREE.Vector3(lateral,start-t*length,fixed+random()*.012):new THREE.Vector3(fixed+normal.x*random()*.012,start-t*length,lateral);
      });
      trails.push({points,width,normal,seed:Math.floor(random()*1000000)});
    }
  }
  edge('x',8.10,-9.2,9.2,.23,new THREE.Vector3(0,0,1),32,[-8.1,-4.9,6.7]);
  for(const side of [-1,1])edge('z',side*10.44,-6.8,6.8,1.03,new THREE.Vector3(side,0,0),side>0?35:23,[-5.8,1.7,5.4]);
  // Smaller irregular patches around the access hut, leaving the door usable.
  for(const [x,length,width] of [[-8.85,2.5,.81],[-5.92,1.65,.66]])trails.push({width,seed:Math.round(-x*819),
    points:Array.from({length:9},(_,i)=>new THREE.Vector3(x+Math.sin(i*.5)*.08,2.86-i/8*length,6.18))});
  trails.push({width:1.04,seed:194,normal:new THREE.Vector3(1,0,0),points:Array.from({length:9},(_,i)=>new THREE.Vector3(-5.46,2.86-i*.31,4.8+Math.sin(i)*.09))});
  return trails;
}
