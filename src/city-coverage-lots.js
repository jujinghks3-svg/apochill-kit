// Coverage is independent of the central city's density budget: orbiting the
// camera must not expose the unfilled sides after that budget has been reached.
export function cityCoverageLots(){
  const lots=[];
  for(let row=0;row<32;row++)for(let col=-16;col<=16;col++){
    const hash=(Math.imul(col+37,73856093)^Math.imul(row+19,19349663))>>>0;
    const x=col*15.5+(row%2?3.4:-3.4)+(hash%11-5)*.23;
    const z=64-row*16+((hash>>>8)%9-4)*.26;
    const distance=Math.hypot(x-13,z-20),near=distance<100;
    const asset=hash%5===0?`kit-glass-${near?0:(hash>>>6)%3}`:
      `kit-concrete-${9+(hash>>>4)%4}`;
    lots.push({x,z,w:10.5+(hash%4)*.8,d:9.5+(hash>>>9)%4*.7,
      h:near?21+(hash%4):30+(hash>>>12)%7*5,asset,
      yaw:((hash>>>14)%4)*Math.PI/2+((hash>>>18)%5-2)*.025,
      coverage:true});
  }
  return lots;
}
