// VOIDPULSE player: the last interceptor. Moves with WASD/arrows, aims with
// the mouse, fires on mouse hold or Space, and dashes on Shift — a short
// burst of speed with invulnerability frames, on a cooldown shown in the HUD.
window.VP = window.VP || {};

VP.Player = (function () {
  var SPEED = 272;
  var DASH_TIME = 0.16;
  var DASH_COOLDOWN = 1.6;
  var DASH_MULT = 3.4;

  function create(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0, r: 14,
      hp: 100, maxHp: 100,
      angle: -Math.PI / 2,
      fireCd: 0, rapidT: 0, shieldT: 0, invulnT: 0,
      dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0,
      alive: true, flame: 0
    };
  }

  // env: { input, bullets, bounds, audio, particles }
  function update(p, dt, env) {
    var input = env.input;
    var ax = input.axis();
    p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

    if (p.rapidT > 0) p.rapidT -= dt;
    if (p.shieldT > 0) p.shieldT -= dt;
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    // Dash: starts on Shift with a direction, overrides normal thrust.
    var dashing = false;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * SPEED * DASH_MULT;
      p.vy = p.dashDy * SPEED * DASH_MULT;
      dashing = true;
      env.particles.trail(p.x, p.y, '#40e0ff');
    } else if ((input.hit('ShiftLeft') || input.hit('ShiftRight')) && p.dashCd <= 0) {
      var dx = ax.x, dy = ax.y;
      if (dx === 0 && dy === 0) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
      var len = Math.hypot(dx, dy) || 1;
      p.dashDx = dx / len;
      p.dashDy = dy / len;
      p.dashT = DASH_TIME;
      p.dashCd = DASH_COOLDOWN;
      p.invulnT = Math.max(p.invulnT, DASH_TIME + 0.05);
      env.audio.dash();
    }

    if (!dashing) {
      var accel = 2400;
      p.vx += ax.x * accel * dt;
      p.vy += ax.y * accel * dt;
      var drag = Math.pow(0.0015, dt); // snappy stop, no ice rink
      p.vx *= drag;
      p.vy *= drag;
      var sp = Math.hypot(p.vx, p.vy);
      if (sp > SPEED) { p.vx = p.vx / sp * SPEED; p.vy = p.vy / sp * SPEED; }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    var b = env.bounds;
    p.x = Math.max(b.x + p.r, Math.min(b.x + b.w - p.r, p.x));
    p.y = Math.max(b.y + p.r, Math.min(b.y + b.h - p.r, p.y));
    p.flame += dt * (Math.hypot(p.vx, p.vy) > 30 ? 22 : 6);

    // Cannon: hold the mouse or Space. Rapid pickup doubles the rate.
    var firing = input.mouse.down || input.held('Space');
    if (firing && p.fireCd <= 0) {
      p.fireCd = p.rapidT > 0 ? 0.075 : 0.145;
      var spread = (Math.random() - 0.5) * 0.045;
      var a = p.angle + spread;
      env.bullets.push({
        x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
        vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
        life: 0.9, r: 4
      });
      env.audio.shoot();
    }
  }

  function draw(ctx, p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Engine flame behind the ship, flickering with thrust.
    var thrust = Math.hypot(p.vx, p.vy) / SPEED;
    ctx.save();
    ctx.rotate(p.angle);
    var flameLen = 12 + Math.sin(p.flame) * 4 + thrust * 12;
    ctx.fillStyle = 'rgba(255,150,40,0.85)';
    ctx.beginPath();
    ctx.moveTo(-12, 5);
    ctx.lineTo(-12 - flameLen, 0);
    ctx.lineTo(-12, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Hull: a sleek arrowhead in pulse cyan, blinking while invulnerable.
    var blink = p.invulnT > 0 && Math.sin(time * 30) > 0;
    ctx.rotate(p.angle);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fillStyle = '#0b2b3d';
    ctx.strokeStyle = '#40e0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bffbff';
    ctx.beginPath();
    ctx.arc(4, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield bubble on its own layer so it reads over the hull.
    if (p.shieldT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.15;
      ctx.strokeStyle = '#39d5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  return { create: create, update: update, draw: draw };
})();
