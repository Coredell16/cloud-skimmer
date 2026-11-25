/* Cloud Skimmer · flight simulation and canvas effects. */
(() => {
  'use strict';

  const canvas = document.getElementById('flightCanvas');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const random = (a, b) => a + Math.random() * (b - a);
  const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  const storage = {
    read(key, fallback) {
      try { return localStorage.getItem('skimmer.' + key) ?? fallback; }
      catch { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem('skimmer.' + key, String(value)); }
      catch { /* Private browsing can disable persistence. */ }
    }
  };

  const bestKeys = ['best', 'best.2', 'best.3'];
  const bestScores = bestKeys.map(key => Number(storage.read(key, 0)) || 0);
  let stage = 1;
  let muted = storage.read('mute', 'false') === 'true';
  let mode = 'menu';
  let width = 1, height = 1, ratio = 1, playerSize = 40;
  let score = 0, lives = 3, charge = 0, elapsed = 0;
  let nextEnemy = 0, nextShot = 0, nextWave = 0;
  let patternCycle = -1, patternPhase = -1, patternStep = 0;
  let sceneClock = 0, lastFrame = 0, shake = 0, audioContext;
  let camX = 0, camY = 0, pointer = null, previousState = '';
  let enemies = [], shots = [], hazards = [], particles = [], labels = [], arcs = [], exhaust = [];
  let pilot = { x: 0, y: 0, bank: 0, vx: 0, vy: 0, shield: 0 };
  const keys = new Set();

  function state() {
    return { mode, stage, score, lives, charge, best: bestScores[stage - 1], remaining: Math.max(0, 60 - Math.floor(elapsed)), muted };
  }
  function notify() {
    const detail = state(), signature = JSON.stringify(detail);
    if (signature === previousState) return;
    previousState = signature;
    window.dispatchEvent(new CustomEvent('flightstate', { detail }));
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const sx = rect.width / width, sy = rect.height / height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ratio = dpr;
    playerSize = clamp(Math.min(width * .094, height * .10), 28, 54);
    if (sx !== 1 || sy !== 1) {
      for (const item of [pilot, ...enemies, ...shots, ...hazards, ...particles, ...exhaust, ...labels]) {
        item.x *= sx;
        item.y *= sy;
      }
      for (const arc of arcs) for (const point of arc.path) {
        point.x *= sx;
        point.y *= sy;
      }
      for (const enemy of enemies) {
        enemy.baseX *= sx;
        enemy.speed *= sy;
        enemy.drift *= sx;
      }
      for (const bullet of hazards) { bullet.vx *= sx; bullet.vy *= sy; }
      pointer = null;
    }
  }

  function enableSound() {
    if (muted) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      audioContext ||= new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { /* Play remains available when audio is unavailable. */ }
  }
  function beep(freq, endFreq, length, volume, type = 'sine') {
    if (muted || !audioContext || audioContext.state !== 'running') return;
    const at = audioContext.currentTime;
    const osc = audioContext.createOscillator(), env = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
    env.gain.setValueAtTime(.0001, at);
    env.gain.exponentialRampToValueAtTime(volume, at + Math.min(.012, length * .2));
    env.gain.exponentialRampToValueAtTime(.0001, at + length);
    osc.connect(env).connect(audioContext.destination);
    osc.start(at);
    osc.stop(at + length);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  function toggleMute() {
    muted = !muted;
    storage.write('mute', muted);
    if (!muted) { enableSound(); beep(520, 800, .1, .04); }
    notify();
  }
  function releaseInput() {
    keys.clear();
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null;
  }
  function start() {
    resize(); releaseInput(); enableSound();
    mode = 'play'; score = 0; lives = 3; charge = 0; elapsed = 0;
    camX = 0; camY = 0; shake = 0; nextShot = .12; nextEnemy = .15; nextWave = 0;
    patternCycle = -1; patternPhase = -1; patternStep = 0;
    enemies = []; shots = []; hazards = []; particles = []; labels = []; arcs = []; exhaust = [];
    pilot = { x: width / 2, y: height * .79, bank: 0, vx: 0, vy: 0, shield: .85 };
    beep(340, 760, .23, .055, 'triangle');
    notify();
  }
  function pause() {
    if (mode !== 'play') return;
    mode = 'paused'; releaseInput(); notify();
  }
  function resume() {
    if (mode !== 'paused') return;
    mode = 'play'; releaseInput(); enableSound(); lastFrame = performance.now(); notify();
  }
  function finish(nextMode) {
    mode = nextMode; releaseInput();
    if (score > bestScores[stage - 1]) {
      bestScores[stage - 1] = score;
      storage.write(bestKeys[stage - 1], score);
    }
    beep(nextMode === 'win' ? 420 : 170, nextMode === 'win' ? 970 : 55, .45, .07, 'triangle');
    notify();
  }
  function menu() {
    mode = 'menu'; releaseInput(); score = 0; lives = 3; charge = 0; elapsed = 0;
    camX = 0; camY = 0; shake = 0; notify();
  }
  function selectStage(number) {
    if (mode !== 'menu' || !Number.isInteger(number) || number < 1 || number > bestScores.length) return;
    stage = number;
    notify();
  }
  function nextStage() {
    if (mode !== 'win' || stage === bestScores.length) return;
    stage++;
    start();
  }

  const movementKeys = new Set(['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((mode === 'play' || mode === 'paused') && (event.code === 'Escape' || event.code === 'KeyP')) {
      event.preventDefault();
      if (!event.repeat) mode === 'play' ? pause() : resume();
      return;
    }
    if (mode !== 'play' || !movementKeys.has(event.code)) return;
    event.preventDefault(); keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', event => {
    if (mode !== 'play' || pointer || event.button !== 0) return;
    event.preventDefault();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, tx: pilot.x, ty: pilot.y };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const gain = event.pointerType === 'touch' ? 1.45 : 1;
    pointer.tx = clamp(pointer.tx + (event.clientX - pointer.x) * gain, playerSize * .64, width - playerSize * .64);
    pointer.ty = clamp(pointer.ty + (event.clientY - pointer.y) * gain, topEdge(), height - playerSize * .62);
    pointer.x = event.clientX; pointer.y = event.clientY;
  });
  const endPointer = event => { if (pointer?.id === event.pointerId) pointer = null; };
  for (const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name, endPointer);

  function topEdge() { return Math.min(height * .42, 66 + playerSize * .45); }
  function updatePilot(dt) {
    const dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const dy = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const speed = clamp(Math.min(height * .82, width * .82), 250, 500) / (dx && dy ? Math.SQRT2 : 1);
    const oldX = pilot.x, oldY = pilot.y;
    pilot.x = clamp(pointer ? approach(oldX, pointer.tx, 36, dt) : oldX + dx * speed * dt,
      playerSize * .64, width - playerSize * .64);
    pilot.y = clamp(pointer ? approach(oldY, pointer.ty, 36, dt) : oldY + dy * speed * dt,
      topEdge(), height - playerSize * .62);
    pilot.vx = approach(pilot.vx, (pilot.x - oldX) / dt, 11, dt);
    pilot.vy = approach(pilot.vy, (pilot.y - oldY) / dt, 11, dt);
    pilot.bank = approach(pilot.bank, clamp(pilot.vx / 430, -1, 1), 12, dt);
    const intensity = reduceMotion.matches ? .20 : 1;
    camX = approach(camX, intensity * (pilot.bank * 20 + (pilot.x / width - .5) * 16), 4.4, dt);
    camY = approach(camY, intensity * (clamp(pilot.vy / 400, -1, 1) * 9 + (pilot.y / height - .6) * 9), 4.4, dt);
    pilot.shield = Math.max(0, pilot.shield - dt);
    nextShot -= dt;
    if (nextShot <= 0) {
      for (const side of [-1,1]) shots.push({ x: pilot.x + side * playerSize * .27, y: pilot.y - playerSize * .10 });
      nextShot += .18;
      beep(530, 270, .056, .011, 'triangle');
    }
    if (exhaust.length === 0 || exhaust[exhaust.length - 1].life < .47) {
      exhaust.push({ x: pilot.x, y: pilot.y + playerSize * .33, life: .50, bank: pilot.bank });
    }
  }
  function spawnEnemy() {
    const edge = playerSize * .85;
    const lane = nextWave % 3;
    const spawnX = lane === 0 ? pilot.x + random(-width * .07,width * .07) :
      lane === 1 ? width * random(.10,.49) : width * random(.51,.90);
    const x = clamp(spawnX, edge, width - edge);
    const ace = nextWave % 5 === 4;
    enemies.push({
      x, y: -playerSize, baseX: x, size: playerSize * (ace ? 1.14 : .90), age: 0,
      speed: height * random(.095,.15) * (1 + elapsed / 160), hp: ace ? 3 : 2,
      period: random(1.3,2.2), phase: random(0,Math.PI * 2), fire: random(.8,1.3),
      drift: random(.018,.050) * width, ace, flash: 0
    });
    nextWave++;
  }
  const warningSeconds = 1.15;
  const rowInterval = .62;
  const curtainRows = 4;
  function crossingX(side, age) {
    return width * ((side === 1 ? .12 : .88) + side * age * .165);
  }
  function spawnCrossingPair() {
    for (const side of [-1, 1]) {
      const x = crossingX(side, 0);
      enemies.push({
        x, y: -playerSize, baseX: x, size: playerSize, age: 0,
        speed: height * .195, hp: 2, cross: side, drift: 0,
        fire: 1.3, ace: false, flash: 0
      });
    }
  }
  function curtainGap(row) {
    // Successive rows sweep to the right, then the next volley sweeps back left.
    const fraction = patternCycle % 2 === 0 ? row / (curtainRows - 1) : 1 - row / (curtainRows - 1);
    return width * (.3 + fraction * .4);
  }
  function gapRadius() {
    return Math.max(playerSize * 1.1, width * .125);
  }
  function spawnCurtain(row) {
    const center = curtainGap(row), opening = gapRadius();
    const columns = Math.max(2, Math.ceil(width / (playerSize * .32 + 5)));
    for (let col = 0; col <= columns; col++) {
      const x = col * width / columns;
      if (Math.abs(x - center) <= opening) continue;
      hazards.push({ x, y: -8, vx: 0, vy: height * .32, grazed: false, curtain: true });
    }
  }
  function updatePattern() {
    if (stage === 1 || elapsed < 1.8) return;
    const period = stage === 2 ? 6.2 : 8;
    const time = elapsed - 1.8;
    const cycle = Math.floor(time / period);
    if (cycle !== patternCycle) { patternCycle = cycle; patternStep = 0; }
    patternPhase = time - cycle * period;
    if (stage === 2) {
      if (patternStep === 0 && patternPhase >= warningSeconds) {
        spawnCrossingPair(); patternStep++;
      }
    } else if (patternStep < curtainRows && patternPhase >= warningSeconds + patternStep * rowInterval) {
      spawnCurtain(patternStep++);
    }
  }
  function enemyFire(enemy) {
    const dx = pilot.x - enemy.x, dy = pilot.y - enemy.y;
    const base = Math.atan2(dy, dx);
    const speed = clamp(height * .32, 130, 230) * (1 + elapsed / 190);
    const spread = !enemy.cross && (enemy.ace || elapsed > 38) ? [-.20,0,.20] : [0];
    for (const angle of spread) {
      hazards.push({ x: enemy.x, y: enemy.y + enemy.size * .28,
        vx: Math.cos(base + angle) * speed, vy: Math.sin(base + angle) * speed, grazed: false });
    }
  }
  function burst(x,y,colors,count,force) {
    for (let i=0; i<count; i++) {
      const angle = random(0,Math.PI * 2), speed = random(force / 5, force);
      const life = random(.16,.55);
      particles.push({ x,y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life,
        size: random(2,5), color: colors[i % colors.length] });
    }
  }
  function label(x,y,text,color) {
    labels.push({ x, y, text, color, life: .8 });
  }
  function addArc(a,b) {
    const path = [{x:a.x,y:a.y}];
    const count = Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/24);
    for (let i=1; i<count; i++) path.push({
      x: a.x + (b.x-a.x) * i/count + random(-8,8),
      y: a.y + (b.y-a.y) * i/count + random(-8,8)
    });
    path.push({x:b.x,y:b.y}); arcs.push({path,life:.24});
  }
  function killEnemy(enemy, chain = false) {
    enemy.dead = true; score += enemy.ace ? 220 : 100;
    burst(enemy.x,enemy.y,['#fff9cb','#ffd35a','#ff8455','#576174'],16,130);
    if (chain) return;
    beep(140, 48, .12, .032, 'sawtooth');
    if (charge < 100) return;
    charge = 0;
    addArc(pilot,enemy);
    let source = enemy;
    for (let i=0; i<4; i++) {
      let nearest, distance = Infinity;
      for (const candidate of enemies) {
        if (candidate.dead || candidate.y < 0 || candidate.y > height) continue;
        const d = Math.hypot(candidate.x - source.x,candidate.y - source.y);
        if (d < distance) { distance = d; nearest = candidate; }
      }
      if (!nearest) break;
      addArc(source,nearest); killEnemy(nearest,true); source = nearest;
    }
    score += 120;
    label(enemy.x, Math.max(76,enemy.y), '连锁闪电', '#c5ffff');
    beep(790,110,.25,.05,'sawtooth');
    shake = .12;
  }
  function hitPilot() {
    if (pilot.shield > 0 || mode !== 'play') return;
    lives--; shake = .28; pilot.shield = 2;
    burst(pilot.x,pilot.y,['#ff9363','#fff3c7','#d65c49'],24,145);
    beep(170,45,.27,.08,'sawtooth');
    if (lives === 0) finish('over');
  }
  function update(dt) {
    elapsed = Math.min(60, elapsed + dt);
    if (elapsed >= 60) { score += lives * 200; finish('win'); return; }
    updatePilot(dt);
    nextEnemy -= dt;
    if (nextEnemy <= 0) {
      spawnEnemy();
      const spacing = stage === 1 ? 1 : stage === 2 ? 1.35 : 1.55;
      nextEnemy += Math.max(.68, 1.38 - elapsed * .011) * random(.85,1.14) * spacing;
    }
    updatePattern();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      enemy.age += dt; enemy.y += enemy.speed * dt;
      enemy.x = enemy.cross ? crossingX(enemy.cross, enemy.age) :
        clamp(enemy.baseX + Math.sin(enemy.age * enemy.period + enemy.phase) * enemy.drift,
          enemy.size/2, width-enemy.size/2);
      enemy.flash = Math.max(0, enemy.flash - dt); enemy.fire -= dt;
      if (enemy.fire <= 0 && enemy.y > 65 && enemy.y < pilot.y - playerSize) {
        enemyFire(enemy); enemy.fire = random(1.55,2.45) * (1 - elapsed / 250);
      }
      if (Math.hypot(pilot.x-enemy.x,pilot.y-enemy.y) < (enemy.size+playerSize) * .24) {
        if (pilot.shield <= 0) { enemy.dead = true; hitPilot(); }
        if (mode === 'over') return;
      }
    }
    for (const shot of shots) {
      shot.y -= clamp(height * 1.05, 380, 740) * dt;
      for (const enemy of enemies) {
        if (enemy.dead || Math.abs(enemy.x - shot.x) > enemy.size * .42 ||
            Math.abs(enemy.y - shot.y) > enemy.size * .42) continue;
        shot.dead = true; enemy.hp--; enemy.flash = .095;
        if (enemy.hp === 0) killEnemy(enemy);
        else burst(shot.x,shot.y,['#fff8d6','#b2fdff'],4,65);
        break;
      }
    }
    for (const bullet of hazards) {
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
      if (pilot.shield > 0 || mode !== 'play') continue;
      const distance = Math.hypot(bullet.x-pilot.x,bullet.y-pilot.y);
      if (distance < playerSize * .16 + 3) {
        bullet.dead = true; hitPilot();
        if (mode === 'over') return;
      }
      else if (!bullet.grazed && distance < playerSize * .64 + 3) {
        bullet.grazed = true; score += 25;
        const before = charge;
        charge = Math.min(100, charge + 20);
        const ready = before < 100 && charge === 100;
        label(pilot.x, pilot.y - playerSize * .55, ready ? '闪电就绪' : '擦弹 +25', '#fcf4ae');
        burst(bullet.x,bullet.y,['#fff9bc','#aef5f0'],7,85);
        beep(ready ? 500 : 820, ready ? 1250 : 1450, .125, .035);
      }
    }
    enemies = enemies.filter(enemy => !enemy.dead && enemy.y < height + enemy.size);
    hazards = hazards.filter(b => !b.dead && b.y > -30 && b.y < height + 30 && b.x > -30 && b.x < width + 30);
    shots = shots.filter(b => !b.dead && b.y > -16);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2*dt); p.vy *= Math.exp(-2*dt); p.life -= dt;
    }
    for (const p of exhaust) { p.y += height * .24 * dt; p.life -= dt; }
    for (const t of labels) { t.y -= 22 * dt; t.life -= dt; }
    for (const a of arcs) a.life -= dt;
    particles = particles.filter(p => p.life > 0);
    exhaust = exhaust.filter(p => p.life > 0);
    labels = labels.filter(t => t.life > 0);
    arcs = arcs.filter(a => a.life > 0);
    shake = Math.max(0, shake - dt);
    notify();
  }

  function sprite(kind,x,y,size,bank,time) {
    if (window.SkimmerSprites) window.SkimmerSprites.draw(ctx,kind,x,y,size,bank,time);
  }
  function drawIntro(t) {
    const mobile = width < 550;
    const amplitude = reduceMotion.matches ? 0 : 1;
    const size = clamp(Math.min(width * .157,height * .33),58,170);
    const px = width * (mobile ? .75 : .69) + Math.sin(t * .62) * 3 * amplitude;
    const py = height * (mobile ? .70 : .61) + Math.cos(t * .82) * 3 * amplitude;
    const heading = .28;
    ctx.save();
    ctx.translate(px,py); ctx.rotate(heading);
    // Staggered, tapered condensation trails drift out from each wing.
    const length = size * 1.48;
    for (const side of [-1,1]) {
      for (let i=30; i>=0; i--) {
        const k = i / 30;
        const wind = Math.sin(k * 2.8 + t * .55) * size * .035 * k * amplitude;
        ctx.globalAlpha = .34 * (1-k);
        ctx.fillStyle = i % 3 === 0 ? '#deffed' : '#bdebe6';
        const span = size * (.024+k*.057);
        ctx.fillRect(Math.round(side*size*.32 + wind - span/2),Math.round(size*.17 + length*k),
          Math.max(2,Math.round(span)),Math.ceil(length/29));
      }
    }
    ctx.globalAlpha = 1;
    sprite('player',0,0,size,.22,t);
    const phase = reduceMotion.matches ? .30 : (t * .38) % 1;
    if (phase < .72) {
      const distance = size * (.61 + phase * 1.23);
      ctx.globalAlpha = Math.min(.84, (.72 - phase) * 3);
      for (const side of [-1,1]) {
        const x = side * size * .22;
        ctx.fillStyle = '#8aded9'; ctx.fillRect(x-2,-distance,4,size*.085);
        ctx.fillStyle = '#ffffc2'; ctx.fillRect(x-1,-distance-2,2,size*.068);
      }
    }
    ctx.restore();
    const marks = mobile ? [[.88,.20,.37],[.57,.12,.30]] : [[.83,.25,.35],[.91,.33,.30],[.76,.18,.26]];
    for (let i=0; i<marks.length; i++) {
      const [x,y,f] = marks[i];
      const ex = width*x + amplitude * Math.sin(t*.51+i)*3, ey = height*y + amplitude * Math.cos(t*.4+i)*2;
      ctx.save(); ctx.translate(ex,ey); ctx.rotate(.17);
      sprite(i === 0 ? 'enemy2' : 'enemy',0,0,size*f,-.24,t+i*.4);
      ctx.restore();
    }
  }
  function drawPatternWarning() {
    if (stage === 1 || patternPhase < 0) return;
    if (stage === 2 && patternStep !== 0 || stage === 3 && patternStep === curtainRows) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    let caption, x;
    if (stage === 2) {
      ctx.strokeStyle = '#ffdd9b';
      ctx.setLineDash([7, 8]);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(crossingX(side, 0), -playerSize);
        ctx.lineTo(crossingX(side, 2.8), height * .195 * 2.8 - playerSize);
        ctx.stroke();
      }
      x = width / 2; caption = '交叉编队';
    } else {
      x = curtainGap(patternStep); caption = '弹幕缺口';
      ctx.strokeStyle = '#9cfbdc';
      for (const side of [-1, 1]) {
        const edge = x + side * gapRadius();
        ctx.beginPath(); ctx.moveTo(edge - side * 9, 11);
        ctx.lineTo(edge, 11); ctx.lineTo(edge, 29); ctx.stroke();
      }
    }
    ctx.fillStyle = '#132c3e'; ctx.fillRect(Math.round(x) - 33, 10, 66, 20);
    ctx.fillStyle = stage === 2 ? '#ffdd9b' : '#9cfbdc';
    ctx.fillText(caption, x, 24);
    ctx.restore();
  }
  function drawCombat() {
    ctx.save();
    const bump = reduceMotion.matches ? 0 : shake * 18;
    ctx.translate(-camX * .71 + Math.sin(sceneClock*93)*bump, -camY*.71 + Math.cos(sceneClock*79)*bump);
    drawPatternWarning();
    for (const t of exhaust) {
      ctx.globalAlpha = .28*t.life/.5; ctx.fillStyle = '#ecffef';
      const span = Math.max(2, playerSize*(.025+(.5-t.life)*.12));
      for (const sign of [-1,1]) ctx.fillRect(t.x + sign*playerSize*.27 - t.bank*playerSize*.18,
        t.y,span,playerSize*.16);
    }
    ctx.globalAlpha = 1;
    for (const enemy of enemies) {
      if (enemy.cross) {
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(-enemy.cross * .40);
        sprite('enemy2', 0, 0, enemy.size, enemy.cross * .7, sceneClock);
        ctx.restore();
      } else {
        sprite(enemy.ace?'enemy2':'enemy',enemy.x,enemy.y,enemy.size,
          Math.cos(enemy.age * enemy.period + enemy.phase)*.38,sceneClock);
      }
      if (enemy.flash > 0) { ctx.fillStyle='#fff3a8'; ctx.fillRect(enemy.x-3,enemy.y-3,6,6); }
    }
    for (const shot of shots) {
      ctx.fillStyle = '#4bcadb'; ctx.fillRect(shot.x-2.4,shot.y-6,4.8,13);
      ctx.fillStyle = '#ebffff'; ctx.fillRect(shot.x-1.1,shot.y-6,2.2,8);
    }
    for (const bullet of hazards) {
      const r = clamp(playerSize*.096,3.3,5.2);
      ctx.fillStyle=bullet.curtain?'#522c68':'#8d3855'; ctx.fillRect(bullet.x-r-1,bullet.y-r+1,r*2+2,r*2-2);
      ctx.fillRect(bullet.x-r+1,bullet.y-r-1,r*2-2,r*2+2);
      ctx.fillStyle=bullet.curtain?'#ec91e2':'#ff8c67'; ctx.fillRect(bullet.x-r,bullet.y-r,r*2,r*2);
      ctx.fillStyle='#fff2c0'; ctx.fillRect(bullet.x-r*.48,bullet.y-r*.48,r*.96,r*.96);
    }
    if (lives > 0) {
      ctx.globalAlpha = pilot.shield > 0 && Math.floor(pilot.shield*9)%2 ? .59 : 1;
      sprite('player',pilot.x,pilot.y,playerSize,pilot.bank,sceneClock);
      ctx.globalAlpha = 1;
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1,p.life/p.max*1.7); ctx.fillStyle=p.color;
      ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);
    }
    for (const a of arcs) {
      ctx.globalAlpha = Math.min(1,a.life/.14);
      ctx.beginPath(); ctx.moveTo(a.path[0].x,a.path[0].y);
      for (let i=1; i<a.path.length; i++) ctx.lineTo(a.path[i].x,a.path[i].y);
      ctx.strokeStyle='#42dded'; ctx.lineWidth=6; ctx.stroke();
      ctx.strokeStyle='#f1ffff'; ctx.lineWidth=2; ctx.stroke();
    }
    ctx.font='bold 13px system-ui,sans-serif'; ctx.textAlign='center'; ctx.lineWidth=3;
    for (const t of labels) {
      ctx.globalAlpha=Math.min(1,t.life/.22); ctx.strokeStyle='#345c62'; ctx.fillStyle=t.color;
      const x=clamp(t.x,44,width-44); ctx.strokeText(t.text,x,t.y); ctx.fillText(t.text,x,t.y);
    }
    ctx.restore();
  }
  function frame(now) {
    const dt = Math.min(.05, Math.max(.001, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (!document.hidden) {
      if (mode === 'menu' || mode === 'play') sceneClock += dt;
      if (mode === 'play') update(dt);
      ctx.setTransform(ratio,0,0,ratio,0,0); ctx.imageSmoothingEnabled = false;
      window.SkimmerScenery?.draw(ctx,width,height,sceneClock,camX,camY,mode === 'menu' ? 'menu' : 'play',stage);
      if (mode === 'menu') drawIntro(sceneClock); else drawCombat();
    }
    requestAnimationFrame(frame);
  }
  window.Flight = { start,pause,resume,menu,selectStage,nextStage,toggleMute,state };
  new ResizeObserver(resize).observe(canvas);
  resize(); notify(); requestAnimationFrame(frame);
})();
