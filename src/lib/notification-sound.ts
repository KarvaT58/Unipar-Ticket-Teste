const NOTIFICATION_SOUND_PATH = "/sounds/notification.mp3"

export function playNotificationSound(): void {
  if (typeof window === "undefined") return
  try {
    const audio = new Audio(NOTIFICATION_SOUND_PATH)
    audio.volume = 0.5
    audio.play().catch(() => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 800
        gain.gain.value = 0.15
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
}
