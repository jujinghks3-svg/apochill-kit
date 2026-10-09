export const passages=[
  '당신은 이유를 알 수 없이\n완전히 자연으로 돌아간 서울의 옥상에서\n눈을 떴다.',
  '이게 꿈일까?',
  '아니면, 원래 내가 살던 세계가\n일종의 가상 시뮬레이션이었던 걸까?',
  '내가 출근하고, 일하고,\n만나던 사람들은?',
  '당신 앞에 놓인 컴퓨터 한 대.',
  '그 안에는 당신이 살던 기존 세상이\n시뮬레이션되고 있다.',
  '그리고 그 시뮬레이션의 당신은\n당신의 지시를 기다리고 있다.',
];
let start=700;
export const beats=passages.map(text=>{
  let reveal=0;
  const characters=Array.from(text),at=characters.map(char=>{
    const time=reveal;
    reveal+=(char==='\n'?320:/[,.?]/.test(char)?480:char===' '?55:95)/2;
    return time;
  });
  const beat={text,characters,at,start,duration:reveal+1400};
  start+=beat.duration;return beat;
});
export const storyDuration=start;
export function storyFrame(elapsed){
  const index=beats.findIndex(beat=>elapsed<beat.start+beat.duration);
  if(index<0)return {finished:true,progress:1};
  const beat=beats[index],local=Math.max(0,elapsed-beat.start);
  const count=elapsed<beat.start?0:beat.at.filter(time=>time<=local).length;
  return {finished:false,index,text:beat.text,visible:beat.characters.slice(0,count).join(''),
    opacity:Math.min(1,Math.max(0,(beat.duration-local)/400)),progress:Math.max(0,elapsed/storyDuration)};
}
