const feedback = {
    enabled: true,
    sounds: {},

    init() {
        this.enabled = loadSoundSetting(state.user && state.user.id);

        this.sounds.send = this.createSound(880, 0.05);
        this.sounds.receive = this.createSound(660, 0.08);
    },

createSound(freq, duration) {
    return function () {
        if (!feedback.enabled) return;

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();

            // FIX: unlock audio
            if (ctx.state === "suspended") {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = freq;

            gain.gain.value = 0.06;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();

            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, duration * 1000);
        } catch (e) {}
    };
},

    playSend() {
        this.sounds.send && this.sounds.send();
        this.vibrate(30);
    },

    playReceive() {
        this.sounds.receive && this.sounds.receive();
        this.vibrate(50);
    },

    vibrate(ms) {
        if (!this.enabled) return;

        if (window.AndroidBridge && AndroidBridge.triggerVibration) {
            AndroidBridge.triggerVibration();
        } else if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }
};