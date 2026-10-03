// Hero visual: Three.js crystal scene on capable desktops, light CSS/SVG version everywhere else.
import {gem} from './icons.js';

const forced = new URLSearchParams(location.search).get('hero'); // ?hero=3d | ?hero=lite (testing)

function shouldLite() {
  if (forced === 'lite') return true;
  if (forced === '3d') return false;
  const mq = q => matchMedia(q).matches;
  if (mq('(prefers-reduced-motion: reduce)') || mq('(pointer:coarse)') || innerWidth < 980) return true;
  if ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4) return true;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return true; } catch { return true; }
  return false;
}

export async function mountHero(box) {
  if (shouldLite()) return lite(box);
  try {
    const T = await import('/vendor/three-kit.js');
    await new Promise(r => setTimeout(r, 700)); // let the headline animate first
    full(box, T);
  } catch (e) {
    console.warn('3D hero unavailable, using light version', e);
    lite(box);
  }
}

function lite(box) {
  box.innerHTML = `<div class="hero-lite"><span class="ring"></span><span class="ring r2"></span>${gem('gem')}
    <i class="bubble" style="width:70px;height:70px;left:4%;top:18%;animation-delay:-2s"></i>
    <i class="bubble" style="width:44px;height:44px;right:6%;top:10%;animation-delay:-5s"></i>
    <i class="bubble" style="width:92px;height:92px;right:0;bottom:12%;animation-delay:-1s"></i>
    <i class="bubble" style="width:36px;height:36px;left:14%;bottom:6%;animation-delay:-7s"></i></div>`;
  const el = box.firstElementChild;
  if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
    el.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
  }, {passive: true});
}

function full(box, T) {
  const canvas = document.createElement('canvas');
  box.append(canvas);
  const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = T.SRGBColorSpace;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 0, 10);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new T.RoomEnvironment(), .03).texture;

  // colored key lights paint the facets in the brand palette
  const lights = [
    [0x6d5efc, 60, [-5, 2, 4]], [0xff5ca8, 55, [5, -1, 3]], [0xb15cff, 45, [0, 5, 2]], [0x3b82f6, 35, [-2, -5, 3]], [0xffffff, 18, [3, 4, 6]],
  ].map(([c, i, p]) => { const l = new T.PointLight(c, i, 30, 1.6); l.position.set(...p); scene.add(l); return l; });
  scene.add(new T.AmbientLight(0x2a2450, 1.2));

  const crystal = (color, extra = {}) => new T.MeshPhysicalMaterial({
    color, metalness: .12, roughness: .07, clearcoat: 1, clearcoatRoughness: .04, iridescence: 1, iridescenceIOR: 1.45,
    iridescenceThicknessRange: [180, 820], envMapIntensity: 1.5, flatShading: true, ...extra,
  });

  // the gem: an 8-sided brilliant (crown + pavilion) matching the logo
  const gemGroup = new T.Group();
  const gemMat = crystal(0xd9ccff, {emissive: 0x3a1f9e, emissiveIntensity: .22});
  const crown = new T.Mesh(new T.CylinderGeometry(.66, 1.08, .46, 8, 1), gemMat);
  crown.position.y = .23;
  const pavilion = new T.Mesh(new T.ConeGeometry(1.08, 1.42, 8, 1), gemMat);
  pavilion.rotation.x = Math.PI; pavilion.position.y = -.71;
  gemGroup.add(crown, pavilion);
  gemGroup.scale.setScalar(1.55);
  gemGroup.rotation.z = .08;

  // floating crystal shapes around it
  const shapes = [
    [new T.TorusGeometry(.42, .16, 24, 64), crystal(0xffb3d9), 2.9, .35, .55],
    [new T.IcosahedronGeometry(.36, 0), crystal(0xb7a8ff), 3.3, -.45, .4],
    [new T.SphereGeometry(.3, 32, 32), crystal(0x9cc3ff, {flatShading: false}), 2.6, 1.6, .7],
    [new T.RoundedBoxGeometry(.5, .5, .5, 4, .12), crystal(0xd7a8ff, {flatShading: false}), 3.6, 2.6, .3],
    [new T.OctahedronGeometry(.26, 0), crystal(0xff9fcf), 2.4, 3.6, .9],
    [new T.TorusKnotGeometry(.22, .07, 90, 12), crystal(0xc9bbff, {flatShading: false}), 3.1, 4.6, .5],
  ].map(([geo, mat, r, a, s]) => { const m = new T.Mesh(geo, mat); m.userData = {r, a, s, y: (Math.random() - .5) * 1.6}; return m; });

  const world = new T.Group();
  world.add(gemGroup, ...shapes);
  scene.add(world);

  let w = 0, h = 0;
  const resize = () => {
    w = box.clientWidth; h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w < 520 ? 12.5 : 10;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(box);
  resize();

  const target = {x: 0, y: 0}, cur = {x: 0, y: 0};
  addEventListener('pointermove', e => { target.x = e.clientX / innerWidth - .5; target.y = e.clientY / innerHeight - .5; }, {passive: true});

  let visible = true, running = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(box);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const clock = new T.Clock();
  const intro = {t: 0};
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || !running) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    intro.t = Math.min(1, intro.t + dt * .7);
    const ease = 1 - Math.pow(1 - intro.t, 3);
    cur.x += (target.x - cur.x) * .05; cur.y += (target.y - cur.y) * .05;
    world.rotation.y = cur.x * .7; world.rotation.x = cur.y * .45;
    gemGroup.rotation.y = time * .45;
    gemGroup.position.y = Math.sin(time * 1.1) * .12;
    gemGroup.scale.setScalar(1.55 * (.6 + .4 * ease));
    for (const m of shapes) {
      const {r, a, s, y} = m.userData, ang = a + time * s * .35;
      m.position.set(Math.cos(ang) * r * ease, y + Math.sin(time * s + a) * .25, Math.sin(ang) * r * .55);
      m.rotation.x += dt * s; m.rotation.y += dt * s * .7;
    }
    lights[0].position.x = -5 + Math.sin(time * .6) * 1.5;
    lights[1].position.y = -1 + Math.cos(time * .5) * 1.5;
    const sc = Math.min(1, scrollY / (innerHeight * .9));
    camera.position.y = -sc * 1.4;
    box.style.opacity = String(1 - sc * .9);
    renderer.render(scene, camera);
  }
  frame();
}
