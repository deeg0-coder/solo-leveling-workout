/* ============================================================
   Audio — synth sfx (WebAudio, no files needed)
============================================================ */
const AudioSys = (() => {
  let ctx = null;
  let muted = false;
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, type = "sine", vol = 0.2, slide = 0) {
    const c = ac();
    if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), c.currentTime + start + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  return {
    init() { ac(); },
    click() { tone2(600, 0.07, "square", 0.06); },
    plus() { tone(520, 0, 0.09, "triangle", 0.15, 260); },
    minus() { tone(340, 0, 0.09, "triangle", 0.12, -120); },
    complete() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16, "triangle", 0.16)); },
    perfect() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.1, 0.2, "triangle", 0.16)); },
    levelup() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, "sine", 0.18)); },
    rankup() { [440, 554, 659, 880, 1109, 1319, 1760].forEach((f, i) => tone(f, i * 0.12, 0.3, "sawtooth", 0.1)); },
    setMuted(m) { muted = !!m; }
  };
})();