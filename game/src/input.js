// VOIDPULSE input: keyboard state with edge detection, plus mouse aim and buttons.
// Everything the game reads each frame comes through here, so the rest of the
// code never touches DOM events directly.
window.VP = window.VP || {};

VP.Input = (function () {
  var keys = {};       // code -> true while held
  var pressed = {};    // code -> true only on the frame it went down
  var mouse = { x: 640, y: 300, down: false, clicked: false };
  var canvas = null;

  function toGameCoords(evt) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = (evt.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (evt.clientY - rect.top) * (canvas.height / rect.height);
  }

  function init(target) {
    canvas = target;
    window.addEventListener('keydown', function (evt) {
      if (!keys[evt.code]) pressed[evt.code] = true;
      keys[evt.code] = true;
      if (evt.code === 'Space' || evt.code.indexOf('Arrow') === 0) evt.preventDefault();
    });
    window.addEventListener('keyup', function (evt) { keys[evt.code] = false; });
    window.addEventListener('blur', function () { keys = {}; mouse.down = false; });
    canvas.addEventListener('mousemove', toGameCoords);
    canvas.addEventListener('mousedown', function (evt) {
      toGameCoords(evt);
      mouse.down = true;
      mouse.clicked = true;
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    canvas.addEventListener('contextmenu', function (evt) { evt.preventDefault(); });
  }

  // Movement axis from WASD or the arrow keys, normalised so diagonals are fair.
  function axis() {
    var x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x: x, y: y };
  }

  function held(code) { return !!keys[code]; }
  function hit(code) { return !!pressed[code]; }

  // Called once at the end of each frame: edge flags live for exactly one frame.
  function postUpdate() {
    pressed = {};
    mouse.clicked = false;
  }

  return { init: init, axis: axis, held: held, hit: hit, mouse: mouse, postUpdate: postUpdate };
})();
