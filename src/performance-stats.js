// Renderer counters cover the whole displayed frame: reflection, shadows,
// scene, AO and postprocessing. They are not unique scene/model counts.
export function summarizeFrames(samples){
  if(!samples.length)return null;
  const times=samples.map(s=>s.ms).sort((a,b)=>a-b);
  const sum=samples.reduce((n,s)=>n+s.ms,0);
  const range=key=>({min:Math.min(...samples.map(s=>s[key])),max:Math.max(...samples.map(s=>s[key])),
    mean:Math.round(samples.reduce((n,s)=>n+s[key],0)/samples.length)});
  return {fps:samples.length*1000/sum,frameMs:sum/samples.length,
    p95Ms:times[Math.ceil(times.length*.95)-1],samples:samples.length,
    drawCalls:range('calls'),triangles:range('triangles')};
}

export function createPerformanceStats(renderer,{mobile=false,quality=mobile?'low':'high'}={}){
  if(new URLSearchParams(location.search).get('stats')!=='1')return {update(){},dispose(){}};
  const panel=document.createElement('aside');panel.className='performance-stats';
  panel.setAttribute('aria-label','실시간 렌더링 통계');
  const header=document.createElement('div');header.className='performance-stats-header';
  const title=document.createElement('strong');title.textContent=`PERFORMANCE · ${{high:'상',medium:'중',low:'하'}[quality]}`;
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','성능 패널 닫기');
  header.append(title,close);
  const values=document.createElement('pre');values.textContent='프레임 측정 중…';
  const note=document.createElement('p');note.textContent='1초 구간 · 반사/그림자/후처리 포함\n메모리는 리소스 개수이며 VRAM 용량이 아닙니다.';
  const mode=document.createElement('a'),url=new URL(location.href);
  const next={high:'medium',medium:'low',low:'high'}[quality];
  url.searchParams.set('quality',next);mode.href=url.href;
  mode.textContent=`품질 ${{high:'상',medium:'중',low:'하'}[next]} 비교 ↗`;
  panel.append(header,values,note,mode);document.body.append(panel);
  let samples=[],last=null,windowMs=0,closed=false;
  const reset=()=>{samples=[];last=null;windowMs=0;};
  document.addEventListener('visibilitychange',reset);
  const dispose=()=>{closed=true;panel.remove();document.removeEventListener('visibilitychange',reset);delete window.__apochillStats;};
  close.addEventListener('click',dispose);
  const integer=n=>Math.round(n).toLocaleString('en-US');
  return {
    dispose,
    update(time){
      if(closed||document.hidden)return;
      if(last===null){last=time;return;}
      const ms=time-last;last=time;if(ms<=0)return;
      const info=renderer.info;
      samples.push({ms,calls:info.render.calls,triangles:info.render.triangles});windowMs+=ms;
      if(windowMs<1000&&samples.length<600)return;
      const stats=summarizeFrames(samples),canvas=renderer.domElement;
      const snapshot={...stats,quality,width:canvas.width,height:canvas.height,
        dpr:renderer.getPixelRatio(),geometries:info.memory.geometries,textures:info.memory.textures,
        programs:info.programs?.length??0,scope:'all passes per displayed frame',measuredAt:new Date().toISOString()};
      window.__apochillStats=snapshot;
      values.textContent=[
        `FPS          ${stats.fps.toFixed(1)}`,
        `프레임 평균  ${stats.frameMs.toFixed(1)} ms`,
        `프레임 P95   ${stats.p95Ms.toFixed(1)} ms`,
        `Draw calls   ${integer(stats.drawCalls.mean)} / frame`,
        `  구간 범위  ${integer(stats.drawCalls.min)} – ${integer(stats.drawCalls.max)}`,
        `Triangles    ${integer(stats.triangles.mean)} / frame`,
        `  구간 범위  ${integer(stats.triangles.min)} – ${integer(stats.triangles.max)}`,
        `해상도       ${canvas.width} × ${canvas.height}`,
        `DPR          ${snapshot.dpr.toFixed(2)}`,
        `Geometry     ${integer(snapshot.geometries)} 개`,
        `Texture      ${integer(snapshot.textures)} 개`,
        `Program      ${integer(snapshot.programs)} 개`,
      ].join('\n');
      samples=[];windowMs=0;
    },
  };
}
