// VOIDPULSE particles: sparks, shockwave rings and floating score text.
// One pooled system the whole game feeds; capped so a big chain of explosions
// can never slow the frame down.
window.VP = window.VP || {};

VP.Particles = (function () {
  var MAX = 420;
  var sparks = [];
  var rings = [];
  var texts = [];

  function burst(x, y, color, count, speed, life, size) {
    for (var i = 0; i < count; i++) {
      if (sparks.length >= MAX) return;
      var a = Math.random() * Math.PI * 2;
      var v = (0.25 + Math.random() * 0.75) * speed;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * (0.5 + Math.random() * 0.5), maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: color
      });
    }
  }

  function trail(x, y, color) {
    if (sparks.length >= MAX) return;
    sparks.push({
      x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24,
      life: 0.3, maxLife: 0.3, size: 2.4, color: color
    });
  }

  function ring(x, y, color, maxR) {
    rings.push({ x: x, y: y, r: 6, maxR: maxR || 64, color: color, alpha: 0.8 });
  }

  function text(x, y, str, color, size) {
    texts.push({ x: x, y: y, str: str, color: color || '#ffffff', size: size || 15, life: 0.9 });
  }

  function update(dt) {
    var i, p;
    for (i = sparks.length - 1; i >= 0; i--) {
      p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 2.4 * dt);
      p.vy *= (1 - 2.4 * dt);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var r = rings[i];
      r.r += 260 * dt;
      r.alpha -= 1.6 * dt;
      if (r.r >= r.maxR || r.alpha <= 0) rings.splice(i, 1);
    }
    for (i = texts.length - 1; i >= 0; i--) {
      var t = texts[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
  }

  function draw(ctx) {
    var i, p;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < sparks.length; i++) {
      p = sparks[i];
      var f = p.life / p.maxLife;
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * f + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (i = 0; i < rings.length; i++) {
      var r = rings[i];
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (i = 0; i < texts.length; i++) {
      var t = texts[i];
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = 'bold ' + t.size + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  function clear() { sparks = []; rings = []; texts = []; }

  return { burst: burst, trail: trail, ring: ring, text: text, update: update, draw: draw, clear: clear };
})();
