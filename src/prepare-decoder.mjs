import { copyFile, mkdir } from 'node:fs/promises';
const source = new URL('../node_modules/three/examples/jsm/libs/draco/gltf/', import.meta.url);
const destination = new URL('../assets/web/draco/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js']) {
  await copyFile(new URL(file, source), new URL(file, destination));
}
console.log('Local Draco decoder ready.');
