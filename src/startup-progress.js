const started=performance.now();
export function setStartupLabel(label){
  for(const selector of ['#load-status','#prologue-wait']){
    const status=document.querySelector(selector);if(status)status.textContent=label;
  }
}
export async function startupStage(stage,label){
  document.documentElement.dataset.startupStage=stage;
  setStartupLabel(label);
  // Local dev breadcrumbs survive a renderer crash; no account/device data is sent.
  if(import.meta.env.DEV){
    try{await fetch('/__apochill_startup',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({stage,elapsedMs:Math.round(performance.now()-started),profile:document.documentElement.dataset.quality??'initial'}),
      signal:AbortSignal.timeout(1000)});}catch{}
  }
  await new Promise(resolve=>setTimeout(resolve,0));
}
