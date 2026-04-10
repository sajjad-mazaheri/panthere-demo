// scene.js -- three.js setup: renderer, camera, lights, env map, particles

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export let scene, camera, renderer, controls, cursorLight;
export let goldParticles = null;

const _mouse = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _intersectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _cursorPoint = new THREE.Vector3();

export function getCursorPoint() { return _cursorPoint; }

export function initScene() {
  // Renderer — alpha for transparent canvas over HTML backgrounds
  const canvas = document.getElementById('canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.background = 'transparent';

  // Scene — NO background, transparent so HTML shows through
  scene = new THREE.Scene();
  scene.background = null;

  // Camera
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  // LIGHTING — Rich 3-point jewelry studio lighting

  // Key light — warm, strong, from upper-right
  const keyLight = new THREE.DirectionalLight(0xFFF0DC, 3.6);
  keyLight.position.set(3.5, 5.5, 4.5);
  scene.add(keyLight);

  // Fill light — cool blue, softer, from left
  const fillLight = new THREE.DirectionalLight(0xECEFF3, 1.1);
  fillLight.position.set(-5, 1.8, 2.4);
  scene.add(fillLight);

  // Rim / back light — warm edge highlight
  const rimLight = new THREE.DirectionalLight(0xFFDDB5, 2.9);
  rimLight.position.set(-1.5, 3.2, -5.5);
  scene.add(rimLight);

  // Bottom fill — prevents pure black underneath
  const bottomLight = new THREE.DirectionalLight(0xF7C992, 1.25);
  bottomLight.position.set(5, -1.2, 1.5);
  scene.add(bottomLight);

  // Ambient — very subtle, keeps shadows from being pitch black
  const ceilingBounce = new THREE.PointLight(0xF8DBC2, 0.95, 10, 2);
  ceilingBounce.position.set(0, 4.6, 1.4);
  scene.add(ceilingBounce);

  const hemiLight = new THREE.HemisphereLight(0xF8F3EA, 0x140D08, 0.45);
  scene.add(hemiLight);

  const ambient = new THREE.AmbientLight(0xFFF8F0, 0.08);
  scene.add(ambient);

  // Cursor-following point light — highlights where user looks
  cursorLight = new THREE.PointLight(0xFFFFFF, 1.1, 9, 2);
  cursorLight.position.set(0, 0, 2.8);
  scene.add(cursorLight);


  // Build a procedural "jewelry studio" environment with multiple bright panels
  // This gives realistic metallic reflections and gem refraction
  buildStudioEnvironment();

  // OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.6;
  controls.maxPolarAngle = Math.PI * 0.7;
  controls.minPolarAngle = Math.PI * 0.3;
  controls.autoRotate = false;

  // Mouse tracking
  document.addEventListener('mousemove', onMouseMove, { passive: true });

  // Resize
  window.addEventListener('resize', onResize);

  // Create gold particles (hidden)
  createGoldParticles();

  // Create stars
  createStars();
}

function createStudioGradientTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#f7e6c8');
  gradient.addColorStop(0.28, '#6f5640');
  gradient.addColorStop(0.55, '#1b1820');
  gradient.addColorStop(1, '#050506');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = ctx.createRadialGradient(
    canvas.width * 0.52,
    canvas.height * 0.42,
    canvas.height * 0.08,
    canvas.width * 0.52,
    canvas.height * 0.42,
    canvas.height * 0.78
  );
  vignette.addColorStop(0, 'rgba(255,255,255,0.28)');
  vignette.addColorStop(0.4, 'rgba(255,230,196,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addPanelLight(targetScene, { width, height, color, intensity, position, lookAt = new THREE.Vector3(0, 0, 0) }) {
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    })
  );
  panel.position.copy(position);
  panel.lookAt(lookAt);
  targetScene.add(panel);
  return panel;
}

function buildStudioEnvironment() {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  // Dark studio background
  envScene.background = new THREE.Color(0x0a0a0a);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 24),
    new THREE.MeshBasicMaterial({
      map: createStudioGradientTexture(),
      side: THREE.BackSide,
    })
  );
  envScene.add(dome);

  // Large overhead softbox — bright white
  const softboxGeo = new THREE.PlaneGeometry(6, 6);
  const softboxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const softbox = new THREE.Mesh(softboxGeo, softboxMat);
  softbox.position.set(0, 5, 0);
  softbox.rotation.x = Math.PI / 2;
  envScene.add(softbox);

  addPanelLight(envScene, {
    width: 2.2,
    height: 7,
    color: 0xffffff,
    intensity: 1.05,
    position: new THREE.Vector3(7, 1.2, 0.8),
  });

  // Front key panel — warm white, slightly off-center
  const keyPanelGeo = new THREE.PlaneGeometry(4, 3);
  const keyPanelMat = new THREE.MeshBasicMaterial({ color: 0xFFF5E6, side: THREE.DoubleSide });
  const keyPanel = new THREE.Mesh(keyPanelGeo, keyPanelMat);
  keyPanel.position.set(3, 2, 4);
  keyPanel.lookAt(0, 0, 0);
  envScene.add(keyPanel);

  // Left fill panel — cool blue tint
  const fillPanelGeo = new THREE.PlaneGeometry(3, 3);
  const fillPanelMat = new THREE.MeshBasicMaterial({ color: 0xF0F2F5, side: THREE.DoubleSide });
  const fillPanel = new THREE.Mesh(fillPanelGeo, fillPanelMat);
  fillPanel.position.set(-4, 1, 3);
  fillPanel.lookAt(0, 0, 0);
  envScene.add(fillPanel);

  addPanelLight(envScene, {
    width: 3.6,
    height: 4.6,
    color: 0xf2f4f7,
    intensity: 0.82,
    position: new THREE.Vector3(-6, 1.2, 1.6),
  });

  // Rim / back panel — warm accent
  const rimPanelGeo = new THREE.PlaneGeometry(5, 2);
  const rimPanelMat = new THREE.MeshBasicMaterial({ color: 0xFFE0B0, side: THREE.DoubleSide });
  const rimPanel = new THREE.Mesh(rimPanelGeo, rimPanelMat);
  rimPanel.position.set(0, 2, -5);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  addPanelLight(envScene, {
    width: 6,
    height: 2.2,
    color: 0xffc891,
    intensity: 1.15,
    position: new THREE.Vector3(4.5, 2.4, 5.2),
    lookAt: new THREE.Vector3(0, 0.2, 0),
  });

  // Small bright spot — creates a sharp "catch light" in diamonds
  const spotGeo = new THREE.SphereGeometry(0.4, 16, 16);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const spot1 = new THREE.Mesh(spotGeo, spotMat);
  spot1.position.set(2, 3, 2);
  envScene.add(spot1);

  const spot2 = new THREE.Mesh(spotGeo, spotMat.clone());
  spot2.position.set(-1, 4, 1);
  envScene.add(spot2);

  // Floor — dark, subtle reflection source
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -3, 0);
  floor.rotation.x = -Math.PI / 2;
  envScene.add(floor);

  const warmWall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshBasicMaterial({ color: 0x18110d, side: THREE.DoubleSide })
  );
  warmWall.position.set(0, 0, -10);
  envScene.add(warmWall);

  const envTexture = pmremGenerator.fromScene(envScene, 0.03).texture;
  scene.environment = envTexture;

  // Clean up
  pmremGenerator.dispose();
  envScene.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
}

function onMouseMove(e) {
  _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  // Cursor light follows mouse
  if (cursorLight) {
    cursorLight.position.x = _mouse.x * 3.1;
    cursorLight.position.y = _mouse.y * 2.15;
    cursorLight.position.z = 2.8 + Math.abs(_mouse.x) * 0.3;
  }

  // 3D cursor point for physics
  _raycaster.setFromCamera(_mouse, camera);
  _raycaster.ray.intersectPlane(_intersectPlane, _cursorPoint);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function createStars() {
  const container = document.getElementById('stars-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 180; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const tier = Math.random();
    const size = tier > 0.88 ? 2.4 + Math.random() * 2.2 : 0.7 + Math.random() * 2.1;
    const opacity = tier > 0.88 ? 0.92 : 0.32 + Math.random() * 0.48;
    const blur = tier > 0.88 ? 0.3 + Math.random() * 0.7 : Math.random() * 0.4;
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.opacity = opacity.toFixed(3);
    star.style.filter = `blur(${blur.toFixed(2)}px)`;
    // mix of warm gold and cool white stars
    const warm = Math.random() > 0.45;
    if (warm) {
      star.style.background = `rgba(255, ${210 + Math.random() * 40}, ${160 + Math.random() * 50}, 0.9)`;
    }
    if (tier > 0.72) {
      const glow = 4 + Math.random() * 10;
      const glowColor = warm
        ? `rgba(212,176,108,0.38), 0 0 ${(glow * 2.4).toFixed(2)}px rgba(196,162,101,0.14)`
        : `rgba(255,255,255,0.42), 0 0 ${(glow * 2.4).toFixed(2)}px rgba(122,166,255,0.16)`;
      star.style.boxShadow = `0 0 ${glow.toFixed(2)}px ${glowColor}`;
    }
    star.style.animationDelay = (Math.random() * 3) + 's';
    star.style.animationDuration = (2.4 + Math.random() * 3.6) + 's';
    container.appendChild(star);
  }
}

function createGoldParticles() {
  const count = 100;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.03
    ));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xD4BA82,
    size: 0.02,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  goldParticles = new THREE.Points(geometry, material);
  goldParticles._velocities = velocities;
  goldParticles._active = false;
  goldParticles.visible = false;
  scene.add(goldParticles);
}

export function activateGoldParticles() {
  if (!goldParticles) return;
  goldParticles.visible = true;
  goldParticles._active = true;
  goldParticles.material.opacity = 0.8;
  const pos = goldParticles.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (Math.random() - 0.5) * 0.5;
    pos[i + 1] = (Math.random() - 0.5) * 0.5;
    pos[i + 2] = (Math.random() - 0.5) * 0.5;
  }
  goldParticles.geometry.attributes.position.needsUpdate = true;
}

export function deactivateGoldParticles() {
  if (!goldParticles) return;
  goldParticles._active = false;
}

export function updateGoldParticles() {
  if (!goldParticles || !goldParticles._active) return;
  const pos = goldParticles.geometry.attributes.position.array;
  const vels = goldParticles._velocities;
  for (let i = 0; i < vels.length; i++) {
    pos[i * 3] += vels[i].x;
    pos[i * 3 + 1] += vels[i].y;
    pos[i * 3 + 2] += vels[i].z;
  }
  goldParticles.geometry.attributes.position.needsUpdate = true;
  goldParticles.material.opacity *= 0.995;
  if (goldParticles.material.opacity < 0.01) {
    goldParticles.visible = false;
    goldParticles._active = false;
  }
}

export function getMouse() { return _mouse; }
