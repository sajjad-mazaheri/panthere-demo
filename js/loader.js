// loader.js -- wireframe diamond: fallback geometry, GLB decode, draw animation

import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { getMouse } from './scene.js';

const DRACO_DECODER_PATH = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/';
const GLB_JSON_CHUNK = 0x4E4F534A;
const GLB_BIN_CHUNK = 0x004E4942;

let wireframe = null;
let wireframeMaterial = null;
let totalVertices = 0;
let drawProgress = 0;
let wireframeReadyPromise = null;

function buildFallbackGeometry() {
  const segments = [];
  const topRadius = 0.18;
  const girdleRadius = 0.62;
  const crownY = 0.34;
  const girdleY = 0.02;
  const pavilionY = -0.72;
  const tableY = 0.48;
  const sides = 8;
  const table = [];
  const girdle = [];
  const culet = new THREE.Vector3(0, pavilionY, 0);

  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / sides;
    table.push(new THREE.Vector3(Math.cos(angle) * topRadius, tableY, Math.sin(angle) * topRadius));
    girdle.push(new THREE.Vector3(Math.cos(angle) * girdleRadius, girdleY, Math.sin(angle) * girdleRadius));
  }

  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides;
    segments.push(table[i], table[next]);
    segments.push(girdle[i], girdle[next]);
    segments.push(table[i], girdle[i]);
    segments.push(girdle[i], culet);

    const star = new THREE.Vector3(
      (table[i].x + girdle[i].x) * 0.5,
      crownY,
      (table[i].z + girdle[i].z) * 0.5
    );
    const starNext = new THREE.Vector3(
      (table[next].x + girdle[next].x) * 0.5,
      crownY,
      (table[next].z + girdle[next].z) * 0.5
    );

    segments.push(table[i], star);
    segments.push(star, girdle[i]);
    segments.push(star, starNext);
  }

  const positions = new Float32Array(segments.length * 3);
  segments.forEach((point, index) => {
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function parseGlb(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);

  if (magic !== 0x46546C67 || version < 2) {
    throw new Error('Unsupported GLB format for wireframe loader.');
  }

  let offset = 12;
  let jsonChunk = null;
  let binChunk = null;

  while (offset < arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;

    const chunk = arrayBuffer.slice(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === GLB_JSON_CHUNK) jsonChunk = chunk;
    if (chunkType === GLB_BIN_CHUNK) binChunk = chunk;
  }

  if (!jsonChunk || !binChunk) {
    throw new Error('Missing GLB chunks for wireframe loader.');
  }

  return {
    json: JSON.parse(new TextDecoder().decode(jsonChunk)),
    binaryChunk: binChunk,
  };
}

function normalizeDecodedGeometry(sourceGeometry) {
  const geometry = sourceGeometry.clone();
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.rotateY(Math.PI);
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius || 1;
  const scale = 1.0 / radius;
  geometry.scale(scale, scale, scale);
  return geometry;
}

function applyWireframeGeometry(geometry) {
  totalVertices = geometry.attributes.position.count;
  geometry.setDrawRange(0, Math.floor(totalVertices * drawProgress));

  if (wireframe.geometry) {
    wireframe.geometry.dispose();
  }

  wireframe.geometry = geometry;
}

async function decodeDiamondWireframe(glbUrl) {
  const response = await fetch(glbUrl);
  if (!response.ok) {
    throw new Error(`Wireframe asset failed to load: ${glbUrl}`);
  }

  const { json, binaryChunk } = parseGlb(await response.arrayBuffer());
  const meshDef = json.meshes.find((mesh) => mesh.name === 'Diamond_Round') || json.meshes[0];
  const primitive = meshDef?.primitives?.[0];
  const dracoExt = primitive?.extensions?.KHR_draco_mesh_compression;

  if (!dracoExt) {
    throw new Error('Diamond mesh does not expose Draco compression metadata.');
  }

  const bufferView = json.bufferViews?.[dracoExt.bufferView];
  if (!bufferView) {
    throw new Error('Diamond Draco bufferView is missing.');
  }

  const rawBuffer = binaryChunk.slice(
    bufferView.byteOffset || 0,
    (bufferView.byteOffset || 0) + bufferView.byteLength
  );

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  dracoLoader.setDecoderConfig({ type: 'js' });
  dracoLoader.preload();

  const geometry = await new Promise((resolve, reject) => {
    try {
      dracoLoader.decodeDracoFile(
        rawBuffer,
        resolve,
        {
          position: dracoExt.attributes.POSITION,
          normal: dracoExt.attributes.NORMAL,
        },
        {
          position: Float32Array,
          normal: Float32Array,
        }
      );
    } catch (error) {
      reject(error);
    }
  });

  geometry.computeVertexNormals();
  dracoLoader.dispose();

  const normalizedGeometry = normalizeDecodedGeometry(geometry);
  geometry.dispose();
  return new THREE.WireframeGeometry(normalizedGeometry);
}

export function syncWireframeToMesh(mesh) {
  if (!wireframe || !mesh?.geometry) return;

  const sourceGeometry = mesh.geometry.clone();
  const normalizedGeometry = normalizeDecodedGeometry(sourceGeometry);
  const wireframeGeometry = new THREE.WireframeGeometry(normalizedGeometry);

  sourceGeometry.dispose();
  normalizedGeometry.dispose();
  applyWireframeGeometry(wireframeGeometry);
}

export function createWireframeDiamond(scene, glbUrl = './assets/ring.glb') {
  wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xC4A265,
    transparent: true,
    opacity: 0.92,
  });

  wireframe = new THREE.LineSegments(new THREE.BufferGeometry(), wireframeMaterial);
  wireframe.position.set(0, 0.48, 0);
  wireframe.scale.setScalar(0.7);
  scene.add(wireframe);
  applyWireframeGeometry(buildFallbackGeometry());
  wireframe.geometry.setDrawRange(0, 0);

  wireframeReadyPromise = Promise.resolve();

  return wireframe;
}

export function waitForWireframeGeometry() {
  return Promise.resolve();
}

export function getWireframe() {
  return wireframe;
}

export function getWireframeMaterial() {
  return wireframeMaterial;
}

export function animateWireframeDraw(duration = 2000, onProgress = null) {
  return new Promise((resolve) => {
    const startTime = performance.now();

    function draw() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      drawProgress = 1 - Math.pow(1 - t, 3);
      const count = Math.max(0, Math.floor(totalVertices * drawProgress) & ~1);
      wireframe.geometry.setDrawRange(0, count);

      if (typeof onProgress === 'function') {
        onProgress(t);
      }

      if (t < 1) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    }

    draw();
  });
}

export function initWireframeMouseTilt() {
  // uses getMouse() from scene.js, no extra listener needed
}

export function updateWireframeTilt() {
  if (!wireframe) return;
  const mouse = getMouse();
  wireframe.rotation.x += (mouse.y * -0.11 - wireframe.rotation.x) * 0.05;
  wireframe.rotation.y += (mouse.x * 0.16 - wireframe.rotation.y) * 0.05;
  wireframe.rotation.z += (mouse.x * -0.035 - wireframe.rotation.z) * 0.04;
}
