// VOIDPULSE pickups: cores dropped by dead enemies. Fly to one and it applies
// at once — repair the hull, overcharge the cannon, or raise a shield.
// Kinds cycle through a fixed table so drops stay readable at a glance:
// green cross = repair, amber chevrons = rapid fire, cyan bubble = shield.
window.VP = window.VP || {};

VP.Pickups = (function () {
  var KINDS = {
    repair: { color: '#3dff7c', label: '+25 HULL' },
    rapid: { color: '#ffb52e', label: 'RAPID FIRE' },
    shield: { color: '#39d5ff', label: 'SHIELD' }
  };
  var DROP_CHANCE = 0.16;
  var list = [];

  function maybeDrop(x, y, forceKind) {
    if (!forceKind && Math.random() > DROP_CHANCE) return;
    var kinds = ['repair', 'rapid', 'shield'];
    var kind = forceKind || kinds[(Math.random() * kinds.length) | 0];
    list.push({ x: x, y: y, kind: kind, r: 11, age: 0, life: 11, vx: 0, vy: 0 });
  }

  // Returns the list of pickups the player touched this frame (and removes them).
  function update(dt, player) {
    var taken = [];
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.age += dt;
      var dx = player.x - p.x, dy = player.y - p.y;
      var d = Math.hypot(dx, dy) || 1;
      if (d < 130) { // magnet drift: cores lean toward a nearby ship
        p.vx += (dx / d) * 620 * dt;
        p.vy += (dy / d) * 620 * dt;
      }
      p.vx *= (1 - 3 * dt);
      p.vy *= (1 - 3 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < player.r + p.r + 2) {
        taken.push(p);
        list.splice(i, 1);
      } else if (p.age > p.life) {
        list.splice(i, 1);
      }
    }
    return taken;
  }

  function apply(pickup, player) {
    if (pickup.kind === 'repair') player.hp = Math.min(player.maxHp, player.hp + 25);
    if (pickup.kind === 'rapid') player.rapidT = 8;
    if (pickup.kind === 'shield') player.shieldT = 6;
    return KINDS[pickup.kind].label;
  }

  function drawIcon(ctx, p) {
    var c = KINDS[p.kind].color;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = 2.4;
    if (p.kind === 'repair') {
      ctx.fillRect(p.x - 2.5, p.y - 8, 5, 16);
      ctx.fillRect(p.x - 8, p.y - 2.5, 16, 5);
    } else if (p.kind === 'rapid') {
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x - 5 + i * 6, p.y + 5);
        ctx.lineTo(p.x + i * 6, p.y - 5);
        ctx.lineTo(p.x + 5 + i * 6, p.y + 5);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(ctx, time) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var fade = p.life - p.age < 2.5 ? (Math.sin(time * 14) > 0 ? 1 : 0.25) : 1;
      var pulse = 1 + Math.sin(time * 5 + p.x) * 0.12;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      ctx.translate(-p.x, -p.y);
      ctx.strokeStyle = KINDS[p.kind].color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 3, time * 2, time * 2 + Math.PI * 1.5);
      ctx.stroke();
      drawIcon(ctx, p);
      ctx.restore();
    }
  }

  function clear() { list = []; }
  function count() { return list.length; }

  return { maybeDrop: maybeDrop, update: update, apply: apply, draw: draw, clear: clear, count: count, KINDS: KINDS };
})();
