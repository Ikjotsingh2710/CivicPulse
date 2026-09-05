/**
 * Cheap, on-device quality checks run before a photo is uploaded.
 *
 * The point is to stop obvious junk — a covered lens, a blank wall, a shot so
 * blurred nothing in it is identifiable — from ever leaving the phone. It runs
 * on a canvas in a few milliseconds, costs nothing, and needs no network.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not try to work out what the photo is *of*. Judging subject matter
 * needs a model, and every cheap proxy for "is this a person" is either useless
 * or discriminatory. Subject matter is the ward desk's job, and rejecting a
 * report now deletes its photo — that is the layer that handles it.
 *
 * AND IT WARNS RATHER THAN BLOCKS
 * "Broken Streetlight" reports are, by their nature, photographs of darkness.
 * A rule strict enough to block a black frame would block the category hardest
 * to photograph, so the citizen is told what looks wrong and decides.
 */

export interface ImageVerdict {
  /** False only when the frame is so poor it cannot show anything at all. */
  usable: boolean;
  /** Set when something looks wrong; shown to the citizen as a caution. */
  warning: string | null;
  /** 0-255 mean brightness. */
  brightness: number;
  /** Spread of brightness. Near zero means a flat, featureless frame. */
  contrast: number;
  /** Edge energy. Low means out of focus. */
  sharpness: number;
}

/** Downsampled analysis size — enough signal, negligible cost. */
const SAMPLE = 128;

export async function inspectImage(blob: Blob): Promise<ImageVerdict> {
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return pass();

  ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
  bitmap.close?.();

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // A tainted canvas cannot be read. Never block a report over it.
    return pass();
  }

  // Luminance per pixel, Rec. 601 weights.
  const grey = new Float32Array(SAMPLE * SAMPLE);
  let sum = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grey[p] = y;
    sum += y;
  }

  const brightness = sum / grey.length;

  let variance = 0;
  for (const y of grey) variance += (y - brightness) ** 2;
  const contrast = Math.sqrt(variance / grey.length);

  // Laplacian edge energy — the standard cheap focus measure.
  let edges = 0;
  for (let y = 1; y < SAMPLE - 1; y++) {
    for (let x = 1; x < SAMPLE - 1; x++) {
      const i = y * SAMPLE + x;
      const lap =
        4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - SAMPLE] - grey[i + SAMPLE];
      edges += lap * lap;
    }
  }
  const sharpness = Math.sqrt(edges / ((SAMPLE - 2) * (SAMPLE - 2)));

  return verdict(brightness, contrast, sharpness);
}

function verdict(brightness: number, contrast: number, sharpness: number): ImageVerdict {
  const base = { brightness, contrast, sharpness };

  // Nothing at all: a covered lens or a capture that failed. Flat and black.
  if (brightness < 12 && contrast < 6) {
    return {
      ...base,
      usable: false,
      warning: 'This photo is almost entirely black — the camera may have been covered.',
    };
  }

  // A flat field of one colour: a wall, a ceiling, the sky.
  if (contrast < 9) {
    return {
      ...base,
      usable: true,
      warning: 'This photo looks like a plain surface. Make sure the problem is in frame.',
    };
  }

  if (sharpness < 3.5) {
    return {
      ...base,
      usable: true,
      warning: 'This photo looks out of focus. The desk may not be able to see the damage.',
    };
  }

  if (brightness < 26) {
    return {
      ...base,
      usable: true,
      warning: 'This photo is very dark. If it is a streetlight at night, that is fine.',
    };
  }

  return { ...base, usable: true, warning: null };
}

function pass(): ImageVerdict {
  return { usable: true, warning: null, brightness: 0, contrast: 0, sharpness: 0 };
}
