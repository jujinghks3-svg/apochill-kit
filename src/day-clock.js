export const DAY_SECONDS=600;
const wrap=hour=>((hour%24)+24)%24;

// Absolute monotonic time: slow frames and background tabs must not slow the
// ten-minute day. Slider interaction alone pauses the clock until release.
export function createDayClock(hour=12,now=0){
  let anchorHour=wrap(Number.isFinite(hour)?hour:12),anchorTime=now,paused=false;
  const sample=time=>wrap(anchorHour+(paused?0:Math.max(0,time-anchorTime)/1000*24/DAY_SECONDS));
  return {
    sample,
    seek(hour,time){anchorHour=wrap(Number.isFinite(hour)?hour:12);anchorTime=time;},
    pause(time){anchorHour=sample(time);anchorTime=time;paused=true;},
    resume(time){if(paused){anchorTime=time;paused=false;}},
  };
}
