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

  const waterTones = [
    [0x207689,0x4ca7aa,0x60bdab], [0x3a344e,0x856078,0xcb8a67],
    [0x143247,0x2d6077,0x60bdab], [0x172e47,0x36566e,0x83959b],
    [0x153d41,0x426d66,0x8abbb0], [0x382e40,0x78525b,0xc58473]
  ];
  const currentColors = [
    ['rgba(172,229,214,.16)','rgba(19,94,115,.24)'], ['#efb59232','#382f513d'],
    ['#86c8cd28','#10365154'], ['#94b3c528','#122a4c55'],
    ['#c1dcd148','#183f4e66'], ['#f1b6a834','#38293b66']
  ];
  // The water is a seamless tile. Long, slightly broken strokes describe
  // currents while much smaller groups of crests catch the light.
  function ocean(stage) {
    const size = 384, img = surface(size, size);
    const ctx = img.getContext('2d'), pixels = ctx.createImageData(size, size);
    const [deep, blue, reflection] = waterTones[stage-1].map(rgb);
    const colors = Array.from({length: 32}, (_, i) => tone(deep, blue, i / 31));
    for (let y = 0; y < size; y++) {
      const Y = y * tau / size;
      for (let x = 0; x < size; x++) {
        const X = x * tau / size;
        const wave = Math.sin(X - 2 * Y + 1.7 * Math.sin(Y)) * .14
          + Math.sin(X * 2 + Y * 3 + Math.sin(X)) * .085
          + Math.sin(Y * 11 + X * 3 + 2.8 * Math.sin(Y * 3 - X)) * .027;
        const col = colors[clamp(Math.floor((.51 + wave) * 31), 0, 31)];
        let light = 0;
        if (stage === 2) {
          const dusk = Math.max(0, Math.cos(X + .55 * Math.sin(Y) - 3));
          light = dusk ** 8 * (.18 + .09 * Math.sin(Y * 34 + X * 2));
        } else if (stage === 3) {
          const aurora = Math.cos(X * 2 + Y + 1.8 * Math.sin(Y + .65 * Math.sin(X)));
          const ribbon = Math.max(0, aurora) ** 10;
          light = ribbon * (.17 + .08 * Math.sin(20 * Y + 3 * X));
        } else if (stage === 5) {
          const ridge = Math.sin(X * 4 + Y * 13 + 1.6 * Math.sin(2 * X + Y));
          light = Math.max(0, ridge - .82) * (.5 + .38 * Math.cos(6 * X - Y));
        } else if (stage === 6) {
          light = Math.max(0, Math.cos(X - 2 * Y + Math.sin(2*X))) ** 9 * (.16 + .07 * Math.sin(27*Y+X));
        }
        const i = (y * size + x) * 4;
        for (let k = 0; k < 3; k++) pixels.data[i+k] = blend(col[k], reflection[k], light);
        pixels.data[i+3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const r = random(1308);
    for (let i = 0; i < 405; i++) {
      const cx = Math.floor(r() * size), cy = Math.floor(r() * size);
      const w = Math.floor(2 + Math.pow(r(), 2) * 13);
      ctx.fillStyle = currentColors[stage-1][i % 5 ? 0 : 1];
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

  // Scanline fills keep the angled ledges and snow ridges on the pixel grid.
  function polygon(ctx, points, color) {
    ctx.fillStyle = color;
    const ys = points.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
      const cuts = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i+1) % points.length];
        const t = (y + .5 - a[1]) / (b[1] - a[1]);
        if (t >= 0 && t < 1) cuts.push(a[0] + t * (b[0] - a[0]));
      }
      cuts.sort((a,b) => a-b);
      for (let i = 1; i < cuts.length; i += 2) {
        const start = Math.ceil(cuts[i-1] - .5);
        ctx.fillRect(start,y,Math.ceil(cuts[i] - .5) - start,1);
      }
    }
  }

  function drawOutpost(ctx, x, y) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    // Two insulated cabins and a shore-facing radio mast share a steel gantry.
    polygon(ctx,[[-17,2],[8,-2],[21,3],[-1,8]],'#8eb1bd');
    const cabin = (cx, cy, size) => {
      ctx.save(); ctx.translate(cx,cy);
      polygon(ctx,[[-size,-4],[1,-7],[size,-4],[0,0]],'#f2f1db');
      polygon(ctx,[[-size,-4],[0,0],[0,6],[-size,2]],'#ac685e');
      polygon(ctx,[[0,0],[size,-4],[size,2],[0,6]],'#3c5974');
      ctx.fillStyle='#ffd57c'; ctx.fillRect(-size+2,-1,2,2); ctx.fillRect(-4,1,2,2);
      ctx.fillStyle='#89c9d3'; ctx.fillRect(3,0,3,1);
      ctx.restore();
    };
    cabin(8,-5,6); cabin(-7,-1,9);
    ctx.fillStyle='#547693'; ctx.fillRect(13,-17,1,19);ctx.fillRect(10,-11,7,1);
    ctx.fillStyle='#d5dfe2'; ctx.fillRect(12,-17,1,13);ctx.fillRect(9,-12,7,1);
    ctx.fillStyle='#ffb76e';ctx.fillRect(11,-19,3,2);
    ctx.restore();
  }

  // The fjord and the pack ice are built in cross-section. Each irregular rim
  // has a sun-facing cap, extruded facets and a narrow surf or brash-ice edge.
  function headland(seed, rx, ry, rise, stage, landmark = false) {
    const ice = stage === 3, rng = random(seed);
    const w = Math.ceil(rx*2.9+22), h = Math.ceil(ry*2.85+rise+28);
    const out = surface(w,h), ctx = out.getContext('2d');
    const cx = w*.50, cy = h*.58+rise*.23;
    const vertices = ice ? 12 : 20;
    const ring = [];
    for (let i=0; i<vertices; i++) {
      const theta = tau*(i + rng()*.34)/vertices, r = .83+rng()*.24;
      const y = ry*Math.sin(theta)*r;
      ring.push([rx*Math.cos(theta)*r+y*.45,y]);
    }
    const rim = (scale,elevation,offset=0) => ring.map(([x,y]) =>
      [cx+x*scale+offset,cy+y*scale-elevation]);
    const faceColors = ice ? ['#5186ac','#72a9c4','#86bccb','#a8d8dc'] :
      ['#724650','#955449','#b66749','#ce8755'];
    const caps = ice ? ['#abd5db','#c6e2df','#e1eee6','#edf2e9'] :
      ['#c68c64','#dd9b5f','#e3ae71','#f1c383'];
    polygon(ctx,rim(1.23,-2),ice ? '#315d74' : '#736179');
    polygon(ctx,rim(1.13,-1),ice ? '#508898' : '#ad8984');
    polygon(ctx,rim(1.07,0),ice ? '#87babd' : '#d0a68d');
    function terrace(bottom, top, elevation, lift, offset, capColor) {
      const base = rim(bottom,elevation,offset), crown = rim(top,elevation+lift,offset);
      const order = base.map((_,i) => i).sort((a,b) =>
        base[a][1] + base[(a+1)%vertices][1] - base[b][1] - base[(b+1)%vertices][1]);
      for (const i of order) {
        const j = (i+1)%vertices, a=base[i], b=base[j], c=crown[j], d=crown[i];
        const exposure = clamp(.5-(a[0]+b[0]-cx*2)/(3*rx)+(rng()-.5)*.6,0,.99);
        const color = Math.floor(exposure*4);
        polygon(ctx,[a,b,c,d],faceColors[color]);
        if (lift > 3) {
          const mid = rng()*.7+.15;
          const cutX = blend(c[0],d[0],mid), cutY = blend(c[1],d[1],mid);
          polygon(ctx,[a,[cutX,cutY],d],faceColors[Math.max(0,color-1)]);
          if (!ice && lift>5) {
            const k=.42+rng()*.14;
            const ay=blend(a[1],d[1],k), by=blend(b[1],c[1],k);
            const ax=blend(a[0],d[0],k), bx=blend(b[0],c[0],k);
            polygon(ctx,[[ax,ay],[bx,by],[bx,by+1],[ax,ay+1]],faceColors[Math.min(3,color+1)]);
          }
        }
      }
      polygon(ctx,crown,capColor);
      // Shallow planar facets follow the wind across the top.
      const ox=cx+offset, oy=cy-elevation-lift;
      for (let i=1; i<vertices; i+=3) {
        const a=crown[i], b=crown[(i+1)%vertices], t=.2+rng()*.46;
        polygon(ctx,[a,b,[blend(a[0],ox,t),blend(b[1],oy,t)]],caps[i%2]);
      }
      for(let i=0; i<rx*ry*top*top*.12; i++) {
        const a=rng()*tau, d=Math.sqrt(rng())*.72*top;
        const yy=Math.sin(a)*ry*d;
        ctx.fillStyle=ice ? '#afcdd4' : '#b77e5c';
        ctx.fillRect(Math.round(ox+Math.cos(a)*rx*d+yy*.45),Math.round(oy+yy),1+Math.floor(rng()*2),1);
      }
    }
    if (ice) {
      terrace(1,.97,0,rise*.43,0,caps[2]);
      terrace(.72,.69,rise*.43,rise*.33,-1,caps[3]);
      const top = cy-rise*.76;
      if (landmark) drawOutpost(ctx,cx,top);
      else if (rx>18) {
        // A pressure ridge has a bright windward face and a blue overhang.
        polygon(ctx,[[cx-rx*.39,top+2],[cx-rx*.04,top-rise*.62],[cx+rx*.27,top]],'#92b8ca');
        polygon(ctx,[[cx-rx*.39,top+2],[cx-rx*.04,top-rise*.62],[cx-rx*.12,top]],'#ebf5ed');
      }
    } else {
      terrace(1,.96,0,rise*.28,0,caps[0]);
      terrace(.86,.78,rise*.28,rise*.38,-1,caps[1]);
      terrace(.68,.62,rise*.66,rise*.36,-2,caps[2]);
      if (rx>22) {
        const top = cy-rise*1.02;
        // Split sandstone spires cap the tallest escarpments.
        for(const offset of [-.23,.13]) {
          const x=cx+offset*rx, y=top+offset*ry*.2, s=rx*.105, ht=rise*(.32+rng()*.32);
          polygon(ctx,[[x-s*1.5,y],[x-s,y-ht],[x+s*.35,y-ht-2],[x+s*.82,y-1]],'#a55e4b');
          polygon(ctx,[[x+s*.35,y-ht-2],[x+s*.8,y-ht],[x+s*1.3,y],[x+s*.82,y-1]],'#7e4c49');
          ctx.fillStyle='#f1c98d';ctx.fillRect(Math.round(x-s),Math.round(y-ht-1),Math.ceil(s*1.35),2);
        }
      }
    }
    return out;
  }

  // An isometric block with two shaded walls, shared by the pier and station.
  function block(ctx, x, y, length, depth, height, colors) {
    const a=[x,y-height], b=[x+length,y+.28*length-height];
    const c=[b[0]-depth,b[1]+.45*depth], d=[x-depth,a[1]+.45*depth];
    polygon(ctx,[b,c,[c[0],c[1]+height],[b[0],b[1]+height]],colors[2]);
    polygon(ctx,[c,d,[d[0],d[1]+height],[c[0],c[1]+height]],colors[1]);
    polygon(ctx,[a,b,c,d],colors[0]);
  }

  function harbor(lighthouse) {
    const out=surface(158,103), g=out.getContext('2d');
    const stone=['#778893','#4b606f','#35475a'], wood=['#8f7770','#594f57','#493f50'];
    const x=72,y=54;
    block(g,x+3,y+4,60,57,3,['#46677a','#3c5c6f','#344f64']);
    block(g,x,y,60,57,6,stone);
    for(let lane=8;lane<57;lane+=11){
      const sx=x-lane, sy=y-6+.45*lane;
      polygon(g,[[sx,sy],[sx+60,sy+17],[sx+60,sy+18],[sx,sy+1]],'#697b88');
      for(let i=9;i<59;i+=13){
        g.fillStyle='#84919b';
        g.fillRect(Math.round(sx+i),Math.round(sy+.28*i),3,1);
      }
    }
    // Timber landing fingers jut past the masonry quay into the shipping lane.
    for (const offset of [4,20,36]) {
      block(g,x+offset-49,y+23+offset*.28,4,16,3,wood);
      g.fillStyle='#b09a88';g.fillRect(x+offset-62,Math.round(y+27+offset*.28),2,3);
    }
    if (lighthouse) {
      const tx=74, ty=65;
      polygon(g,[[tx-12,ty],[tx,ty-5],[tx+14,ty],[tx+3,ty+6]],'#465668');
      polygon(g,[[tx-6,ty],[tx-3,ty-28],[tx+3,ty-28],[tx+7,ty],[tx+2,ty+3]],'#d6c7ad');
      polygon(g,[[tx+1,ty+2],[tx,ty-27],[tx+3,ty-28],[tx+7,ty],[tx+4,ty+2]],'#9a9292');
      for (const h of [9,19])
        polygon(g,[[tx-5,ty-h],[tx+5,ty-h+1],[tx+4,ty-h-4],[tx-4,ty-h-5]],'#92534d');
      g.fillStyle='#233d50';g.fillRect(tx-6,ty-30,12,3);g.fillRect(tx-4,ty-38,8,8);
      polygon(g,[[tx-5,ty-35],[tx-55,ty-41],[tx-54,ty-29]],'#eac58735');
      g.fillStyle='#ffda87';g.fillRect(tx-3,ty-36,6,5);
      g.fillStyle='#fff3c2';g.fillRect(tx-3,ty-35,2,3);
      polygon(g,[[tx-7,ty-37],[tx,ty-43],[tx+7,ty-37]],'#b06a55');
      block(g,93,67,13,9,7,['#82757a','#635660','#424752']);
      block(g,111,69,6,5,4,['#95867d','#685b63','#505466']);
      g.fillStyle='#d0ac7c';g.fillRect(91,63,2,2);
      g.fillStyle='#b5b0a0';g.fillRect(84,61,4,1);
      g.fillStyle='#394e62';g.fillRect(tx-2,ty-4,2,4);
    } else {
      for(const [cx,cy,col] of [[92,62,'#927260'],[75,63,'#5c8182'],[66,68,'#856d75']]){
        block(g,cx,cy,13,6,5,[col,'#4c5362','#394b59']);
      }
      const cx=99,cy=62;
      block(g,cx,cy,6,5,4,stone);
      polygon(g,[[cx-2,cy-3],[cx,cy-23],[cx+2,cy-24],[cx+3,cy-2]],'#9b856b');
      polygon(g,[[cx-16,cy-25],[cx+11,cy-30],[cx+13,cy-28],[cx-17,cy-22]],'#b69a75');
      g.fillStyle='#485567';g.fillRect(cx-14,cy-23,1,11);
      g.fillStyle='#c7b48a';g.fillRect(cx-15,cy-13,3,2);
    }
    // Warm lights and their short broken reflections belong to the quay.
    for(const u of [4,24,44]){
      const bx=x+u-56, by=Math.round(y+u*.28+25);
      g.fillStyle='#ffe1a5';g.fillRect(bx,by-6,2,2);
      g.fillStyle='#d69d785c';g.fillRect(bx,by+3,3,1);g.fillRect(bx+2,by+6,2,1);
    }
    return out;
  }

  function buoy() {
    const out=surface(14,17), g=out.getContext('2d');
    g.fillStyle='#74919e';g.fillRect(2,13,9,1);
    polygon(g,[[2,10],[5,8],[9,8],[11,10],[8,12],[5,12]],'#917767');
    g.fillStyle='#cbb27c';g.fillRect(5,5,3,4);
    g.fillStyle='#f1ce81';g.fillRect(5,3,3,2);
    return out;
  }

  function stormReef(seed, size) {
    const out=surface(130,90), g=out.getContext('2d'), r=random(seed), cx=64,cy=54;
    const rx=35*size, ry=13*size;
    // Broken crests curl around the upwind foot before trailing to leeward.
    for(let k=0;k<4;k++){
      for(let i=0;i<90;i++){
        const a=tau*i/90, x=cx+Math.cos(a)*(rx+3*k), y=cy+Math.sin(a)*(ry+k*2);
        if(r()<.32 || (k>0 && Math.cos(a)>.6)) continue;
        g.fillStyle=k%2?'#9ebfb388':'#81a79fbb';
        g.fillRect(Math.round(x),Math.round(y),2+Math.floor(r()*4),1);
      }
    }
    for(const f of [-.41,.43,.04]){
      const x=cx+f*rx, y=cy+(.12+f*.32)*ry, w=rx*(.48+r()*.25);
      const h=(f===.04?33:20+r()*11)*size, tip=x+w*.28;
      polygon(g,[[x-w,y],[x-w*.7,y-h*.3],[tip-4,y-h],[tip+3,y-h],[x+w,y-2],[x+w*.6,y+4],[x-w*.4,y+6]],'#354e54');
      polygon(g,[[x-w,y],[x-w*.7,y-h*.3],[tip-4,y-h],[tip+1,y-h],[x-w*.2,y+1]],'#73867f');
      polygon(g,[[tip+1,y-h],[x+w*.22,y-h*.29],[x+w*.6,y+3],[x-w*.2,y+3]],'#526968');
      polygon(g,[[x-w*.7,y-h*.3],[tip-4,y-h],[tip-1,y-h],[x-w*.48,y-h*.32]],'#9da798');
      // Split columns taper at the crest and widen at the waterline.
      for(let j=1;j<=4;j++){
        const offset=j*.19, foot=x-w+w*1.63*offset;
        const ridgeX=blend(tip-3,foot,.31+offset*.32), ridgeY=y-h*(.74-offset*.37);
        polygon(g,[[ridgeX,ridgeY],[foot,y+2],[foot+1.4,y+2]],'#455c5e');
        g.fillStyle='#a9b7a7';
        g.fillRect(Math.round(ridgeX),Math.round(ridgeY+1),1,1);
      }
      g.fillStyle='#cdd8c2aa';g.fillRect(Math.round(x-w),Math.round(y+3),Math.round(w*.7),1);
    }
    return out;
  }

  function ringStation(size, docks) {
    const out=surface(154,100), g=out.getContext('2d'), cx=76,cy=57;
    const rx=48*size,ry=25*size, n=12;
    const rim=(i,r,lift)=>[cx+rx*r*Math.cos(i*tau/n),cy+ry*r*Math.sin(i*tau/n)-lift];
    if(docks) {
      block(g,cx+28,cy+7,19,5,4,['#917c7f','#5d5364','#493e51']);
      block(g,cx-25,cy+11,8,24,3,['#88737b','#5a4c60','#463e52']);
    }
    // Faceted outer and inner walls leave water visible in the central basin.
    for(let i=0;i<n;i++){
      const mid=tau*(i+.5)/n, j=i+1;
      const r=Math.sin(mid)>0?1:.61;
      polygon(g,[rim(i,r,0),rim(j,r,0),rim(j,r,7),rim(i,r,7)],i%3?'#56495b':'#705a67');
    }
    for(let i=0;i<n;i++){
      const j=i+1;
      polygon(g,[rim(i,1,7),rim(j,1,7),rim(j,.61,7),rim(i,.61,7)],i%3?'#a08b87':'#84757f');
      polygon(g,[rim(i+.09,.90,7),rim(j-.09,.90,7),rim(j-.09,.84,7),rim(i+.09,.84,7)],'#bd7165');
      polygon(g,[rim(i+.12,.69,7),rim(j-.12,.69,7),rim(j-.12,.65,7),rim(i+.12,.65,7)],'#d5ab94');
      const [bx,by]=rim(i+.1,.81,7);
      g.fillStyle='#635c6b';g.fillRect(Math.round(bx),Math.round(by),2,1);
      if(i%3===0){
        const [x,y]=rim(i+.45,.81,7);
        block(g,x-1,y,5,4,5,['#c6b0a1','#705d69','#57495a']);
        g.fillStyle='#eac39a';g.fillRect(Math.round(x-1),Math.round(y-4),2,1);
      }
    }
    return out;
  }

  const cloudTones = [
    [0x84acb6,0xa4bccb,0xb8cbd4,0xcddadb,0xe0e5da,0xedecdc,0xf8f2de,0xfff9e9],
    [0x8b677a,0xa37582,0xb88b8c,0xcba091,0xe1b39b,0xedd0ab,0xf8ddb4,0xffe9c8],
    [0x578998,0x749aa9,0x89adbc,0x9dbec7,0xb1ced4,0xc5dad9,0xd9e7dd,0xe8efe3],
    [0x3c5468,0x4d677b,0x587384,0x668293,0x7891a0,0x899eab,0xa0afba,0xb1bfc2],
    [0x29484f,0x395755,0x46635f,0x52706d,0x5e7976,0x6e8780,0x81968c,0x96a69b],
    [0x564a5d,0x6c5465,0x81606a,0x906c73,0xa77e7b,0xbc9286,0xcfa493,0xddbc9d]
  ];
  // A cloud is modelled as overlapping domes, then lit and quantised together
  // so that it reads as one cloud, with softer internal edges than its outline.
  function cloud(seed, width, height, stage) {
    const c = surface(width, height), ctx = c.getContext('2d'), r = random(seed);
    const img = ctx.createImageData(width, height), d = img.data;
    const colors = cloudTones[stage-1].map(rgb);
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

  const coastMakers = [
    () => [
        island(43,43,20,12), island(126,35,17,11), island(208,19,10,7),
        island(97,12,6.5,6), island(63,7,4.2,3), island(237,52,22,14)
      ], () => [
        headland(17,50,29,30,2), headland(31,42,29,25,2), headland(135,20,11,12,2),
        headland(8,11,7,10,2), headland(86,8,4,5,2), headland(61,59,33,30,2)
      ], () => [
        headland(310,39,23,15,3), headland(512,31,19,19,3), headland(73,19,10,10,3),
        headland(101,11,7,6,3), headland(9,6,5,4,3), headland(97,47,23,14,3,true)
      ],
    () => [harbor(true),harbor(false),buoy()],
    () => [stormReef(37,1),stormReef(82,.72),stormReef(19,.41)],
    () => [ringStation(1,true),ringStation(.67,false),ringStation(.36,false)]
  ];
  const artCache = new Map();
  function getArt(stage) {
    if (artCache.has(stage)) return artCache.get(stage);
    const art = {
      water: ocean(stage), islands: coastMakers[stage-1](),
      clouds: [cloud(56,104,43,stage),cloud(872,154,61,stage),cloud(99,74,33,stage),cloud(14,126,54,stage)],
      gleams: []
    };
    const r = random(101);
    for(let i=0;i<78;i++) art.gleams.push({x:r(),y:r(),phase:r()*tau,len:1+Math.floor(r()*5)});
    artCache.set(stage,art);
    return art;
  }

  // Every row locates one plate by viewport fraction, sprite index and zoom.
  const coastRows = {
    1: [
      [.86,.19,5,1], [.984,.03,1,.98], [.742,.13,3,.83], [.765,.31,2,.78], [.717,.40,4,.83],
      [.041,.86,0,1.14], [.132,.96,2,.8], [.184,.895,4,.9], [-.05,.66,3,.91]
    ],
    2: [
      [.93,.045,1,1.27], [.985,.35,5,1.35], [.83,.27,2,.88], [.78,.37,3,.85],
      [.97,.92,1,.92], [-.02,.58,1,1.22], [.035,.88,0,1.27], [.135,.96,2,.93]
    ],
    3: [
      [.81,.18,5,1.08], [.99,.08,1,1], [.90,.33,3,.72], [.71,.31,4,.76],
      [.97,.65,2,.65], [.035,.83,0,1.20], [.18,.96,1,.82], [.19,.76,4,.85], [.25,.84,3,.68]
    ],
    4: [
      [.87,.17,0,1.14], [1.06,.28,1,1.03], [.77,.38,2,.78], [.86,.47,2,.78],
      [.035,.78,1,1.15], [.12,.98,0,.68], [.15,.62,2,.65], [.21,.71,2,.62]
    ],
    5: [
      [.87,.14,0,1.2], [1,.29,1,.96], [.77,.34,2,.78], [.94,.47,2,.68],
      [.04,.83,0,1.18], [.15,.93,1,.87], [.19,.79,2,.62], [.004,.51,2,.55]
    ],
    6: [
      [.86,.18,0,1.1], [1.02,.29,1,.77], [.95,.42,2,.62],
      [.025,.84,0,.82], [.14,.96,1,.72], [.96,.93,1,.76]
    ]
  };
  const cloudRows = [
    [.05,.035,1,.98], [.13,.115,2,.63], [.482,-.085,2,.90],
    [1.045,.443,0,.94], [.946,.986,1,1.23], [.831,1.04,2,.75], [-.067,.57,3,.81]
  ];
  const sparkleColors = {
    1: ['rgba(157,217,205,.27)','rgba(181,224,212,.52)'],
    2: ['#e7ab8b48','#ffcf9e98'], 3: ['#76babb4a','#ade5d591'],
    4: ['#7799ad42','#b2c3c879'], 5: ['#adcdb757','#d2d8bf8a'],
    6: ['#c28b8f45','#d8afa988']
  };
  let plate, lastW = 0, lastH = 0;
  function draw(ctx, w, h, timeSeconds = 0, cameraX = 0, cameraY = 0, mode = 'menu', stage = 1) {
    if (!(w > 0 && h > 0)) return;
    const assets = getArt(stage);
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
      p.fillStyle = sparkleColors[stage][a>.78 ? 1 : 0];
      p.fillRect(x,y,g.len,1);
      if (a>.92 && g.len>=4) p.fillRect(x+1,y-1,1,3);
    }
    function sprite(img,x,y,scale,stretch=1) {
      const sw = Math.round(img.width*scale*stretch), sh = Math.round(img.height*scale/stretch);
      p.drawImage(img,Math.round(x-sw/2),Math.round(y-sh/2),sw,sh);
    }
    p.imageSmoothingEnabled=false;
    for(const [rx,ry,id,k] of coastRows[stage]) {
      const scale = W<325 ? k*.75 : k;
      let y = ry*H - Y*.66;
      if(play) y = wrap(y+t*9+65,H+130)-65;
      sprite(assets.islands[id],rx*W-X*.7,y,scale);
    }

    const stretch = stage === 5 ? 1.66 : stage === 4 ? 1.45 : 1;
    p.globalAlpha = stage === 4 ? .64 : 1;
    for(const [rx,ry,id,k] of cloudRows) {
      const near = k>.9;
      const scale = (W<325 ? k*.68 : k) * (stage===3 ? .74 : 1);
      let x=rx*W - X*(near?1.65:1.1) + Math.sin(t*.055+rx*2)*3;
      if (stage === 5) x += Math.sin(t*.18 + ry*7) * (near ? 15 : 8);
      let y=ry*H - Y*(near?1.65:1.1);
      if (play) y=wrap(y+t*(near?17:12)+52,H+104)-52;
      else y+=Math.sin(t*.065+ry)*1.5;
      sprite(assets.clouds[id],x,y,scale,stretch);
    }
    p.globalAlpha=1;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(plate,0,0,w,h);
    ctx.restore();
  }

  window.SkimmerScenery = {draw};
})();
