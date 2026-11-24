import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('gl');
const stage = canvas.parentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const startHover = (stage.dataset.start || 'hover') === 'hover';   // data-start="hover" | "cruise"

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.75;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.15;

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
if (startHover) camera.position.set(0, 0.12, 1.9);   // head-on to the upper surface, hover pose
else camera.position.set(1.15, 0.55, -1.25);           // three-quarter view from ahead

const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, -1); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfc6d0, 2.6); rim.position.set(-2, 0.5, 2.5); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x30343a, 0x000000, 0.6));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 0.7; controls.maxDistance = 3.8;
controls.autoRotate = !startHover && !reduce; controls.autoRotateSpeed = 0.6;

const pivot = new THREE.Group(); scene.add(pivot);

// stealth materials by part group (node names set in the export)
const M = {
  skin:    new THREE.MeshStandardMaterial({ color: 0x101113, metalness: 0.1, roughness: 0.38, side: THREE.DoubleSide }),
  engine:  new THREE.MeshStandardMaterial({ color: 0x2c2e33, metalness: 0.85, roughness: 0.32 }),
  nozzle:  new THREE.MeshStandardMaterial({ color: 0x1f2024, metalness: 0.9,  roughness: 0.3 }),
  harness: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.05, roughness: 0.9 }),
  metal:   new THREE.MeshStandardMaterial({ color: 0x4a4d53, metalness: 0.9,  roughness: 0.35 }),
  red:     new THREE.MeshStandardMaterial({ color: 0x5a1414, metalness: 0.2,  roughness: 0.6 }),
};
const pilotParts = [];
import('./final.js').then((m) => {
  const bin = Uint8Array.from(atob(m.default), (c) => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', onModel, onFail);
}).catch(onFail);
function onFail() { document.getElementById('loading').textContent = 'Model unavailable'; }
function onModel(g) {
  const root = g.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry.attributes.color) o.geometry.deleteAttribute('color');
    o.geometry.computeVertexNormals();
    const k = (o.name || o.parent?.name || 'skin').split('_')[0];
    o.material = M[k] || M.skin;
    if (k === 'harness' || k === 'metal' || k === 'red') pilotParts.push(o);
  });
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.setScalar(0.8 / size.x);            // fit the 3 m wing to the stage
  box = new THREE.Box3().setFromObject(root);
  root.position.sub(box.getCenter(new THREE.Vector3()));
  pivot.add(root);
  document.getElementById('loading').remove();
}

// view states
let targetPitch = startHover ? Math.PI / 2 : 0, pitch = targetPitch;
const hPitch = document.getElementById('h-pitch'), hMode = document.getElementById('h-mode');
const bC = document.getElementById('b-cruise'), bH = document.getElementById('b-hover');
const bX = document.getElementById('b-xray'), bS = document.getElementById('b-spin');
function setMode(hover) {
  targetPitch = hover ? Math.PI / 2 : 0;
  bH.setAttribute('aria-pressed', hover); bC.setAttribute('aria-pressed', !hover);
  hMode.textContent = hover ? 'Hover · tail-sitting' : 'Wing-borne';
}
bC.onclick = () => setMode(false);
bH.onclick = () => setMode(true);
bX.onclick = () => {
  const on = bX.getAttribute('aria-pressed') !== 'true';
  bX.setAttribute('aria-pressed', on);
  pilotParts.forEach((o) => { o.visible = on; });
};
bS.onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  bS.setAttribute('aria-pressed', controls.autoRotate);
};
bS.setAttribute('aria-pressed', controls.autoRotate);
setMode(startHover);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (w > 900) camera.setViewOffset(w, h, -w * 0.14, h * 0.06, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();
if (camera.aspect < 1) camera.position.multiplyScalar(startHover ? 2.4 / 1.9 : 1.9);   // narrow screens: back off so the span fits

function tick() {
  pitch += (targetPitch - pitch) * (reduce ? 1 : 0.06);
  pivot.rotation.x = pitch;
  pivot.position.y = reduce ? 0 : Math.sin(performance.now() / 1400) * 0.008;
  hPitch.textContent = Math.round(pitch * 180 / Math.PI) + '°';
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
