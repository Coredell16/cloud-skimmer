/* Low-resolution background plates for the sea patrol. */
(() => {
  'use strict';

  const tau = 2 * Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (v, n) => ((v % n) + n) % n;
  const blend = (a, b, t) => a + (b - a) * t;
  const rgb = value => [value >> 16, (value >> 8) & 255, value & 255];
  const tone = (a, b, t) => a.map((channel, i) => Math.round(blend(channel, b[i], t)));

  function random(seed) {
    return () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function grain(x, y, seed) {
    let v = Math.imul(x + seed * 3, 1597334677) ^ Math.imul(y - seed * 5, 3812015801);
    v = Math.imul(v ^ (v >>> 16), 2246822507);
    return ((v ^ (v >>> 13)) >>> 0) / 4294967295;
  }

  function noise(x, y, seed) {
    const u = Math.floor(x), v = Math.floor(y);
    let a = x - u, b = y - v;
    a *= a * (3 - 2 * a);
    b *= b * (3 - 2 * b);
    return blend(blend(grain(u, v, seed), grain(u + 1, v, seed), a),
      blend(grain(u, v + 1, seed), grain(u + 1, v + 1, seed), a), b);
  }

  // The water is a seamless tile. Long, slightly broken strokes describe
  // currents while much smaller groups of crests catch the light.
  function ocean() {
    const size = 384, img = surface(size, size);
    const ctx = img.getContext('2d'), pixels = ctx.createImageData(size, size);
    const deep = rgb(0x207689), blue = rgb(0x4ca7aa);
    const colors = Array.from({length: 32}, (_, i) => tone(deep, blue, i / 31));
    for (let y = 0; y < size; y++) {
      const Y = y * tau / size;
      for (let x = 0; x < size; x++) {
        const X = x * tau / size;
        const wave = Math.sin(X - 2 * Y + 1.7 * Math.sin(Y)) * .14
          + Math.sin(X * 2 + Y * 3 + Math.sin(X)) * .085
          + Math.sin(Y * 11 + X * 3 + 2.8 * Math.sin(Y * 3 - X)) * .027;
        const col = colors[clamp(Math.floor((.51 + wave) * 31), 0, 31)];
        const i = (y * size + x) * 4;
        pixels.data[i] = col[0]; pixels.data[i + 1] = col[1]; pixels.data[i + 2] = col[2]; pixels.data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const r = random(1308);
    for (let i = 0; i < 405; i++) {
      const cx = Math.floor(r() * size), cy = Math.floor(r() * size);
      const w = Math.floor(2 + Math.pow(r(), 2) * 13);
      ctx.fillStyle = i % 5 ? 'rgba(172,229,214,.16)' : 'rgba(19,94,115,.24)';
      for (let j = 0; j < w; j++) {
        if (r() > .09) ctx.fillRect((cx + j) % size, (cy - Math.floor(j / 8) + size) % size, 1, 1);
      }
      if (i % 7 === 0) ctx.fillRect((cx + w - 3 + size) % size, (cy + 2) % size, 4, 1);
    }
    return img;
  }

  const seaPalette = [0x479d9c,0x59afab,0x6bc0b6,0x8fd1bd,0xa6dec9,0xd4ebd1].map(rgb);
  const beach = [0xc0aa83,0xd1ba91,0xe4d1a7,0xf3e2b8,0xdcc99a].map(rgb);
  const vegetation = [0x4c7c63,0x59865e,0x67915c,0x729b60,0x7fa566,0x93ae68,0xa7b96e,0xb9c87f].map(rgb);
  const cliff = [0x65807c,0x828c80,0x9a9682,0xb2a78c,0xcbba9e,0xe2cdab,0xebd6b3].map(rgb);

  function island(seed, rx, ry, relief) {
    const pad = 16, w = Math.ceil(rx * 2.9 + pad * 2), h = Math.ceil(ry * 3.2 + relief * 1.7 + pad * 2);
    const cx = Math.floor(w / 2), cy = Math.floor(h * .53 + relief * .35);
    const out = surface(w, h), ctx = out.getContext('2d'), image = ctx.createImageData(w, h);
    const data = image.data, r = random(seed);
    const phase = Array.from({length: 5}, () => r() * tau);
    const trees = [];
    const heightMap = new Int16Array(w * h).fill(-1);
    function paint(x, y, color, alpha = 255) {
      if (y < 0 || y >= h || x < 0 || x >= w) return;
      const i = (y * w + x) * 4;
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = alpha;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dy = (y - cy) / ry, dx = (x - cx) / rx + dy * .24;
        const a = Math.atan2(dy, dx);
        const edge = 1 + .12 * Math.sin(a * 3 + phase[0]) + .09 * Math.sin(a * 5 + phase[1])
          + .055 * Math.sin(a * 7 + phase[2]) + .038 * Math.cos(a * 11 + phase[3]);
        const coast = (edge - Math.hypot(dx, dy)) * ry + (noise(x * .14, y * .14, seed) - .5) * 2;
        const shoal = noise(x * .11, y * .12, seed + 1);
        const grainValue = grain(x, y, seed);
        if (coast < -10) continue;
        if (coast < 0) {
          const depth = coast + (shoal - .5) * 1.7;
          let layer = depth < -7 ? 0 : depth < -4.7 ? 1 : depth < -2.1 ? 2 : 3;
          const crest = (depth > -5.2 && depth < -4.3 && shoal > .32)
            || (depth > -1.7 && depth < -.4 && shoal > .13);
          if (crest) layer = depth < -3 ? 4 : 5;
          paint(x, y, seaPalette[layer], depth < -7 ? 55 + Math.max(0, (depth + 10) * 27) : 244);
          continue;
        }
        const brush = noise(x / 8, y / 6, seed + 3);
        const rocky = noise(x / 19, y / 14, seed + 6);
        const ledge = coast + (rocky - .5) * ry * .52;
        const foot = .7 + Math.max(0, (1 - dx) * 1.45);
        const first = ledge > foot;
        const second = ledge > ry * .32 + 1.3;
        const third = ledge > ry * .6 + 1.5;
        const z = Math.floor(first ? (relief * .53 + rocky * 1.7 + (second ? relief * .30 : 0) + (third ? relief * .28 : 0)) : 1);
        heightMap[y * w + x] = z;
        let topColor;
        if (!first) {
          topColor = beach[clamp(Math.floor((brush * .68 + grainValue * .32) * 5), 0, 4)];
        } else {
          const sun = .51 + brush * .33 + (rocky - .5) * .45 - dx * .11 + (grainValue - .5) * .12;
          topColor = vegetation[clamp(Math.floor((sun - .19) * 8), 0, 7)];
          if (ledge < foot + 1.3) topColor = grainValue > .4 ? vegetation[6] : beach[1];
          if (brush > .69 && grainValue > .77) topColor = vegetation[7];
        }
        // Painter's order projects the front cliff face over the rear shore.
        // Vertical fissures and occasional full-width strata catch sunlight.
        const face = .27 + .28 * (1 - dx) + .35 * noise(x * .38, y * .09, seed + 8);
        for (let k = 0; k < z; k++) {
          const strata = (k === 2 || k === Math.floor(relief * .48)) ? -.13 : 0;
          const band = face * 4.7 + k / z * .46 + strata * 6;
          paint(x, y - k, cliff[clamp(Math.floor(band), 0, 6)]);
        }
        paint(x, y - z, topColor);
        if (first && coast > 3.5 && rocky + brush > 1.08 && grainValue > .975 && rx > 13) {
          trees.push({x, y, z, size: 2 + Math.floor(brush * 3 + r() * 2), shade: r()});
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    for (const tree of trees) {
      // Skip crowns obscured by higher front terraces.
      const {x,y,z,size,shade} = tree;
      if (y + 2 < h && heightMap[(y + 2) * w + x] > z + 2) continue;
      const p = y - z;
      ctx.fillStyle = '#5b8468';
      ctx.fillRect(x, p, size, 1);
      ctx.fillStyle = '#536f58';
      ctx.fillRect(x, p - 2, 1, 3);
      ctx.fillStyle = shade > .48 ? '#4c7d5f' : '#548563';
      ctx.fillRect(x - 2, p - size + 1, 4, size - 2);
      ctx.fillRect(x - 1, p - size, 2, 1);
      ctx.fillRect(x + 1, p - 3, 2, 2);
      ctx.fillStyle = shade > .48 ? '#84a569' : '#92ae70';
      ctx.fillRect(x - 2, p - size + 1, 2, 2);
      ctx.fillRect(x - 1, p - size, 1, 2);
    }
    return out;
  }

  // A cloud is modelled as overlapping domes, then lit and quantised together
  // so that it reads as one cloud, with softer internal edges than its outline.
  function cloud(seed, width, height) {
    const c = surface(width, height), ctx = c.getContext('2d'), r = random(seed);
    const img = ctx.createImageData(width, height), d = img.data;
    const colors = [0x84acb6,0xa4bccb,0xb8cbd4,0xcddadb,0xe0e5da,0xedecdc,0xf8f2de,0xfff9e9].map(rgb);
    const lobes = [];
    const cy = height * .57;
    // A tapered, irregular eastward tail, with cumulus towers toward the head.
    for (let i = 0; i < 19; i++) {
      const t = (i + .5) / 19;
      const envelope = Math.sin(Math.PI * t) ** .73;
      const radius = height * (.075 + (.19 + r() * .15) * envelope);
      const x = width * (.02 + t * .96);
      lobes.push({x, y: cy + (r() - .53) * height * .21,
        rx: Math.min(radius * (1.35 + r()), x - 1, width - x - 1),
        ry: radius * (.78 + r() * .29), z: .65 + r() * .4});
    }
    lobes.push({x:width*.40,y:height*.43,rx:height*.58,ry:height*.29,z:1.12});
    lobes.push({x:width*.56,y:height*.40,rx:height*.45,ry:height*.31,z:1.14});
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rough = (noise(x*.20, y*.23, seed) - .5) * 2.5;
        const px = x + rough, py = y + rough * .45;
        let best = -1, light = 0;
        for (const l of lobes) {
          const dx = (px-l.x)/l.rx, dy = (py-l.y)/l.ry;
          const inner = 1 - dx*dx - dy*dy;
          if (inner <= 0) continue;
          const z = Math.sqrt(inner) * l.z;
          if (z <= best) continue;
          best = z;
          light = .54 + z * .24 - dx * .18 - dy * .41;
        }
        if (best < 0) continue;
        const under = clamp((y / height - .40) * 1.09, 0, .62);
        const shade = Math.floor((light - under + (noise(x*.07,y*.12,seed+3)-.5)*.1)*8);
        const col = colors[clamp(shade,0,7)];
        const i=(y*width+x)*4;
        d[i]=col[0]; d[i+1]=col[1]; d[i+2]=col[2]; d[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
    ctx.fillStyle='#c4d3d5';
    for (let i=0;i<8;i++) {
      const x=Math.floor(r()*width*.8+width*.06),y=Math.floor(height*(.76+r()*.13));
      ctx.globalAlpha=.35+r()*.3; ctx.fillRect(x,y,Math.floor(3+r()*9),1);
    }
    ctx.globalAlpha=1;
    return c;
  }

  let art;
  function getArt() {
    if (art) return art;
    art = {
      water: ocean(),
      islands: [
        island(43,43,20,12), island(126,35,17,11), island(208,19,10,7),
        island(97,12,6.5,6), island(63,7,4.2,3), island(237,52,22,14)
      ],
      clouds: [cloud(56,104,43),cloud(872,154,61),cloud(99,74,33),cloud(14,126,54)],
      gleams: []
    };
    const r = random(101);
    for(let i=0;i<78;i++) art.gleams.push({x:r(),y:r(),phase:r()*tau,len:1+Math.floor(r()*5)});
    return art;
  }

  let plate, lastW = 0, lastH = 0;
  function draw(ctx, w, h, timeSeconds = 0, cameraX = 0, cameraY = 0, mode = 'menu') {
    if (!(w > 0 && h > 0)) return;
    const assets = getArt();
    const resolution = clamp(Math.min(h/238, w/230), 1.3, 3.25);
    const W = Math.ceil(w / resolution), H = Math.ceil(h / resolution);
    if (!plate || W !== lastW || H !== lastH) {
      plate = surface(W, H); lastW = W; lastH = H;
    }
    const p = plate.getContext('2d');
    const play = mode === 'play', t = timeSeconds;
    const X = clamp(cameraX,-48,48)/resolution, Y = clamp(cameraY,-32,32)/resolution;
    const ox = Math.floor(-X*.33), oy = Math.floor(t*(play?5:1.1) - Y*.33);
    const tile = assets.water.width;
    for(let y = wrap(oy,tile)-tile;y<H;y+=tile)
      for(let x = wrap(ox,tile)-tile;x<W;x+=tile) p.drawImage(assets.water,x,y);
    for (const g of assets.gleams) {
      const a = Math.sin(t * .88 + g.phase * 3);
      if (a < -.25) continue;
      const x = Math.floor(wrap(g.x*W+ox,W)), y = Math.floor(wrap(g.y*H+oy,H));
      p.fillStyle = a>.78?'rgba(181,224,212,.52)':'rgba(157,217,205,.27)';
      p.fillRect(x,y,g.len,1);
      if (a>.92 && g.len>=4) p.fillRect(x+1,y-1,1,3);
    }
    const islandRows = [
      // Main archipelago just inside the high, sunlit edge of the patrol.
      [.86,.19,5,1], [.984,.03,1,.98], [.742,.13,3,.83], [.765,.31,2,.78], [.717,.40,4,.83],
      // A second island cuts across the lower left frame.
      [.041,.86,0,1.14], [.132,.96,2,.8], [.184,.895,4,.9], [-.05,.66,3,.91]
    ];
    function sprite(img,x,y,scale) {
      const sw = Math.round(img.width*scale), sh = Math.round(img.height*scale);
      p.drawImage(img,Math.round(x-sw/2),Math.round(y-sh/2),sw,sh);
    }
    p.imageSmoothingEnabled=false;
    for(const [rx,ry,id,k] of islandRows) {
      const scale = W<325 ? k*.75 : k;
      let y = ry*H - Y*.66;
      if(play) y = wrap(y+t*9+65,H+130)-65;
      sprite(assets.islands[id],rx*W-X*.7,y,scale);
    }

    const cloudRows = [
      [.05,.035,1,.98], [.13,.115,2,.63], [.482,-.085,2,.90],
      [1.045,.443,0,.94], [.946,.986,1,1.23], [.831,1.04,2,.75], [-.067,.57,3,.81]
    ];
    for(const [rx,ry,id,k] of cloudRows) {
      const near = k>.9;
      const scale = W<325 ? k*.68 : k;
      let x=rx*W - X*(near?1.65:1.1) + Math.sin(t*.055+rx*2)*3;
      let y=ry*H - Y*(near?1.65:1.1);
      if (play) y=wrap(y+t*(near?17:12)+52,H+104)-52;
      else y+=Math.sin(t*.065+ry)*1.5;
      sprite(assets.clouds[id],x,y,scale);
    }
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(plate,0,0,w,h);
    ctx.restore();
  }

  window.SkimmerScenery = {draw};
})();
