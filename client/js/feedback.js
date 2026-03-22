const feedback = {
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    audioUnlocked: false,
    audioContext: null,

    init() {
        this.enabled = true;
        this.bindUnlock();
    },

    bindUnlock() {
        if (this._unlockBound) return;
        this._unlockBound = true;

        const unlock = () => {
            this.ensureAudioContext();
            this.audioUnlocked = true;
        };

        window.addEventListener("pointerdown", unlock, { passive: true, once: true });
        window.addEventListener("touchstart", unlock, { passive: true, once: true });
        window.addEventListener("keydown", unlock, { passive: true, once: true });
    },

    ensureAudioContext() {
        if (this.audioContext) {
            if (this.audioContext.state === "suspended") {
                this.audioContext.resume().catch(() => {});
            }
            return this.audioContext;
        }

        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            return null;
        }

        try {
            this.audioContext = new Ctx();

            if (this.audioContext.state === "suspended") {
                this.audioContext.resume().catch(() => {});
            }

            return this.audioContext;
        } catch (e) {
            return null;
        }
    },

    beep(freq, durationMs, volume) {
        if (!this.enabled || !this.soundEnabled) return;

        const ctx = this.ensureAudioContext();
        if (!ctx) return;

        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
        } catch (e) {}
    },

    playSend() {
        this.beep(880, 70, 0.03);
        this.vibrate(35);
    },

    playReceive() {
        this.beep(640, 110, 0.04);
        this.vibrate(60);
    },

    vibrate(ms) {
    if (!this.enabled || !this.vibrationEnabled) return;

    try {
        // ANDROID BRIDGE
        if (window.AndroidBridge && typeof AndroidBridge.triggerVibration === "function") {
            try {
    AndroidBridge.triggerVibration();
} catch (e) {}
        }

        // FORCE fallback (работи и в WebView)
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    } catch (e) {}
}
};