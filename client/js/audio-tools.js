function getSupportedAudioMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
        return "";
    }

    const candidates = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm"
    ];

    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    return "";
}

function getAudioFileExtension(mimeType) {
    const type = String(mimeType || "").toLowerCase();

    if (type.includes("mp4")) return ".m4a";
    if (type.includes("ogg")) return ".ogg";
    if (type.includes("webm")) return ".webm";
    return ".webm";
}

async function startVoiceCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Няма достъп до микрофон.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedAudioMimeType();
    const options = mimeType ? { mimeType } : undefined;
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];

    recorder.addEventListener("dataavailable", function (event) {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    });

    recorder.start();

    return {
        stream,
        recorder,
        chunks,
        mimeType: mimeType || recorder.mimeType || "audio/webm"
    };
}

async function stopVoiceCapture(session) {
    if (!session || !session.recorder) {
        return null;
    }

    const recorder = session.recorder;
    const stream = session.stream;
    const chunks = session.chunks || [];
    const mimeType = session.mimeType || recorder.mimeType || "audio/webm";

    return await new Promise((resolve, reject) => {
        recorder.addEventListener("stop", function () {
            try {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }

                const blob = new Blob(chunks, { type: mimeType });
                const ext = getAudioFileExtension(mimeType);
                const file = new File([blob], "voice-message" + ext, {
                    type: mimeType,
                    lastModified: Date.now()
                });

                resolve(file);
            } catch (error) {
                reject(error);
            }
        }, { once: true });

        recorder.addEventListener("error", function (event) {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            reject(event.error || new Error("Voice record failed"));
        }, { once: true });

        try {
            recorder.stop();
        } catch (error) {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            reject(error);
        }
    });
}
