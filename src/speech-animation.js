export function typingFrame(text,seconds,{loop=true,reduced=false,step=.075,hold=2.5,fade=.3}={}){
  const characters=Array.from(text),typing=characters.length*step,duration=typing+hold+fade;
  const local=loop?Math.max(0,seconds)%duration:Math.max(0,seconds);
  if(!loop&&local>=duration)return {text:'',dots:'',opacity:0,finished:true};
  const count=reduced?characters.length:Math.min(characters.length,Math.floor(local/step));
  return {text:characters.slice(0,count).join(''),
    dots:count===characters.length?'.'.repeat(reduced?3:1+Math.floor(Math.max(0,local-typing)/.45)%3):'',
    opacity:reduced?1:Math.min(1,Math.max(0,(duration-local)/fade)),finished:false};
}
export function createBarkCycle({random=Math.random}={}){
  let countdown=8+random()*6,age=-1;
  return {update(dt,allowed=true,reduced=false){
    dt=Math.min(.1,Math.max(0,dt));
    if(!allowed){age=-1;countdown=Math.max(countdown,5);return {visible:false};}
    if(age<0){countdown-=dt;if(countdown>0)return {visible:false};age=0;}
    else age+=dt;
    const frame=typingFrame('월월!!',age,{loop:false,reduced,step:.13,hold:1.5,fade:.4});
    if(frame.finished){age=-1;countdown=18+random()*20;return {visible:false};}
    return {...frame,visible:true};
  }};
}
