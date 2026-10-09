import * as THREE from 'three';

// Match the concept's upper-right sunlight and lower-left cast shadows.
// Shared by CSM, painted sky/water, cloud shadows and distant terrain shading.
export const SUN_TO_LIGHT=new THREE.Vector3(62,82,-32).normalize();
export const SUN_GLSL=`vec3(${SUN_TO_LIGHT.toArray().map(n=>n.toFixed(6)).join(',')})`;
