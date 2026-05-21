class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.createNoiseBuffer();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser.", e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.muted && this.ctx.state === 'running') {
      this.ctx.suspend();
    } else if (this.ctx && !this.muted && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.muted;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume();
    }
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  // SNIPER FIRE: High velocity laser sweeping frequency
  playLaser() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // AOE EXPLOSION: Low-pass filtered noise blast
  playExplosion() {
    this.init();
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    this.resume();

    const now = this.ctx.currentTime;
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    filter.Q.setValueAtTime(8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start(now);
    noiseNode.stop(now + 0.46);
  }

  // BARRIER SHIELD CRACK: High frequency glass distortion
  playShieldBreak() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.linearRampToValueAtTime(300, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.42);
    osc2.stop(now + 0.42);
  }

  // ALIEN SYNTHESIS: Tech mutation sound
  playSynthesis() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);

    filter.type = 'peaking';
    filter.Q.setValueAtTime(10, now);
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  // UNIT LEVEL-UP: Ascending synth arpeggio
  playUpgrade() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C E G C E arpeggio
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.08, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.16);
    });
  }

  // EMP MANUAL BURST: Deep electronic drone & pitch fall
  playEMP() {
    this.init();
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = this.noiseBuffer;

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(filter);
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    noiseNode.start(now);
    osc.stop(now + 0.9);
    noiseNode.stop(now + 0.9);
  }

  // OVERCHARGE MANUAL: Ascending pitch warning loop
  playOvercharge() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.5);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(300, now);
    osc2.frequency.linearRampToValueAtTime(900, now + 0.5);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  // CRITICAL HP BASE ALARM: High-low pulse warning
  playAlarm() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.25);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  // RECALL: Warp sound effect
  playRecall() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // HARVEST: Electronic click with noise tail
  playHarvest() {
    this.init();
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = this.noiseBuffer;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    noiseNode.start(now);
    osc.stop(now + 0.15);
    noiseNode.stop(now + 0.15);
  }
}

// Global Sound Instance
const Sound = new SoundEngine();
