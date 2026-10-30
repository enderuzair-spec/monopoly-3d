// Web Audio API Realistic Synthesized Sound Effects for Monopoly Online
// Completely self-contained - zero external audio asset dependencies!

class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGainNode = null;
    this.sfxGainNode = null;
    this.ambianceGainNode = null;
    this.ambianceSource = null;
    this.windSource = null;
    this.ambianceRunning = false;
    this.ambianceEnabled = true;
    this.masterVolume = 0.8;
    this.sfxVolume = 0.8;
    this.ambianceVolume = 0.28;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // 1. Master Output Bus -> Destination (Speakers)
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        // 2. SFX Sub-Bus -> Master Bus
        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);

        // 3. Ambient Tavern & Candle Hearth Sub-Bus -> Master Bus
        this.ambianceGainNode = this.ctx.createGain();
        this.ambianceGainNode.gain.setValueAtTime(this.ambianceVolume, this.ctx.currentTime);
        this.ambianceGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGainNode && this.ctx && !this.isMuted) {
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setAmbianceVolume(val) {
    this.ambianceVolume = Math.max(0, Math.min(1, val));
    if (this.ambianceGainNode && this.ctx) {
      this.ambianceGainNode.gain.setValueAtTime(this.ambianceVolume, this.ctx.currentTime);
    }
  }

  toggleMute(mute) {
    this.isMuted = (mute !== undefined) ? !!mute : !this.isMuted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Synthesize realistic warm tavern hearth rumble, candle flame embers & saloon draught
  startAmbiance() {
    this.init();
    if (!this.ctx || this.ambianceRunning || !this.ambianceEnabled) return;
    this.ambianceRunning = true;

    try {
      // 1. Warm Hearth & Candle Drone (Brownian low-frequency room tone)
      const bufferSize = this.ctx.sampleRate * 2.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 2.6; // Cozy warm presence
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // Filter to deep warm hearth frequencies (50Hz to 180Hz)
      const hearthFilter = this.ctx.createBiquadFilter();
      hearthFilter.type = "lowpass";
      hearthFilter.frequency.setValueAtTime(170, this.ctx.currentTime);

      const hearthGain = this.ctx.createGain();
      hearthGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      // Subtle breathing hearth LFO (0.05Hz)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.05, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(hearthGain.gain);
      lfo.start();
      this.ambianceLfo = lfo;

      noiseSource.connect(hearthFilter);
      hearthFilter.connect(hearthGain);
      hearthGain.connect(this.ambianceGainNode);
      noiseSource.start();
      this.ambianceSource = noiseSource;

      // 2. Gentle Tavern Window Breeze Draught (Bandpass filtered whisper)
      const windBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const windOut = windBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        windOut[i] = (Math.random() * 2 - 1) * 0.15;
      }
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = windBuffer;
      windSource.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const windGain = this.ctx.createGain();
      windGain.gain.setValueAtTime(0.045, this.ctx.currentTime);

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.ambianceGainNode);
      windSource.start();
      this.windSource = windSource;

      // 3. Realistic Randomized Candle Flame & Hearth Crackles (Organic micro-snaps)
      const triggerCrackle = () => {
        if (!this.ambianceRunning || !this.ctx || this.isMuted) return;

        const popTime = this.ctx.currentTime;
        const isDouble = Math.random() < 0.28;

        const makeEmberPop = (timeOffset) => {
          const t = popTime + timeOffset;

          // A. Micro-noise crackle burst
          const burstLen = Math.floor(this.ctx.sampleRate * 0.006);
          const bBuf = this.ctx.createBuffer(1, burstLen, this.ctx.sampleRate);
          const bData = bBuf.getChannelData(0);
          for (let i = 0; i < burstLen; i++) {
            bData[i] = (Math.random() * 2 - 1) * (1 - i / burstLen);
          }
          const bSrc = this.ctx.createBufferSource();
          bSrc.buffer = bBuf;

          const bFilt = this.ctx.createBiquadFilter();
          bFilt.type = "bandpass";
          bFilt.frequency.setValueAtTime(2600 + Math.random() * 1800, t);
          bFilt.Q.setValueAtTime(3.0, t);

          const bGain = this.ctx.createGain();
          const burstVol = 0.035 + Math.random() * 0.045;
          bGain.gain.setValueAtTime(burstVol, t);
          bGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);

          bSrc.connect(bFilt);
          bFilt.connect(bGain);
          bGain.connect(this.ambianceGainNode);
          bSrc.start(t);

          // B. Warm wood/wick pop body
          const osc = this.ctx.createOscillator();
          const pGain = this.ctx.createGain();
          osc.type = "sine";
          const startF = 850 + Math.random() * 550;
          osc.frequency.setValueAtTime(startF, t);
          osc.frequency.exponentialRampToValueAtTime(140, t + 0.009);

          pGain.gain.setValueAtTime(burstVol * 0.65, t);
          pGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.010);

          osc.connect(pGain);
          pGain.connect(this.ambianceGainNode);
          osc.start(t);
          osc.stop(t + 0.012);
        };

        makeEmberPop(0);
        if (isDouble) {
          makeEmberPop(0.018 + Math.random() * 0.025);
        }

        // Schedule next organic crackle with natural jitter
        const nextDelay = 180 + Math.random() * 380;
        this.crackleTimer = setTimeout(triggerCrackle, nextDelay);
      };

      this.crackleTimer = setTimeout(triggerCrackle, 300);

    } catch (err) {
      console.warn("Could not start ambient hearth audio:", err);
    }
  }

  stopAmbiance() {
    this.ambianceRunning = false;
    if (this.crackleTimer) {
      clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (this.ambianceSource) {
      try { this.ambianceSource.stop(); } catch (e) {}
      this.ambianceSource = null;
    }
    if (this.windSource) {
      try { this.windSource.stop(); } catch (e) {}
      this.windSource = null;
    }
    if (this.ambianceLfo) {
      try { this.ambianceLfo.stop(); } catch (e) {}
      this.ambianceLfo = null;
    }
  }

  toggleAmbiance(enabled) {
    this.ambianceEnabled = !!enabled;
    if (this.ambianceEnabled) {
      this.startAmbiance();
    } else {
      this.stopAmbiance();
    }
  }

  // Synchronized individual dice bounce impacts against felt table
  playDiceImpact(index = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const gainVal = index === 1 ? 0.32 : index === 2 ? 0.20 : 0.12;
    const freq = index === 1 ? 340 : index === 2 ? 420 : 280;
    const decay = index === 1 ? 0.055 : index === 2 ? 0.040 : 0.030;

    // 1. Resonant wooden body impact
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 30, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + decay);

    oscGain.gain.setValueAtTime(gainVal, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(oscGain);
    oscGain.connect((this.sfxGainNode || this.ctx.destination));
    osc.start(t);
    osc.stop(t + decay + 0.01);

    // 2. Sharp felt/bone impact click transient
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "sine";
    snapOsc.frequency.setValueAtTime(1600 + Math.random() * 400, t);
    snapGain.gain.setValueAtTime(gainVal * 0.55, t);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);

    snapOsc.connect(snapGain);
    snapGain.connect((this.sfxGainNode || this.ctx.destination));
    snapOsc.start(t);
    snapOsc.stop(t + 0.016);
  }

  // Realistic wooden dice tumbling & rattling against felt
  playDice() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Multi-stage rhythmic dice clatter (initial toss, rapid roll, settles into rest)
    const clicks = [
      { delay: 0.00, freq: 360, gain: 0.28, decay: 0.045 },
      { delay: 0.03, freq: 520, gain: 0.24, decay: 0.035 },
      { delay: 0.08, freq: 280, gain: 0.32, decay: 0.050 },
      { delay: 0.14, freq: 440, gain: 0.22, decay: 0.040 },
      { delay: 0.21, freq: 320, gain: 0.18, decay: 0.038 },
      { delay: 0.28, freq: 260, gain: 0.14, decay: 0.040 },
      { delay: 0.36, freq: 380, gain: 0.10, decay: 0.035 },
      { delay: 0.44, freq: 240, gain: 0.07, decay: 0.030 }
    ];

    clicks.forEach(c => {
      const hitTime = t + c.delay;

      // 1. Resonant wooden body tone
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(c.freq + (Math.random() - 0.5) * 40, hitTime);
      osc.frequency.exponentialRampToValueAtTime(c.freq * 0.7, hitTime + c.decay);

      oscGain.gain.setValueAtTime(c.gain, hitTime);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + c.decay);

      osc.connect(oscGain);
      oscGain.connect((this.sfxGainNode || this.ctx.destination));
      osc.start(hitTime);
      osc.stop(hitTime + c.decay + 0.01);

      // 2. High-frequency felt/bone click transient
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snapOsc.type = "sine";
      snapOsc.frequency.setValueAtTime(1400 + Math.random() * 400, hitTime);
      snapGain.gain.setValueAtTime(c.gain * 0.5, hitTime);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.012);

      snapOsc.connect(snapGain);
      snapGain.connect((this.sfxGainNode || this.ctx.destination));
      snapOsc.start(hitTime);
      snapOsc.stop(hitTime + 0.015);
    });
  }

  // Realistic wooden board token landing thud & clack
  playStep() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Solid wooden impact body resonance
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320 + Math.random() * 30, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.055);

    oscGain.gain.setValueAtTime(0.24, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    osc.connect(oscGain);
    oscGain.connect((this.sfxGainNode || this.ctx.destination));
    osc.start(t);
    osc.stop(t + 0.06);

    // 2. Sharp contact clack
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(1800 + Math.random() * 200, t);
    clickGain.gain.setValueAtTime(0.12, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

    clickOsc.connect(clickGain);
    clickGain.connect((this.sfxGainNode || this.ctx.destination));
    clickOsc.start(t);
    clickOsc.stop(t + 0.015);
  }

  playCash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc2.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect((this.sfxGainNode || this.ctx.destination));

    osc1.start();
    osc2.start(this.ctx.currentTime + 0.08);
    osc1.stop(this.ctx.currentTime + 0.35);
    osc2.stop(this.ctx.currentTime + 0.35);
  }

  playRent() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Descending coin clink followed by cash register ding
    [587.33, 523.25, 440.0, 392.0].forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect((this.sfxGainNode || this.ctx.destination));
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      }, idx * 70);
    });

    setTimeout(() => {
      this.playCash();
    }, 320);
  }

  playBuy() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.08);
    gain1.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc1.connect(gain1);
    gain1.connect((this.sfxGainNode || this.ctx.destination));
    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.08);

    setTimeout(() => {
      this.playCash();
    }, 100);
  }

  playJail() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect((this.sfxGainNode || this.ctx.destination));
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  // Realistic Card Draw Sound for Chance & Community Chest cards
  // Features physical cardstock deck slide friction, crisp card flick/snap release, and fortune reveal chime!
  playCard(cardType = "chance") {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const isChance = (cardType === "chance" || cardType === "Chance");

    // 1. Physical Cardstock Sweep / Slide Friction (0.00s - 0.11s)
    const sweepDuration = 0.11;
    const bufferSize = Math.floor(this.ctx.sampleRate * sweepDuration);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.42;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(3200, t);
    bandpass.frequency.exponentialRampToValueAtTime(1750, t + sweepDuration);
    bandpass.Q.setValueAtTime(2.2, t);

    const sweepGain = this.ctx.createGain();
    sweepGain.gain.setValueAtTime(0.001, t);
    sweepGain.gain.linearRampToValueAtTime(0.24, t + 0.025);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t + sweepDuration);

    noiseSource.connect(bandpass);
    bandpass.connect(sweepGain);
    sweepGain.connect(this.sfxGainNode || this.ctx.destination);
    noiseSource.start(t);

    // 2. Tactile Card Flick / Table Snap (at t + 0.075s)
    const snapTime = t + 0.075;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "sine";
    snapOsc.frequency.setValueAtTime(1350, snapTime);
    snapOsc.frequency.exponentialRampToValueAtTime(320, snapTime + 0.022);

    snapGain.gain.setValueAtTime(0.26, snapTime);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, snapTime + 0.025);

    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGainNode || this.ctx.destination);
    snapOsc.start(snapTime);
    snapOsc.stop(snapTime + 0.028);

    // 3. Melodic Fortune / Destiny Reveal Chimes
    // Chance: Curious, thrilling ascending pentatonic sparkle (E5, G#5, B5, E6)
    // Community: Warm, generous civic chime (D5, A5, D6)
    const chimes = isChance
      ? [
          { note: 659.25, time: 0.09, dur: 0.28, vol: 0.14 }, // E5
          { note: 830.61, time: 0.14, dur: 0.30, vol: 0.16 }, // G#5
          { note: 987.77, time: 0.19, dur: 0.35, vol: 0.18 }, // B5
          { note: 1318.51, time: 0.25, dur: 0.45, vol: 0.20 }  // E6
        ]
      : [
          { note: 587.33, time: 0.09, dur: 0.32, vol: 0.16 }, // D5
          { note: 880.00, time: 0.16, dur: 0.36, vol: 0.18 }, // A5
          { note: 1174.66, time: 0.24, dur: 0.45, vol: 0.20 }  // D6
        ];

    chimes.forEach(({ note, time, dur, vol }) => {
      const bellTime = t + time;
      const osc = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note, bellTime);

      bellGain.gain.setValueAtTime(vol, bellTime);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, bellTime + dur);

      osc.connect(bellGain);
      bellGain.connect(this.sfxGainNode || this.ctx.destination);
      osc.start(bellTime);
      osc.stop(bellTime + dur + 0.02);
    });
  }

  playSave() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Magical crystal chime
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect((this.sfxGainNode || this.ctx.destination));
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
      }, idx * 70);
    });
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect((this.sfxGainNode || this.ctx.destination));
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      }, idx * 120);
    });
  }
}

window.sounds = new SoundController();
