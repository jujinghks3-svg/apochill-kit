import { meadowNoise, smooth } from './meadow-field.js';
import {CONCEPT,hexRGB} from './concept-palette.js';

export const GROWTH_TILES = 16;

export function sampleCityGrowth(u, v, variant) {
  const seed=variant*7.31;
  const broad=meadowNoise(u*5+seed,v*6+23);
  const detail=meadowNoise(u*22+seed,v*24+3);
  let cover=0;
  for(let i=0;i<3;i++) {
    const centre=.07+i*.38+(meadowNoise(seed,i*3)-.5)*.32;
    const length=.32+meadowNoise(seed+4,i+9)*.64;
    const bottom=1-length;
    const trail=centre+Math.sin(v*13+i*2+seed)*.065+(broad-.5)*.11;
    const lobes=.65+meadowNoise(seed+i*2,v*18)*.75;
    const width=(.062+meadowNoise(seed+11,i+4)*.10)*(.25+smooth(bottom,1,v)*.75)*lobes;
    const edge=(detail-.5)*.052;
    const ribbon=1-smooth(width*.76,width+edge+.014,Math.abs(u-trail));
    cover=Math.max(cover,ribbon*smooth(bottom-.025,bottom+.13,v));
  }
  const lip=smooth(.9+(broad-.5)*.09,1,v)*smooth(.2,.7,broad);
  const fringe=meadowNoise(u*42+seed,v*55+seed);
  const mask=smooth(.05,.87,Math.max(cover,lip)-(fringe-.5)*.22);
  return {mask,tone:.25+smooth(0,1,v)*.55+(broad-.5)*.15,detail};
}

export function createCityGrowthPixels(tileSize=128) {
  const width=tileSize*4,height=tileSize*4,data=new Uint8Array(width*height*4);
  const root=hexRGB(CONCEPT.tree[2]),tip=hexRGB(CONCEPT.tree[4]);
  for(let tile=0;tile<GROWTH_TILES;tile++) for(let y=0;y<tileSize;y++) for(let x=0;x<tileSize;x++) {
    const f=sampleCityGrowth((x+.5)/tileSize,1-(y+.5)/tileSize,tile);
    const offset=(((Math.floor(tile/4)*tileSize+y)*width)+(tile%4)*tileSize+x)*4;
    for(let c=0;c<3;c++)data[offset+c]=Math.round((root[c]+(tip[c]-root[c])*f.tone)*(.83+smooth(.2,.8,f.detail)*.30));
    data[offset+3]=Math.round(f.mask*255);
  }
  return {data,width,height};
}
