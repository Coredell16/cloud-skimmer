(() => {
  'use strict';

  // Draw each silhouette on a 67-pixel grid. The scanline fill keeps diagonal
  // edges stepped and opaque even on browsers that antialias canvas paths.
  const width = 67;
  const height = 74;
  const center = 33;
  const ink = '#142b39';
  const deep = '#254452';
  const steel = '#647d85';
  const lightSteel = '#a3b8b7';
  const ivory = '#e9e7cd';
  const white = '#fff7da';
  const orange = '#e56a32';
  const red = '#ac4030';

  function newCanvas() {
    const image = document.createElement('canvas');
    image.width = width;
    image.height = height;
    return image;
  }

  function painter(g) {
    function shape(color, vertices) {
      const points = [];
      for (let i = 0; i < vertices.length; i += 2) {
        points.push([center + vertices[i], vertices[i + 1]]);
      }
      g.fillStyle = color;
      const ys = points.map(point => point[1]);
      for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
        const cuts = [];
        const row = y + 0.5;
        for (let i = 0; i < points.length; i++) {
          const [x1, y1] = points[i];
          const [x2, y2] = points[(i + 1) % points.length];
          if ((y1 <= row && y2 > row) || (y2 <= row && y1 > row)) {
            cuts.push(x1 + (x2 - x1) * (row - y1) / (y2 - y1));
          }
        }
        cuts.sort((a, b) => a - b);
        for (let i = 0; i + 1 < cuts.length; i += 2) {
          const x = Math.ceil(cuts[i] - 0.5);
          g.fillRect(x, y, Math.ceil(cuts[i + 1] - 0.5) - x, 1);
        }
      }
    }
    function both(color, vertices) {
      shape(color, vertices);
      shape(color, vertices.map((n, i) => i % 2 === 0 ? -n : n));
    }
    function rect(color, x, y, w, h) {
      g.fillStyle = color;
      g.fillRect(center + x, y, w, h);
    }
    function pair(color, x, y, w, h) {
      rect(color, x, y, w, h);
      rect(color, -x - w, y, w, h);
    }
    return {shape, both, rect, pair};
  }

  function makePlayer(g) {
    const {shape, both, rect, pair} = painter(g);

    // Separate tail planes with white leading edges and orange tip flashes.
    both(ink, [4,39, 10,42, 18,52, 21,56, 21,60, 12,59, 4,55]);
    both(steel, [6,42, 10,44, 19,55, 19,58, 12,57, 6,53]);
    both(ivory, [7,42, 10,44, 18,54, 12,54, 8,51]);
    both(orange, [15,51, 18,54, 19,57, 16,57, 13,53]);

    // Cut-back main wings, armored wing roots and narrow glass nav lights.
    both(ink, [3,17, 8,20, 13,27, 29,37, 32,37, 32,45, 27,46, 18,44, 9,48, 4,47]);
    both(steel, [5,20, 8,22, 13,29, 29,39, 30,39, 30,43, 26,44, 18,42, 8,46, 5,45]);
    both(lightSteel, [5,20, 9,24, 14,29, 30,39, 30,42, 17,40, 7,44]);
    both(ivory, [5,20, 9,23, 13,28, 28,38, 29,40, 21,39, 13,35, 7,36]);
    both(white, [8,23, 14,29, 29,38, 26,38, 13,30]);
    both(red, [20,32, 24,35, 26,39, 26,43, 22,42, 22,38]);
    both(orange, [21,33, 24,35, 24,38, 21,37]);
    both(deep, [12,38, 18,40, 23,41, 22,42, 17,41, 12,43]);
    both(white, [14,35, 17,37, 15,37, 14,38, 13,37]);
    rect('#fb7755', -32,39,1,3);
    rect('#75ece0', 31,39,1,3);

    // Twin nacelles, bevels, dark rectangular intakes and segmented nozzles.
    both(ink, [4,23, 8,24, 11,28, 11,45, 9,51, 9,57, 3,58, 2,50]);
    both(steel, [5,25, 8,25, 10,29, 10,44, 8,51, 8,55, 4,56, 4,49]);
    both(lightSteel, [5,25, 7,25, 9,28, 8,46, 6,51, 4,50]);
    both(ivory, [6,25, 8,26, 9,28, 9,38, 7,36]);
    both(ink, [6,28, 9,29, 9,34, 6,32]);
    both('#597b86', [7,29, 9,30, 9,32, 8,31]);
    both(orange, [6,35, 8,36, 8,43, 6,47]);
    pair(deep, 4,51,5,2);
    pair(ink, 4,55,5,2);
    pair('#ed8b53', 5,55,3,1);
    pair(ivory, 5,50,3,1);

    // Long central fuselage and a prominent glacial blue teardrop canopy.
    shape(ink, [-1,1, 1,1, 4,11, 5,19, 6,32, 5,44, 3,53, 2,59, -2,59, -3,53, -5,44, -6,32, -5,19, -4,11]);
    shape(steel, [0,3, 2,9, 4,17, 5,31, 4,44, 2,53, 1,57, -1,57, -4,44, -5,32, -4,18, -2,9]);
    shape(ivory, [0,3, 2,11, 3,17, 4,31, 3,43, 1,52, -2,49, -4,36, -4,22, -2,11]);
    shape(white, [0,3, 0,17, -2,21, -3,20, -2,12]);
    shape(orange, [0,3, 2,10, 2,14, 0,12, -2,13, -1,8]);
    shape(deep, [-1,15, 1,15, 3,21, 3,28, 1,33, -2,33, -4,28, -3,20]);
    shape('#24647b', [-1,16, 1,16, 2,21, 2,27, 0,30, -2,29, -3,26, -2,20]);
    shape('#58b2bf', [-1,17, 1,18, 1,20, -1,25, -2,26, -2,21]);
    rect('#c0f4ea', -1,18,1,4);
    shape(steel, [-3,28, 0,30, 2,28, 2,30, 0,32, -2,31]);
    shape(orange, [-2,34, 2,34, 2,39, 0,45, -2,40]);
    rect(white, -1,35,1,4);
    shape(deep, [-2,42, 1,44, 2,51, 1,57, -1,57, -2,50]);
    shape(lightSteel, [-1,42, 0,44, 0,55, -1,54]);
    pair(deep, 3,37,1,4);
  }

  function makeRaider(g) {
    const {shape, both, rect, pair} = painter(g);
    const rose = '#d95346', sun = '#ff9371';
    both(ink, [3,36, 9,37, 18,48, 18,53, 12,52, 3,48]);
    both('#923d3d', [4,38, 8,38, 16,48, 16,51, 7,47]);
    both(rose, [5,38, 8,38, 14,46, 10,46]);
    both(ink, [3,18, 8,21, 14,27, 28,31, 31,29, 31,38, 24,42, 14,41, 8,45, 3,44]);
    both('#90373a', [4,20, 8,23, 15,29, 28,33, 29,32, 29,37, 23,40, 14,39, 6,43]);
    both(rose, [6,22, 10,25, 16,29, 29,33, 28,36, 23,38, 17,36, 6,39]);
    both(sun, [8,23, 16,29, 28,32, 29,34, 15,31]);
    both(ivory, [20,31, 23,32, 21,38, 18,37]);
    both(deep, [10,29, 13,31, 12,36, 9,37]);
    both(ink, [3,25, 8,24, 10,27, 9,45, 7,52, 3,52]);
    both('#aa4b47', [4,26, 7,26, 8,29, 7,44, 6,49, 4,49]);
    pair(lightSteel, 5,28,2,5);
    pair(steel, 4,47,4,2);
    shape(ink, [-1,5, 1,5, 4,12, 5,19, 6,32, 4,43, 2,51, -2,51, -4,43, -6,32, -5,19, -4,12]);
    shape(rose, [-1,8, 1,8, 3,13, 4,20, 4,32, 2,43, 1,48, -1,48, -4,33, -4,20, -3,14]);
    shape(sun, [-1,9, 0,9, -1,16, -3,20, -3,15]);
    shape(deep, [-2,18, 1,18, 3,22, 3,28, 1,31, -2,31, -3,28, -3,23]);
    shape('#6aadc2', [-1,19, 1,20, 1,24, -2,28, -2,23]);
    rect('#c7f9eb', -1,20,1,3);
    shape(ivory, [-2,33, 2,33, 1,38, -1,41, -2,38]);
  }

  function makeHornet(g) {
    const {shape, both, rect, pair} = painter(g);
    const ochre = '#ad5734', gold = '#f1a346', pale = '#ffde84';
    both(ink, [2,20, 8,23, 13,24, 24,13, 28,10, 30,12, 29,31, 25,37, 14,41, 9,49, 2,47]);
    both(ochre, [4,23, 13,27, 26,14, 28,13, 27,30, 23,35, 13,39, 8,46, 4,45]);
    both(gold, [5,24, 13,27, 26,15, 28,13, 26,26, 21,33, 13,36, 8,42]);
    both(pale, [14,27, 26,15, 27,14, 24,20, 17,27]);
    both(deep, [19,24, 25,19, 24,23, 17,31, 14,32]);
    both(ink, [6,31, 10,26, 14,26, 15,30, 14,45, 12,51, 7,51, 6,46]);
    both(steel, [8,32, 10,28, 13,28, 13,41, 11,48, 8,48]);
    both(gold, [9,31, 11,28, 13,28, 13,31, 10,35, 8,36]);
    pair(deep, 9,37,4,3);
    pair(pale, 10,37,2,1);
    shape(ink, [-2,7, 2,7, 6,15, 7,24, 8,35, 5,42, 8,48, 8,52, 0,48, -8,52, -8,48, -5,42, -8,35, -7,22, -6,15]);
    shape(ochre, [-1,9, 1,9, 5,16, 6,26, 6,35, 3,42, 5,47, 0,45, -5,47, -3,42, -6,34, -5,17]);
    shape(gold, [-1,9, 1,9, 3,14, 4,24, 4,33, 1,42, -2,40, -5,33, -5,24, -4,16]);
    shape(pale, [-1,10, 0,11, -2,17, -3,19, -3,15]);
    shape(ink, [-3,20, 1,19, 4,21, 4,28, 1,32, -2,32, -4,28]);
    shape('#63a8ad', [-2,21, 1,20, 2,22, 1,25, -2,28, -3,26]);
    rect('#d0edce', -2,22,2,1);
    pair(deep, 1,35,2,2);
  }

  const designs = {};
  for (const [name, paint, engines] of [
    ['player', makePlayer, [[-6.5,57], [6.5,57]]],
    ['enemy', makeRaider, [[-5.5,51], [5.5,51]]],
    ['enemy2', makeHornet, [[-10,50], [10,50]]]
  ]) {
    const sprite = newCanvas();
    paint(sprite.getContext('2d'));
    const shadow = newCanvas();
    const silhouette = shadow.getContext('2d');
    silhouette.drawImage(sprite, 0, 0);
    silhouette.globalCompositeOperation = 'source-in';
    silhouette.fillStyle = '#184753';
    silhouette.fillRect(0, 0, width, height);
    designs[name] = {sprite, shadow, engines};
  }

  function draw(ctx, kind, x, y, size, bank = 0, time = 0) {
    const design = designs[kind];
    if (!design || size <= 0) return;
    const roll = Math.max(-1, Math.min(1, bank));
    const unit = size / 64;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.rotate((kind === 'player' ? 0 : Math.PI) + roll * 0.14);
    ctx.scale(unit * (1 - 0.13 * Math.abs(roll)), unit);
    ctx.save();
    ctx.globalAlpha *= 0.23;
    ctx.drawImage(design.shadow, -center + 3, kind === 'player' ? -25 : -34);
    ctx.restore();
    ctx.translate(-center, -29);
    const beat = Math.floor(time * 12) % 4;
    for (const [engineX, engineY] of design.engines) {
      const flameX = Math.round(center + engineX - 2);
      const length = [6, 9, 7, 10][beat] ?? 7;
      ctx.fillStyle = '#dc642d';
      ctx.fillRect(flameX, engineY, 4, length - 2);
      ctx.fillRect(flameX + 1, engineY + length - 2, 2, 2);
      ctx.fillStyle = '#ffba55';
      ctx.fillRect(flameX + 1, engineY, 2, length - 1);
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect(flameX + 1, engineY, 2, 3);
    }
    ctx.drawImage(design.sprite, 0, 0);
    ctx.restore();
  }

  window.SkimmerSprites = {draw};
})();
