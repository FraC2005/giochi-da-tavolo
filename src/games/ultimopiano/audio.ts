/**
 * Atmosfera sonora generata via Web Audio API: nessun file audio esterno da caricare o
 * licenziare. Un drone basso continuo (due oscillatori leggermente stonati, per il battimento
 * innaturale) più scricchiolii casuali e uno "stinger" da suonare quando si trova un indizio
 * importante.
 */
export class HorrorAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneGain: GainNode | null = null
  private creakTimer = 0

  /** Deve essere chiamato da un gesto utente (click): i browser bloccano l'audio altrimenti. */
  start() {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
    this.master = master

    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.18
    droneGain.connect(master)
    this.droneGain = droneGain

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 220
    lowpass.connect(droneGain)

    for (const freq of [55, 55.8]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(lowpass)
      osc.start()
    }

    // leggero LFO sul volume del drone, per non farlo sentire statico
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain)
    lfoGain.connect(droneGain.gain)
    lfo.start()

    this.scheduleCreak()
  }

  private scheduleCreak() {
    const delay = 6000 + Math.random() * 14000
    this.creakTimer = window.setTimeout(() => {
      this.playCreak()
      this.scheduleCreak()
    }, delay)
  }

  private playCreak() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const dur = 0.8 + Math.random() * 1.2
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 180 + Math.random() * 400
    filter.Q.value = 4
    const gain = ctx.createGain()
    gain.gain.value = 0.05 + Math.random() * 0.08
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
  }

  /** Breve suono quando si trova un indizio importante (sblocca il capitolo successivo). */
  playDiscoveryStinger() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(this.master)
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(70, now + 1.6)
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8)
    osc.start(now)
    osc.stop(now + 1.9)
  }

  stop() {
    if (this.creakTimer) window.clearTimeout(this.creakTimer)
    this.ctx?.close()
    this.ctx = null
  }
}
