// The hero ring: a solitaire built procedurally in three.js (no model files).
// Units: the band's inner radius is 1.

import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import { RoomEnvironment } from './vendor/three-0.185.1/RoomEnvironment.js';

const METALS = {
  yellow18: { color: 0xf2c46e, roughness: 0.14 },
  rose18: { color: 0xf0b49c, roughness: 0.15 },
  platinum: { color: 0xe2e0dc, roughness: 0.12 },
  gold22: { color: 0xf8bb45, roughness: 0.13 },
};

// Stone profiles as [radius, height] from the culet (bottom point) up to the table (top face).
const BRILLIANT = [[0.001, -0.86], [1, -0.03], [1, 0.03], [0.8, 0.17], [0.55, 0.3], [0.001, 0.3]];
const STEP = [[0.001, -0.72], [0.38, -0.56], [0.72, -0.3], [1, -0.03], [1, 0.03], [0.86, 0.13], [0.7, 0.21], [0.001, 0.21]];

const CUTS = {
  round: { profile: BRILLIANT, seg: 24, phi: 0, sx: 1, sz: 1, size: 1, prongs: 6 },
  oval: { profile: BRILLIANT, seg: 24, phi: 0, sx: 0.84, sz: 1.2, size: 1, prongs: 6 },
  princess: { profile: STEP, seg: 4, phi: Math.PI / 4, sx: 1, sz: 1, size: 1.16, prongs: 4 },
  emerald: { profile: STEP, seg: 8, phi: Math.PI / 8, sx: 0.84, sz: 1.22, size: 1.06, prongs: 4 },
};

const GEM_R = 0.41;          // stone radius
const BAND_TOP = 1.15;       // outer radius of the band
const GIRDLE_Y = 1.53;       // height of the stone's widest point

export function initRing(canvas, initial, { reducedMotion = false, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 2.1, 7.2);
  camera.lookAt(0, 0.28, 0);

  const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2b0, 1.4);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // ── materials ──
  const metal = new THREE.MeshPhysicalMaterial({
    color: METALS[initial.metal].color,
    metalness: 1,
    roughness: METALS[initial.metal].roughness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.25,
    side: THREE.DoubleSide,
  });
  const targetColor = metal.color.clone();
  let targetRoughness = metal.roughness;

  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    transmission: 1,
    thickness: 0.6,
    ior: 2.42,
    dispersion: 4,
    specularIntensity: 1,
    envMapIntensity: 2.6,
    flatShading: true,
  });

  const ring = new THREE.Group();
  scene.add(ring);

  // ── band: a comfort-fit cross-section swept round the finger ──
  const profile = [];
  const N = 64;
  const rMid = 1.075, halfT = 0.075, halfW = 0.16;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    profile.push(new THREE.Vector2(
      rMid + halfT * Math.sign(c) * Math.pow(Math.abs(c), 0.55),
      halfW * Math.sign(s) * Math.pow(Math.abs(s), 0.55),
    ));
  }
  const bandGeo = new THREE.LatheGeometry(profile, 160);
  bandGeo.rotateX(Math.PI / 2);
  ring.add(new THREE.Mesh(bandGeo, metal));

  // ── head: stone, claws and gallery rail; rebuilt when the cut changes ──
  const head = new THREE.Group();
  head.position.y = GIRDLE_Y;
  ring.add(head);

  // little glints that flash on the crown
  const glintTex = makeGlintTexture();
  const glints = Array.from({ length: 3 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glintTex, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    s.userData = { t: Math.random() * 4, period: 2.6 + Math.random() * 2.4 };
    head.add(s);
    return s;
  });

  function buildHead(cutKey) {
    for (const child of [...head.children]) {
      if (child.isSprite) continue;
      head.remove(child);
      child.traverse?.((o) => o.geometry?.dispose());
    }
    const cut = CUTS[cutKey];
    const r = GEM_R * cut.size;

    const pts = cut.profile.map(([x, y]) => new THREE.Vector2(x, y));
    const gemGeo = new THREE.LatheGeometry(pts, cut.seg, cut.phi);
    gemGeo.scale(r * cut.sx, r, r * cut.sz);
    head.add(new THREE.Mesh(gemGeo, gemMat));

    // claws sit on the stone's corners (or evenly round a round stone)
    const step = (Math.PI * 2) / cut.prongs;
    const offset = cut.prongs === 4 ? cut.phi : step / 2;
    for (let k = 0; k < cut.prongs; k++) {
      const a = offset + k * step;
      const dx = Math.sin(a) * cut.sx, dz = Math.cos(a) * cut.sz;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(dx * r * 0.45, BAND_TOP - GIRDLE_Y - 0.04, dz * r * 0.45),
        new THREE.Vector3(dx * r * 0.8, -0.2, dz * r * 0.8),
        new THREE.Vector3(dx * r * 1.05, 0.0, dz * r * 1.05),
        new THREE.Vector3(dx * r * 0.9, r * 0.24, dz * r * 0.9),
      ]);
      head.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.028, 10), metal));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), metal);
      tip.position.copy(curve.getPoint(1));
      head.add(tip);
    }

    const rail = new THREE.Mesh(new THREE.TorusGeometry(r * 0.66, 0.022, 10, 64), metal);
    rail.rotation.x = Math.PI / 2;
    rail.scale.set(cut.sx, cut.sz, 1);
    rail.position.y = -0.17;
    head.add(rail);

    glints.forEach((g, i) => {
      const a = i * 2.1 + 0.4;
      g.position.set(Math.sin(a) * r * 0.55 * cut.sx, r * 0.3, Math.cos(a) * r * 0.55 * cut.sz);
    });
  }
  buildHead(initial.cut);

  // ── interaction: drag to turn, otherwise a slow showroom spin ──
  let spin = 0.6, tilt = 0, velocity = 0, dragging = false, lastX = 0, lastY = 0, idleFor = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velocity = dx * 0.008;
    spin += velocity;
    tilt = THREE.MathUtils.clamp(tilt + dy * 0.004, -0.5, 0.5);
    idleFor = 0;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ── changes from the brief / controls ──
  let popT = 1, pendingCut = null, currentCut = initial.cut;
  window.addEventListener('kanvas:ring', (e) => {
    const { metal: m, cut } = e.detail;
    targetColor.setHex(METALS[m].color);
    targetRoughness = METALS[m].roughness;
    if (cut !== currentCut) { pendingCut = cut; popT = 0; }
  });

  // ── sizing & visibility ──
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  // ── render loop ──
  const timer = new THREE.Timer();
  let readySent = false;

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.05);
    if (!visible || document.hidden) return;

    if (!dragging) {
      idleFor += dt;
      velocity *= 0.94;
      spin += velocity + (reducedMotion ? 0 : dt * 0.35 * Math.min(1, idleFor / 1.5));
      tilt *= 0.97;
    }
    ring.rotation.y = spin;
    ring.rotation.x = tilt;
    ring.position.y = reducedMotion ? 0 : Math.sin(timer.getElapsed() * 0.9) * 0.05;

    metal.color.lerp(targetColor, 1 - Math.pow(0.002, dt));
    metal.roughness += (targetRoughness - metal.roughness) * (1 - Math.pow(0.002, dt));

    // the head shrinks away, swaps cut, and springs back
    if (popT < 1) {
      popT = Math.min(1, popT + dt * 2.4);
      if (pendingCut && popT >= 0.4) { buildHead(pendingCut); currentCut = pendingCut; pendingCut = null; }
      const s = popT < 0.4 ? 1 - easeIn(popT / 0.4) : easeOutBack((popT - 0.4) / 0.6);
      head.scale.setScalar(Math.max(0.001, s));
    }

    if (!reducedMotion) {
      glints.forEach((g) => {
        g.userData.t += dt;
        const p = (g.userData.t % g.userData.period) / g.userData.period;
        const flash = p < 0.12 ? Math.sin((p / 0.12) * Math.PI) : 0;
        g.material.opacity = flash;
        g.material.rotation = g.userData.t * 0.8;
        g.scale.setScalar(0.12 + flash * 0.16);
      });
    }

    renderer.render(scene, camera);
    if (!readySent) { readySent = true; onReady?.(); }
  });
}

function easeIn(t) { return t * t; }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeGlintTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  const core = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.15, 'rgba(255,250,235,0.7)');
  core.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[size, 3], [3, size]]) {
    const ray = g.createLinearGradient(mid - w / 2, mid - h / 2, mid + w / 2, mid + h / 2);
    ray.addColorStop(0, 'rgba(255,255,255,0)');
    ray.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ray;
    g.fillRect(mid - w / 2, mid - h / 2, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
