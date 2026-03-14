async function readArrayBuffer(file) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function () {
            resolve(reader.result);
        };

        reader.onerror = function () {
            reject(new Error("File read failed"));
        };

        reader.readAsArrayBuffer(file);
    });
}

function getExifOrientationFromBuffer(buffer) {
    try {
        const view = new DataView(buffer);

        if (view.getUint16(0, false) !== 0xFFD8) {
            return 1;
        }

        let offset = 2;
        const length = view.byteLength;

        while (offset < length) {
            const marker = view.getUint16(offset, false);
            offset += 2;

            if (marker === 0xFFE1) {
                const app1Length = view.getUint16(offset, false);
                offset += 2;

                if (view.getUint32(offset, false) !== 0x45786966) {
                    break;
                }

                offset += 6;

                const little = view.getUint16(offset, false) === 0x4949;
                const firstIfdOffset = view.getUint32(offset + 4, little);
                let ifdOffset = offset + firstIfdOffset;
                const entries = view.getUint16(ifdOffset, little);
                ifdOffset += 2;

                for (let i = 0; i < entries; i++) {
                    const entryOffset = ifdOffset + (i * 12);
                    const tag = view.getUint16(entryOffset, little);

                    if (tag === 0x0112) {
                        return view.getUint16(entryOffset + 8, little) || 1;
                    }
                }

                break;
            }

            if ((marker & 0xFF00) !== 0xFF00) {
                break;
            }

            offset += view.getUint16(offset, false);
        }
    } catch (error) {
        console.warn("getExifOrientationFromBuffer fallback", error);
    }

    return 1;
}

function getOutputDimensionsForOrientation(width, height, orientation) {
    if (orientation >= 5 && orientation <= 8) {
        return {
            width: height,
            height: width
        };
    }

    return { width, height };
}

function drawImageWithOrientation(ctx, img, width, height, orientation) {
    switch (orientation) {
        case 2:
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            break;
        case 3:
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
            break;
        case 4:
            ctx.translate(0, height);
            ctx.scale(1, -1);
            break;
        case 5:
            ctx.rotate(0.5 * Math.PI);
            ctx.scale(1, -1);
            break;
        case 6:
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(0, -height);
            break;
        case 7:
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(width, -height);
            ctx.scale(-1, 1);
            break;
        case 8:
            ctx.rotate(-0.5 * Math.PI);
            ctx.translate(-width, 0);
            break;
        default:
            break;
    }

    ctx.drawImage(img, 0, 0, width, height);
}

async function loadImageElementFromFile(file) {
    return await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error("Image load failed"));
        };

        img.src = url;
    });
}

function calculateImageResize(width, height, maxSide) {
    if (!width || !height || !maxSide) {
        return { width, height };
    }

    const largest = Math.max(width, height);
    if (largest <= maxSide) {
        return { width, height };
    }

    const scale = maxSide / largest;

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

async function compressImageFile(file, options) {
    const opts = options || {};
    const maxSide = Number(opts.maxSide || 1600);
    const quality = typeof opts.quality === "number" ? opts.quality : 0.82;

    if (!file || !String(file.type || "").startsWith("image/")) {
        return file;
    }

    try {
        const [img, buffer] = await Promise.all([
            loadImageElementFromFile(file),
            readArrayBuffer(file)
        ]);

        const orientation = getExifOrientationFromBuffer(buffer);
        const resized = calculateImageResize(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            maxSide
        );

        const orientedSize = getOutputDimensionsForOrientation(
            resized.width,
            resized.height,
            orientation
        );

        const canvas = document.createElement("canvas");
        canvas.width = orientedSize.width;
        canvas.height = orientedSize.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return file;
        }

        drawImageWithOrientation(ctx, img, resized.width, resized.height, orientation);

        const originalType = String(file.type || "").toLowerCase();
        const outputType = (originalType === "image/jpeg" || originalType === "image/webp")
            ? originalType
            : "image/jpeg";

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, outputType, quality);
        });

        if (!blob) {
            return file;
        }

        const ext = outputType === "image/webp" ? ".webp" : ".jpg";
        const originalName = String(file.name || "camera-image");
        const baseName = originalName.replace(/\.[^/.]+$/, "") || "camera-image";
        const newFile = new File([blob], baseName + ext, {
            type: outputType,
            lastModified: Date.now()
        });

        if (
            orientation === 1 &&
            newFile.size >= file.size &&
            Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height) <= maxSide
        ) {
            return file;
        }

        return newFile;
    } catch (error) {
        console.warn("compressImageFile fallback", error);
        return file;
    }
}
