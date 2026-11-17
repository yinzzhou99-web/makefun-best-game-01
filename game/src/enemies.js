// VOIDPULSE enemies: four void-spawned hunters, each with its own steering.
//   dart    — small, fast, flies straight at you.                       (pink)
//   weaver  — approaches on a sine wave, hard to lead your shots.       (cyan)
//   stinger — keeps its distance, flashes, then lunges in a dash.       (amber)
//   bruiser — slow armoured hexagon; splits into two darts when killed. (red)
// Enemies warp in at the arena edge over half a second, harmless while the
// warp lasts, so nothing ever materialises on top of the player.
window.VP = window.VP || {};

VP.Enemies = (function () {
  var TYPES = {
    dart:    { r: 13, hp: 2,  speed: 118, score: 50,  color: '#ff3ea8', damage: 8 },
    weaver:  { r: 14, hp: 3,  speed: 96,  score: 80,  color: '#2ee6d6', damage: 10 },
    stinger: { r: 13, hp: 3,  speed: 84,  score: 120, color: '#ffb52e', damage: 12 },
    bruiser: { r: 30, hp: 14, speed: 46,  score: 300, color: '#ff4545', damage: 20 }
  };
  var list = [];

  function spawnPoint(bounds) {
    var side = (Math.random() * 4) | 0;
    var m = 34;
    if (side === 0) return { x: bounds.x + m + Math.random() * (bounds.w - 2 * m), y: bounds.y + m };
    if (side === 1) return { x: bounds.x + m + Math.random() * (bounds.w - 2 * m), y: bounds.y + bounds.h - m };
    if (side === 2) return { x: bounds.x + m, y: bounds.y + m + Math.random() * (bounds.h - 2 * m) };
    return { x: bounds.x + bounds.w - m, y: bounds.y + m + Math.random() * (bounds.h - 2 * m) };
  }

  function spawn(kind, bounds, x, y) {
    var t = TYPES[kind];
    var pt = (x !== undefined) ? { x: x, y: y } : spawnPoint(bounds);
    list.push({
      kind: kind, x: pt.x, y: pt.y, vx: 0, vy: 0,
      r: t.r, hp: t.hp, maxHp: t.hp, speed: t.speed,
      score: t.score, color: t.color, damage: t.damage,
      warp: 0.55, phase: Math.random() * Math.PI * 2,
      state: 'stalk', stateT: 1 + Math.random() * 1.4,
      angle: 0, flash: 0
    });
  }

  // The wave recipe: more of everything as waves climb, bruisers from wave 2,
  // stingers from wave 3, and a gentle speed/HP creep so late waves bite.
  function waveQueue(wave) {
    var q = [];
    var darts = 5 + wave * 2;
    var weavers = wave >= 2 ? 2 + wave : 0;
    var bruisers = wave >= 2 ? Math.floor((wave - 1) / 1) : 0;
    var stingers = wave >= 3 ? wave - 1 : 0;
    var i;
    for (i = 0; i < darts; i++) q.push('dart');
    for (i = 0; i < weavers; i++) q.push('weaver');
    for (i = 0; i < stingers; i++) q.push('stinger');
    for (i = 0; i < bruisers; i++) q.push('bruiser');
    // Shuffle so kinds interleave instead of arriving in blocks.
    for (i = q.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var tmp = q[i]; q[i] = q[j]; q[j] = tmp;
    }
    return q;
  }

  function steer(e, dt, player, time) {
    var dx = player.x - e.x, dy = player.y - e.y;
    var d = Math.hypot(dx, dy) || 1;
    var ux = dx / d, uy = dy / d;
    var speed = e.speed;
    if (e.kind === 'dart') {
      e.vx = ux * speed; e.vy = uy * speed;
    } else if (e.kind === 'weaver') {
      var wob = Math.sin(time * 3.4 + e.phase) * 0.85;
      var px = -uy * wob, py = ux * wob;
      e.vx = (ux + px) * speed; e.vy = (uy + py) * speed;
    } else if (e.kind === 'bruiser') {
      e.vx = ux * speed; e.vy = uy * speed;
      e.angle += dt * 0.7;
    } else if (e.kind === 'stinger') {
      e.stateT -= dt;
      if (e.state === 'stalk') {
        var want = d > 240 ? 1 : (d < 170 ? -0.6 : 0.15);
        e.vx = ux * speed * want - uy * speed * 0.4;
        e.vy = uy * speed * want + ux * speed * 0.4;
        if (e.stateT <= 0 && d < 330) { e.state = 'aim'; e.stateT = 0.45; }
      } else if (e.state === 'aim') {
        e.vx *= 0.8; e.vy *= 0.8;
        e.flash = 1;
        if (e.stateT <= 0) {
          e.state = 'lunge';
          e.stateT = 0.42;
          e.vx = ux * 520; e.vy = uy * 520;
        }
      } else { // lunge
        if (e.stateT <= 0) { e.state = 'stalk'; e.stateT = 1.1 + Math.random(); }
      }
    }
    if (e.kind !== 'stinger') e.angle = Math.atan2(e.vy, e.vx);
    else if (e.state !== 'lunge') e.angle = Math.atan2(dy, dx);
  }

  function update(dt, player, time) {
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (e.flash > 0) e.flash -= dt * 3;
      if (e.warp > 0) { e.warp -= dt; continue; }
      steer(e, dt, player, time);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    // Gentle separation so hunters do not stack into one blob.
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        var e1 = list[a], e2 = list[b];
        var dx = e2.x - e1.x, dy = e2.y - e1.y;
        var d = Math.hypot(dx, dy);
        var min = e1.r + e2.r + 2;
        if (d > 0 && d < min) {
          var push = (min - d) / d * 0.5;
          e1.x -= dx * push * 0.5; e1.y -= dy * push * 0.5;
          e2.x += dx * push * 0.5; e2.y += dy * push * 0.5;
        }
      }
    }
  }

  function drawShape(ctx, e) {
    ctx.rotate(e.angle);
    ctx.beginPath();
    if (e.kind === 'dart') {
      ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9); ctx.closePath();
    } else if (e.kind === 'weaver') {
      ctx.moveTo(0, -13); ctx.lineTo(11, 0); ctx.lineTo(0, 13); ctx.lineTo(-11, 0); ctx.closePath();
    } else if (e.kind === 'stinger') {
      ctx.moveTo(15, 0); ctx.lineTo(-4, 10); ctx.lineTo(-13, 4); ctx.lineTo(-13, -4); ctx.lineTo(-4, -10); ctx.closePath();
    } else {
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        else ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  function draw(ctx, time) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.warp > 0) {
        // Warp-in: a shrinking ring and a fading ghost of the shape.
        var f = 1 - e.warp / 0.55;
        ctx.globalAlpha = f * 0.8;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + (1 - f) * 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.scale(0.6 + f * 0.4, 0.6 + f * 0.4);
      }
      var flashWhite = e.flash > 0.4 || e.hitFlash > 0;
      ctx.fillStyle = flashWhite ? '#ffffff' : 'rgba(10,8,28,0.9)';
      ctx.strokeStyle = flashWhite ? '#ffffff' : e.color;
      ctx.lineWidth = 2;
      if (e.kind === 'stinger' && e.state === 'aim') {
        ctx.strokeStyle = Math.sin(time * 40) > 0 ? '#ffffff' : e.color;
      }
      drawShape(ctx, e);
      // Bright core so every hunter reads as alive, not just an outline.
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.kind === 'bruiser' ? 7 : 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (e.hitFlash > 0) e.hitFlash -= 0.08;
      // Bruisers wear their armour down visibly: a small HP arc.
      if (e.kind === 'bruiser' && e.hp < e.maxHp) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.hp / e.maxHp)); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function clear() { list.length = 0; } // keep the exported reference valid
  function count() { return list.length; }
  function at(i) { return list[i]; }
  function removeAt(i) { list.splice(i, 1); }

  return {
    TYPES: TYPES, list: list, spawn: spawn, waveQueue: waveQueue,
    update: update, draw: draw, clear: clear, count: count, at: at, removeAt: removeAt
  };
})();
