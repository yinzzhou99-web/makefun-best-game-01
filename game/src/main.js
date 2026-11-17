// VOIDPULSE — main: boots the game, owns the run state, and stitches the
// modules together each frame: input -> player -> bullets -> enemies ->
// pickups -> particles, with collisions, combo scoring, waves and screens.
//
// States: 'title' -> 'playing' <-> 'paused' -> 'gameover' -> 'playing' ...
window.VP = window.VP || {};

(function () {
  var W = 1280, H = 800;
  var BOUNDS = { x: 24, y: 58, w: 1232, h: 724 };
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var stars = VP.Hud.makeStars(W, H);
  var menuShip = VP.Player.create(640, 596);

  var G = {
    state: 'title',
    paused: false,
    time: 0,
    elapsed: 0,
    player: VP.Player.create(640, 430),
    bullets: [],
    score: 0,
    best: loadBest(),
    wave: 0,
    kills: 0,
    combo: 0,
    comboT: 0,
    multiplier: 1,
    queue: [],
    spawnT: 0,
    bannerT: 0,
    bannerText: '',
    bannerSub: '',
    bannerColor: '#40e0ff',
    betweenT: 0,
    trauma: 0,
    hostilesLeft: 0
  };

  function loadBest() {
    try { return parseInt(window.localStorage.getItem('voidpulse_best') || '0', 10) || 0; }
    catch (err) { return 0; }
  }
  function saveBest() {
    try { window.localStorage.setItem('voidpulse_best', String(G.best)); } catch (err) { /* private mode */ }
  }

  function banner(text, sub, color) {
    G.bannerText = text;
    G.bannerSub = sub || '';
    G.bannerColor = color || '#40e0ff';
    G.bannerT = 1.9;
  }

  function startGame() {
    VP.Audio.ensure();
    VP.Audio.uiStart();
    G.player = VP.Player.create(640, 430);
    G.bullets = [];
    VP.Enemies.clear();
    VP.Pickups.clear();
    VP.Particles.clear();
    G.score = 0;
    G.wave = 0;
    G.kills = 0;
    G.combo = 0;
    G.comboT = 0;
    G.multiplier = 1;
    G.elapsed = 0;
    G.trauma = 0;
    G.state = 'playing';
    G.paused = false;
    VP.Audio.startMusic();
    nextWave();
  }

  function nextWave() {
    G.wave += 1;
    G.queue = VP.Enemies.waveQueue(G.wave);
    G.spawnT = 0.4;
    // The first hunters of a wave arrive at once, so the fight starts hot;
    // the rest trickle in behind them.
    for (var i = 0; i < 3 && G.queue.length > 0; i++) {
      VP.Enemies.spawn(G.queue.shift(), BOUNDS);
    }
    banner('WAVE ' + G.wave, G.wave === 1 ? 'they are coming from the edges' : '', '#40e0ff');
    VP.Audio.waveHorn();
  }

  function addTrauma(n) { G.trauma = Math.min(1, G.trauma + n); }

  function killEnemy(index, awardScore) {
    var e = VP.Enemies.at(index);
    VP.Enemies.removeAt(index);
    G.kills += 1;
    if (awardScore) {
      G.combo += 1;
      G.comboT = 3;
      G.multiplier = Math.min(5, 1 + Math.floor(G.combo / 10));
      var gained = e.score * G.multiplier;
      G.score += gained;
      VP.Particles.text(e.x, e.y - 10, '+' + gained, e.kind === 'bruiser' ? '#ffb52e' : '#ffffff', e.kind === 'bruiser' ? 20 : 14);
    }
    VP.Particles.burst(e.x, e.y, e.color, e.kind === 'bruiser' ? 42 : 16, e.kind === 'bruiser' ? 320 : 240, 0.6, 3);
    if (e.kind === 'bruiser') {
      VP.Particles.ring(e.x, e.y, e.color, 110);
      addTrauma(0.35);
      VP.Audio.explode(true);
      // The bruiser's hull bursts into two darts, already mid-arena.
      VP.Enemies.spawn('dart', BOUNDS, e.x - 18, e.y);
      VP.Enemies.spawn('dart', BOUNDS, e.x + 18, e.y);
    } else {
      VP.Audio.explode(false);
    }
    VP.Pickups.maybeDrop(e.x, e.y, e.kind === 'bruiser' ? 'repair' : undefined);
  }

  function damagePlayer(amount, fromX, fromY) {
    var p = G.player;
    if (p.shieldT > 0 || p.invulnT > 0 || !p.alive) return;
    p.hp -= amount;
    p.invulnT = 0.8;
    addTrauma(0.45);
    VP.Particles.burst(p.x, p.y, '#ff4545', 22, 280, 0.5, 3);
    VP.Particles.ring(p.x, p.y, '#ff4545', 70);
    VP.Audio.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      VP.Particles.burst(p.x, p.y, '#40e0ff', 70, 380, 1, 3.6);
      VP.Particles.burst(p.x, p.y, '#ff3ea8', 40, 260, 0.9, 3);
      VP.Particles.ring(p.x, p.y, '#ffffff', 150);
      addTrauma(1);
      VP.Audio.explode(true);
      VP.Audio.gameOver();
      VP.Audio.stopMusic();
      if (G.score > G.best) { G.best = G.score; saveBest(); }
      G.state = 'gameover';
    }
  }

  function updateBullets(dt) {
    var bullets = G.bullets;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < BOUNDS.x - 8 || b.x > BOUNDS.x + BOUNDS.w + 8 || b.y < BOUNDS.y - 8 || b.y > BOUNDS.y + BOUNDS.h + 8) {
        bullets.splice(i, 1);
        continue;
      }
      // One bullet, one hunter: the first it touches.
      for (var j = VP.Enemies.count() - 1; j >= 0; j--) {
        var e = VP.Enemies.at(j);
        if (e.warp > 0) continue;
        var dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          bullets.splice(i, 1);
          e.hp -= 1;
          e.hitFlash = 1;
          VP.Particles.burst(b.x, b.y, e.color, 5, 170, 0.3, 2.2);
          if (e.hp <= 0) killEnemy(j, true);
          else VP.Audio.hit();
          break;
        }
      }
    }
  }

  function updateContacts() {
    var p = G.player;
    for (var j = VP.Enemies.count() - 1; j >= 0; j--) {
      var e = VP.Enemies.at(j);
      if (e.warp > 0) continue;
      var dx = e.x - p.x, dy = e.y - p.y;
      var rr = e.r + p.r - 2;
      if (dx * dx + dy * dy < rr * rr) {
        if (p.shieldT > 0) {
          killEnemy(j, true); // the shield eats the hunter whole
        } else {
          damagePlayer(e.damage, e.x, e.y);
          if (e.kind !== 'bruiser') killEnemy(j, false);
          else { e.x -= dx * 0.6; e.y -= dy * 0.6; }
          if (!p.alive) return;
        }
      }
    }
  }

  function updatePlaying(dt) {
    G.elapsed += dt;
    if (G.bannerT > 0) G.bannerT -= dt;
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) { G.combo = 0; G.multiplier = 1; }
    }
    // Trickle the wave in from the edges.
    if (G.queue.length > 0) {
      G.spawnT -= dt;
      if (G.spawnT <= 0 && VP.Enemies.count() < 26) {
        VP.Enemies.spawn(G.queue.shift(), BOUNDS);
        G.spawnT = 0.45;
      }
    }
    var env = { input: VP.Input, bullets: G.bullets, bounds: BOUNDS, audio: VP.Audio, particles: VP.Particles };
    VP.Player.update(G.player, dt, env);
    VP.Enemies.update(dt, G.player, G.time);
    updateBullets(dt);
    if (G.player.alive) updateContacts();
    var taken = VP.Pickups.update(dt, G.player);
    for (var i = 0; i < taken.length; i++) {
      var label = VP.Pickups.apply(taken[i], G.player);
      VP.Particles.text(G.player.x, G.player.y - 30, label, VP.Pickups.KINDS[taken[i].kind].color, 16);
      VP.Particles.ring(G.player.x, G.player.y, VP.Pickups.KINDS[taken[i].kind].color, 54);
      VP.Audio.pickup();
    }
    G.hostilesLeft = G.queue.length + VP.Enemies.count();
    // Wave cleared: bonus, a breath, then the next wave.
    if (G.queue.length === 0 && VP.Enemies.count() === 0 && G.player.alive) {
      G.betweenT += dt;
      if (G.betweenT > 0.9) {
        G.betweenT = 0;
        var bonus = 100 * G.wave;
        G.score += bonus;
        banner('WAVE ' + G.wave + ' CLEAR', '+' + bonus + ' bonus', '#3dff7c');
        nextWave();
      }
    } else {
      G.betweenT = 0;
    }
    if (G.trauma > 0) G.trauma = Math.max(0, G.trauma - dt * 1.7);
  }

  function update(dt) {
    G.time += dt;
    // Global keys work on every screen.
    if (VP.Input.hit('KeyM')) {
      var muted = VP.Audio.toggleMute();
      VP.Particles.text(640, 120, muted ? 'SOUND OFF' : 'SOUND ON', '#c8d6f5', 16);
    }
    if (G.state === 'title') {
      if (VP.Input.mouse.clicked || VP.Input.hit('Enter') || VP.Input.hit('Space')) startGame();
    } else if (G.state === 'gameover') {
      if (VP.Input.mouse.clicked || VP.Input.hit('KeyR') || VP.Input.hit('Enter')) startGame();
    } else if (G.state === 'playing') {
      if (VP.Input.hit('KeyP') || VP.Input.hit('Escape')) G.paused = !G.paused;
      if (!G.paused) updatePlaying(dt);
    }
    VP.Particles.update(dt);
    VP.Input.postUpdate();
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.bullets.length; i++) {
      var b = G.bullets[i];
      ctx.strokeStyle = 'rgba(64,224,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#dffaff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (G.trauma > 0) {
      var s = G.trauma * G.trauma * 13;
      ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
    }
    VP.Hud.drawWorld(ctx, stars, BOUNDS, G.time, W, H);
    if (G.state === 'title') {
      menuShip.y = 596 + Math.sin(G.time * 1.4) * 8;
      menuShip.angle = -Math.PI / 2 + Math.sin(G.time * 0.7) * 0.14;
      VP.Player.draw(ctx, menuShip, G.time);
      VP.Particles.draw(ctx);
      VP.Hud.drawTitle(ctx, G, G.time);
    } else {
      VP.Pickups.draw(ctx, G.time);
      VP.Enemies.draw(ctx, G.time);
      drawBullets();
      if (G.player.alive) VP.Player.draw(ctx, G.player, G.time);
      VP.Particles.draw(ctx);
      VP.Hud.drawHud(ctx, G);
      VP.Hud.drawBanner(ctx, G);
      if (G.state === 'gameover') VP.Hud.drawGameOver(ctx, G, G.time);
      if (G.paused) VP.Hud.drawPaused(ctx);
    }
    ctx.restore();
  }

  var last = 0;
  function frame(ts) {
    var dt = Math.min(0.033, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    update(dt);
    draw();
    window.requestAnimationFrame(frame);
  }

  VP.Input.init(canvas);
  window.requestAnimationFrame(frame);

  // A small read-only handle so screenshot tooling (and curious players in
  // the console) can see the run state. It cannot change the game.
  window.VOIDPULSE = {
    info: function () {
      return {
        state: G.state, paused: G.paused, wave: G.wave, score: G.score,
        hp: Math.ceil(G.player.hp), alive: G.player.alive,
        px: Math.round(G.player.x), py: Math.round(G.player.y),
        hostiles: G.hostilesLeft, kills: G.kills
      };
    },
    enemyPositions: function () {
      var out = [];
      for (var i = 0; i < VP.Enemies.count(); i++) {
        var e = VP.Enemies.at(i);
        out.push({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), warp: e.warp > 0 });
      }
      return out;
    }
  };
})();
