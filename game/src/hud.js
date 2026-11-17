// VOIDPULSE hud: everything that is not a ship — the starfield and arena,
// the in-game readouts, and the title / wave banner / game-over screens.
// All of it is drawn on the canvas so a screenshot shows the whole game.
window.VP = window.VP || {};

VP.Hud = (function () {
  var FONT = '"Segoe UI", system-ui, sans-serif';

  function makeStars(w, h) {
    var stars = [];
    for (var i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        z: 0.25 + Math.random() * 0.75,
        tw: Math.random() * Math.PI * 2
      });
    }
    return stars;
  }

  function drawWorld(ctx, stars, bounds, time, w, h) {
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#070818');
    grad.addColorStop(0.6, '#0a0a24');
    grad.addColorStop(1, '#12081f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Stars drift slowly downward; nearer stars are brighter and faster.
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var y = (s.y + time * 9 * s.z) % h;
      var a = 0.25 + s.z * 0.55 + Math.sin(time * 2 + s.tw) * 0.15;
      ctx.globalAlpha = Math.max(0.08, a);
      ctx.fillStyle = s.z > 0.8 ? '#cfe9ff' : '#8fa3cc';
      ctx.fillRect(s.x, y, s.z > 0.8 ? 2.2 : 1.4, s.z > 0.8 ? 2.2 : 1.4);
    }
    ctx.globalAlpha = 1;
    // Faint grid inside the arena so motion reads against the floor.
    ctx.strokeStyle = 'rgba(70,90,180,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = bounds.x + 64; gx < bounds.x + bounds.w; gx += 64) {
      ctx.moveTo(gx, bounds.y); ctx.lineTo(gx, bounds.y + bounds.h);
    }
    for (var gy = bounds.y + 64; gy < bounds.y + bounds.h; gy += 64) {
      ctx.moveTo(bounds.x, gy); ctx.lineTo(bounds.x + bounds.w, gy);
    }
    ctx.stroke();
    // The arena frame: a double neon border.
    ctx.strokeStyle = 'rgba(64,224,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(255,62,168,0.20)';
    ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.w + 10, bounds.h + 10);
  }

  function bar(ctx, x, y, w, h, frac, color, back) {
    ctx.fillStyle = back || 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }

  function drawHud(ctx, G) {
    var p = G.player;
    ctx.save();
    ctx.font = 'bold 15px ' + FONT;
    ctx.textBaseline = 'middle';
    // Hull, top left.
    ctx.fillStyle = '#9fd8e8';
    ctx.textAlign = 'left';
    ctx.fillText('HULL', 26, 24);
    var hpFrac = p.hp / p.maxHp;
    bar(ctx, 76, 17, 190, 13, hpFrac, hpFrac > 0.3 ? '#3dff7c' : '#ff4545');
    ctx.fillStyle = '#e8fbff';
    ctx.fillText(Math.max(0, Math.ceil(p.hp)) + '', 274, 24);
    // Dash cooldown pip beside the hull bar.
    ctx.fillStyle = '#9fd8e8';
    ctx.fillText('DASH', 330, 24);
    bar(ctx, 382, 17, 54, 13, 1 - Math.max(0, p.dashCd) / 1.6, '#40e0ff');
    // Wave and hostiles, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd9f2';
    ctx.font = 'bold 19px ' + FONT;
    ctx.fillText('WAVE ' + G.wave, 640, 23);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText('HOSTILES ' + (G.hostilesLeft), 640, 44);
    // Score and combo, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px ' + FONT;
    ctx.fillText(G.score.toLocaleString('en-US'), 1254, 22);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = '#9fb4d8';
    ctx.fillText('BEST ' + G.best.toLocaleString('en-US'), 1254, 42);
    if (G.combo >= 2) {
      ctx.fillStyle = '#ffb52e';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText('COMBO x' + G.multiplier + '  (' + G.combo + ')', 1254, 62);
      bar(ctx, 1130, 72, 124, 4, G.comboT / 3, '#ffb52e', 'rgba(255,181,46,0.18)');
    }
    // Active pickup timers, under the hull.
    var ty = 48;
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px ' + FONT;
    if (p.rapidT > 0) { ctx.fillStyle = '#ffb52e'; ctx.fillText('RAPID ' + p.rapidT.toFixed(0) + 's', 26, ty); ty += 16; }
    if (p.shieldT > 0) { ctx.fillStyle = '#39d5ff'; ctx.fillText('SHIELD ' + p.shieldT.toFixed(0) + 's', 26, ty); }
    // Controls reminder, fading out after the first seconds of a run.
    if (G.elapsed < 6) {
      ctx.globalAlpha = Math.max(0, 1 - G.elapsed / 6);
      ctx.textAlign = 'center';
      ctx.font = '13px ' + FONT;
      ctx.fillStyle = '#c8d6f5';
      ctx.fillText('WASD move · mouse aim · hold click to fire · SHIFT dash · P pause · M mute', 640, 782);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function bigGlowText(ctx, text, x, y, size, color) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 ' + size + 'px ' + FONT;
    ctx.shadowColor = color;
    ctx.shadowBlur = 34;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawTitle(ctx, G, time) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,16,0.45)';
    ctx.fillRect(0, 0, 1280, 800);
    bigGlowText(ctx, 'VOIDPULSE', 640, 218, 92, '#40e0ff');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3ea8';
    ctx.font = 'bold 21px ' + FONT;
    ctx.fillText('N E O N   A R E N A   S U R V I V A L', 640, 268);
    ctx.fillStyle = '#c8d6f5';
    ctx.font = '17px ' + FONT;
    ctx.fillText('The void sends its hunters in waves. You are the last interceptor.', 640, 318);
    ctx.fillText('Blast them apart, chain combos, grab their cores — and do not let the hull reach zero.', 640, 344);
    // Controls panel.
    ctx.fillStyle = 'rgba(10,14,34,0.82)';
    ctx.strokeStyle = 'rgba(64,224,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(440, 386, 400, 148);
    ctx.strokeRect(440, 386, 400, 148);
    ctx.fillStyle = '#e8fbff';
    ctx.font = '15px ' + FONT;
    var rows = [
      'WASD / arrows — fly',
      'Mouse — aim · hold click / Space — fire',
      'Shift — dash (brief invulnerability)',
      'Cores — repair · rapid fire · shield',
      'P — pause · M — mute'
    ];
    for (var i = 0; i < rows.length; i++) ctx.fillText(rows[i], 640, 416 + i * 24);
    if (G.best > 0) {
      ctx.fillStyle = '#ffb52e';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText('BEST SCORE  ' + G.best.toLocaleString('en-US'), 640, 566);
    }
    if (Math.sin(time * 3.2) > -0.25) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', 640, 622);
    }
    ctx.fillStyle = '#5f719e';
    ctx.font = '12px ' + FONT;
    ctx.fillText('an original arena game · sound on for the full pulse', 640, 762);
    ctx.restore();
  }

  function drawBanner(ctx, G) {
    if (G.bannerT <= 0) return;
    var a = Math.min(1, G.bannerT / 0.5, (1.9 - G.bannerT) / 0.5 + 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    bigGlowText(ctx, G.bannerText, 640, 330, 54, G.bannerColor);
    if (G.bannerSub) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8fbff';
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillText(G.bannerSub, 640, 372);
    }
    ctx.restore();
  }

  function drawGameOver(ctx, G, time) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,3,12,0.72)';
    ctx.fillRect(0, 0, 1280, 800);
    bigGlowText(ctx, 'SIGNAL LOST', 640, 268, 64, '#ff4545');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8d6f5';
    ctx.font = '17px ' + FONT;
    ctx.fillText('The void takes another interceptor. The arena remembers the run:', 640, 316);
    ctx.fillStyle = 'rgba(10,14,34,0.85)';
    ctx.strokeStyle = 'rgba(255,69,69,0.45)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(470, 348, 340, 150);
    ctx.strokeRect(470, 348, 340, 150);
    ctx.font = 'bold 19px ' + FONT;
    ctx.fillStyle = '#ffffff';
    var rows = [
      ['SCORE', G.score.toLocaleString('en-US')],
      ['BEST', G.best.toLocaleString('en-US')],
      ['WAVE REACHED', '' + G.wave],
      ['KILLS', '' + G.kills],
      ['TIME', G.elapsed.toFixed(0) + 's']
    ];
    for (var i = 0; i < rows.length; i++) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb4d8';
      ctx.fillText(rows[i][0], 496, 380 + i * 27);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(rows[i][1], 784, 380 + i * 27);
    }
    if (G.score >= G.best && G.score > 0) {
      ctx.fillStyle = '#ffb52e';
      ctx.font = 'bold 16px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('— NEW BEST —', 640, 524);
    }
    if (Math.sin(time * 3.2) > -0.25) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 21px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', 640, 574);
    }
    ctx.restore();
  }

  function drawPaused(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,16,0.6)';
    ctx.fillRect(0, 0, 1280, 800);
    bigGlowText(ctx, 'PAUSED', 640, 400, 52, '#40e0ff');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8d6f5';
    ctx.font = '16px ' + FONT;
    ctx.fillText('Press P to resume', 640, 448);
    ctx.restore();
  }

  return {
    makeStars: makeStars, drawWorld: drawWorld, drawHud: drawHud,
    drawTitle: drawTitle, drawBanner: drawBanner, drawGameOver: drawGameOver,
    drawPaused: drawPaused
  };
})();
