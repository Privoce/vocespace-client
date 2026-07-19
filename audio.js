/*
 * VoiceLevel — tiny wrapper around Web Audio that exposes a single
 * smoothed 0..1 "speaking level". Also supports a simulated mode so the
 * demo works without granting mic access.
 */
const VoiceLevel = (() => {
  let ctx = null;
  let analyser = null;
  let data = null;
  let micOn = false;
  let simOn = false;
  let smooth = 0;
  let simPhase = 0;

  async function enableMic() {
    if (micOn) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      data = new Uint8Array(analyser.frequencyBinCount);
      micOn = true;
      simOn = false;
      return true;
    } catch (err) {
      console.warn('Mic unavailable:', err);
      return false;
    }
  }

  function toggleSim() {
    simOn = !simOn;
    return simOn;
  }

  /* Call once per frame. Returns smoothed 0..1 level. */
  function level() {
    let raw = 0;

    if (micOn && analyser) {
      analyser.getByteFrequencyData(data);
      // Focus on voice band (~85Hz–3kHz): skip the lowest bins, ignore hiss.
      let sum = 0, n = 0;
      for (let i = 2; i < data.length * 0.5; i++) { sum += data[i]; n++; }
      raw = Math.min(1, (sum / n) / 90);
    } else if (simOn) {
      // Talking-like envelope: bursts of syllables with pauses.
      simPhase += 0.016;
      const sentence = (Math.sin(simPhase * 0.7) + 1) * 0.5; // slow on/off
      const talking = sentence > 0.35;
      if (talking) {
        const syllable = Math.abs(Math.sin(simPhase * 7.3)) * Math.abs(Math.sin(simPhase * 3.1));
        raw = 0.25 + syllable * 0.75;
      }
    }

    smooth += (raw - smooth) * (raw > smooth ? 0.35 : 0.12);
    return smooth;
  }

  return {
    enableMic,
    toggleSim,
    level,
    get micOn() { return micOn; },
    get simOn() { return simOn; },
  };
})();
