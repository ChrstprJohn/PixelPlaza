const scores = {
  garden: { beat: .65, voice: 'triangle', melody: [72,76,79,76,74,76,72,null,69,72,76,74,67,71,74,79], bass: [48,53,45,55], decay: .7 },
  haunted: { beat: .95, voice: 'sine', melody: [69,null,72,71,64,null,67,null,69,null,68,64,62,null,64,null], bass: [45,40,41,40], decay: 1.8 },
};

export function startLobbyMusic(context, lobbyId, timers = globalThis) {
  const score = scores[lobbyId] || scores.garden;
  const output = context.createGain();
  output.gain.value = .25;
  output.connect(context.destination);
  const voices = new Set();
  let step = 0, next = context.currentTime + .03;
  function note(midi, time, bass = false) {
    if (midi === null) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = bass ? 'sine' : score.voice;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const duration = bass ? score.beat * 3 : score.decay;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(bass ? .045 : .09, time + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(output);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  const schedule = () => {
    if (context.state !== 'running' || globalThis.document?.hidden) { next = context.currentTime + .03; return; }
    next = Math.max(next, context.currentTime + .01);
    while (next < context.currentTime + .15) {
      note(score.melody[step % score.melody.length], next);
      if (step % 4 === 0) note(score.bass[Math.floor(step / 4) % score.bass.length], next, true);
      step++; next += score.beat;
    }
  };
  schedule();
  const timer = timers.setInterval(schedule, 50);
  return () => {
    timers.clearInterval(timer);
    for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    voices.clear(); output.disconnect();
  };
}
