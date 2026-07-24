const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_BYTES = 500 * 1024;
const JPEG_QUALITIES = [0.78, 0.7, 0.62, 0.54];
const MIN_IMAGE_DIMENSION = 960;

export type ImageOptimizationResult = {
  file: File;
  originalBytes: number;
  optimizedBytes: number;
  originalWidth: number;
  originalHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
  reductionPercentage: number;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`The image ${file.name} could not be read by this browser.`));
    };
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("The browser could not compress this image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function drawImage(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image compression is not available in this browser.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function jpegFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "photo";
  return `${baseName}.jpg`;
}

export async function optimizeImageForUpload(file: File): Promise<ImageOptimizationResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not a supported image.`);
  }

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  if (!originalWidth || !originalHeight) {
    throw new Error(`The dimensions of ${file.name} could not be read.`);
  }

  const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(originalWidth, originalHeight));
  let optimizedWidth = Math.max(1, Math.round(originalWidth * initialScale));
  let optimizedHeight = Math.max(1, Math.round(originalHeight * initialScale));
  let optimizedBlob: Blob | null = null;

  while (true) {
    const canvas = drawImage(image, optimizedWidth, optimizedHeight);

    for (const quality of JPEG_QUALITIES) {
      optimizedBlob = await canvasToJpeg(canvas, quality);
      if (optimizedBlob.size <= TARGET_IMAGE_BYTES) {
        break;
      }
    }

    if (
      (optimizedBlob?.size ?? Number.POSITIVE_INFINITY) <= TARGET_IMAGE_BYTES
      || Math.max(optimizedWidth, optimizedHeight) <= MIN_IMAGE_DIMENSION
    ) {
      break;
    }

    const nextScale = Math.max(0.75, Math.sqrt(TARGET_IMAGE_BYTES / (optimizedBlob?.size ?? TARGET_IMAGE_BYTES)));
    optimizedWidth = Math.max(1, Math.round(optimizedWidth * nextScale));
    optimizedHeight = Math.max(1, Math.round(optimizedHeight * nextScale));
  }

  if (!optimizedBlob || optimizedBlob.size >= file.size) {
    return {
      file,
      originalBytes: file.size,
      optimizedBytes: file.size,
      originalWidth,
      originalHeight,
      optimizedWidth: originalWidth,
      optimizedHeight: originalHeight,
      reductionPercentage: 0,
    };
  }

  const optimizedFile = new File([optimizedBlob], jpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });

  return {
    file: optimizedFile,
    originalBytes: file.size,
    optimizedBytes: optimizedFile.size,
    originalWidth,
    originalHeight,
    optimizedWidth,
    optimizedHeight,
    reductionPercentage: Math.round((1 - optimizedFile.size / file.size) * 100),
  };
}
