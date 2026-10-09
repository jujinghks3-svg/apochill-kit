import {boundedPixelRatio} from './render-budget.js';
import {QUALITY_KEY,QUALITY_PROFILES,resolveQuality} from './quality-profiles.js';
const requested=new URLSearchParams(location.search).get('quality');
let saved=null;try{saved=localStorage.getItem(QUALITY_KEY);}catch{}
const touchDevice=matchMedia('(pointer: coarse)').matches||/Android|iPhone|iPad/i.test(navigator.userAgent);
export const qualityLevel=resolveQuality(requested,saved,touchDevice);
export const qualityProfile=QUALITY_PROFILES[qualityLevel];
export const mobilePreview=qualityLevel==='low';
export function previewPixelRatio(){
  return boundedPixelRatio(innerWidth,innerHeight,devicePixelRatio,qualityProfile);
}
