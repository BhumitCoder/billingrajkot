/**
 * Compress image to be under target size while maintaining readability
 * @param base64Image - Original base64 image
 * @param maxSizeKB - Maximum size in KB (default 900KB to stay under 1MB)
 * @param initialQuality - Starting quality (default 0.8)
 * @returns Compressed base64 image
 */
export async function compressImageToSize(
  base64Image: string,
  maxSizeKB: number = 900,
  initialQuality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Calculate optimal dimensions (max 1920x1920 for bills)
      let width = img.width;
      let height = img.height;
      const maxDimension = 1920;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with better quality settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under size limit
      let quality = initialQuality;
      let compressedBase64 = "";
      let attempts = 0;
      const maxAttempts = 10;

      const tryCompress = () => {
        compressedBase64 = canvas.toDataURL("image/jpeg", quality);

        // Calculate size in KB
        const sizeKB = (compressedBase64.length * 3) / 4 / 1024;

        console.log(
          `Compression attempt ${attempts + 1}: ${sizeKB.toFixed(
            2
          )} KB at quality ${quality.toFixed(2)}`
        );

        if (sizeKB <= maxSizeKB || attempts >= maxAttempts || quality <= 0.1) {
          console.log(`Final size: ${sizeKB.toFixed(2)} KB`);
          resolve(compressedBase64);
        } else {
          // Reduce quality and try again
          quality -= 0.1;
          attempts++;
          tryCompress();
        }
      };

      tryCompress();
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = base64Image;
  });
}

/**
 * Get file size in KB from base64 string
 */
export function getBase64SizeKB(base64: string): number {
  return (base64.length * 3) / 4 / 1024;
}

/**
 * Compress image file before converting to base64
 */
export async function compressFile(
  file: File,
  maxSizeKB: number = 900
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const base64 = e.target?.result as string;

      try {
        // Check if already under size
        const sizeKB = getBase64SizeKB(base64);
        console.log(`Original image size: ${sizeKB.toFixed(2)} KB`);

        if (sizeKB <= maxSizeKB) {
          console.log("Image already under size limit");
          resolve(base64);
        } else {
          // Compress
          const compressed = await compressImageToSize(base64, maxSizeKB);
          const compressedSizeKB = getBase64SizeKB(compressed);
          console.log(
            `Compressed to: ${compressedSizeKB.toFixed(2)} KB (${(
              (1 - compressedSizeKB / sizeKB) *
              100
            ).toFixed(1)}% reduction)`
          );
          resolve(compressed);
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}
