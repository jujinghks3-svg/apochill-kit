// A single page-entry attempt, with gesture recovery. A manual stop always wins.
export function createBgmAutoplay({player,target=document,isHidden=()=>document.hidden,isControl=event=>Boolean(event.target?.closest?.('.bgm-panel, #prologue-music'))}){
  let armed=false,disposed=false;
  function cancel(){armed=false;}
  function attempt(gesture=false){
    if(!armed||disposed||isHidden()||!player.tracks.length)return;
    if(player.state==='playing'){cancel();return;}
    if(player.state==='loading'&&(!gesture||player.context?.state!=='suspended'))return;
    // Invoke synchronously in the trusted event stack, before any await.
    void player.play({autoplay:!gesture,retryPending:gesture}).then(()=>{
      if(player.state==='playing'||player.state==='error')cancel();
    });
  }
  function gesture(event){
    if(isControl(event)||event.repeat)return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    attempt(true);
  }
  target.addEventListener('click',gesture);
  target.addEventListener('keydown',gesture);
  return {start(){if(disposed)return;armed=true;attempt();},cancel,
    dispose(){disposed=true;cancel();target.removeEventListener('click',gesture);target.removeEventListener('keydown',gesture);}};
}
