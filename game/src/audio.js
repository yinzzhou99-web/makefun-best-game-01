// VOIDPULSE audio: every sound is synthesised with WebAudio oscillators and
// noise buffers. No audio files, nothing loads over the network. The context
// is created lazily on the first user gesture, as browsers require.
window.VP = window.VP || {};

VP.Audio = (function () {
  var ctx = null;
  var master = null;
  var muted = false;
  var musicTimer = null;
  var musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  // One short oscillator blip with an exponential decay envelope.
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise burst for explosions and impacts.
  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var len = Math.max(1, (dur * ctx.sampleRate) | 0);
    var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 900;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  function shoot() { tone(720 + Math.random() * 120, 0.08, 'square', 0.05, 240); }
  function hit() { tone(200, 0.05, 'sawtooth', 0.06, 120); }
  function explode(big) {
    noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 500 : 800);
    tone(big ? 90 : 130, big ? 0.45 : 0.3, 'sine', 0.4, 40);
  }
  function hurt() { tone(160, 0.22, 'sawtooth', 0.3, 60); noise(0.15, 0.2, 1200); }
  function pickup() { tone(520, 0.09, 'sine', 0.22); setTimeout(function () { tone(780, 0.12, 'sine', 0.22); }, 55); }
  function waveHorn() { tone(196, 0.3, 'sawtooth', 0.16); tone(294, 0.34, 'sawtooth', 0.14); }
  function dash() { noise(0.12, 0.12, 2400); }
  function gameOver() {
    tone(392, 0.25, 'triangle', 0.25);
    setTimeout(function () { tone(311, 0.25, 'triangle', 0.25); }, 180);
    setTimeout(function () { tone(233, 0.6, 'triangle', 0.28); }, 360);
  }
  function uiStart() { tone(440, 0.1, 'sine', 0.2); setTimeout(function () { tone(660, 0.16, 'sine', 0.2); }, 70); }

  // A slow pulsing bass line under the action, two bars of A minor menace.
  var BASS = [55, 0, 55, 55, 0, 65.4, 0, 55, 0, 55, 55, 0, 82.4, 0, 73.4, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicStep = 0;
    musicTimer = setInterval(function () {
      if (muted) { musicStep++; return; }
      var f = BASS[musicStep % BASS.length];
      if (f) tone(f, 0.22, 'triangle', 0.16);
      if (musicStep % 8 === 4) tone(1100, 0.03, 'square', 0.02);
      musicStep++;
    }, 190);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    ensure: ensure, shoot: shoot, hit: hit, explode: explode, hurt: hurt,
    pickup: pickup, waveHorn: waveHorn, dash: dash, gameOver: gameOver,
    uiStart: uiStart, startMusic: startMusic, stopMusic: stopMusic,
    toggleMute: toggleMute,
    isMuted: function () { return muted; }
  };
})();
