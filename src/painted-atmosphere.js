import {dayLightingGLSL} from './daylight-state.js';
// Shared analytic sky: water reflects this field without another scene render.
export const paintedAtmosphereGLSL = /* glsl */`
${dayLightingGLSL}
uniform float dayWeatherRain,dayCloudCoverage;
uniform vec3 daySkyTop,daySkyHorizon,dayCloudDark,dayCloudLight;
float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float skyNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+1.),f.x),f.y);
}
float skyBody(vec2 p){
  float value=0.,weight=.53;
  for(int i=0;i<5;i++){
    value+=skyNoise(p)*weight;
    p=mat2(.8,-.6,.6,.8)*p*2.03+3.71;weight*=.48;
  }
  return value;
}
vec3 paintedAtmosphere(vec3 direction,float time){
  vec3 d=normalize(direction);
  vec3 sky=mix(daySkyHorizon,daySkyTop,smoothstep(-.035,.36,d.y));
  vec2 p=vec2(atan(d.x,-d.z)*5.2+time*.002,d.y*10.5)+vec2(4.1,2.3);
  p+=vec2(skyNoise(p*1.8),skyNoise(p*1.8+9.))*.25;
  float body=skyBody(p),towardSun=skyBody(p+vec2(.055,.08));
  // A second, smaller cumulus scale fills gaps between larger cloud banks.
  // Lower coverage threshold increases cloud count, not just their brightness.
  float small=skyBody(p*1.83+vec2(17.4,8.1));
  float density=body+(small-.45)*.24+skyNoise(p*21.)*.025;
  float cloudThreshold=mix(.55,.27,dayCloudCoverage);
  float mask=smoothstep(cloudThreshold,cloudThreshold+.08,density)*smoothstep(.015,.07,d.y);
  // Density and a directional derivative sculpt light lobes and blue undersides.
  float volume=smoothstep(.43,.68,density);
  float light=clamp(.34+(body-towardSun)*4.8+volume*.46+(small-.5)*.18,0.,1.);
  vec3 cloud=mix(dayCloudDark,dayCloudLight,smoothstep(.40,.90,light));
  float rim=(1.-smoothstep(.52,.60,body))*max(body-towardSun,0.)*2.;
  cloud+=vec3(.22,.19,.11)*rim*daySurfaceTint;
  sky=mix(sky,cloud,mask);
  float alignment=max(dot(d,daySunDirection),0.);
  // A slightly enlarged, antialiased solar disc shares the actual daylight axis.
  float angularDistance=length(d-daySunDirection);
  float disc=1.-smoothstep(.010,.014,angularDistance);
  float halo=exp(-angularDistance*angularDistance/ .0065);
  float transmission=1.-mask*.94;
  vec3 solarTint=mix(vec3(1.,.40,.12),vec3(1.,.91,.67),smoothstep(.02,.45,daySunDirection.y));
  return sky+solarTint*(disc*9.+halo*.52+pow(alignment,32.)*.10)*transmission*daySunStrength;
}
`;
