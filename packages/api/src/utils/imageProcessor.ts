import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Process uploaded image: resize to max 800x800px and convert to WebP format
 * @param inputPath - Path to the original uploaded file
 * @returns Path to the processed WebP file
 */
export async function processImage(inputPath: string): Promise<string> {
    const parsedPath = path.parse(inputPath)
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`)

    try {
        await sharp(inputPath)
            .resize(800, 800, {
                fit: 'inside', // Maintain aspect ratio, fit within 800x800
                withoutEnlargement: true, // Don't upscale smaller images
            })
            .webp({ quality: 85 }) // Convert to WebP with 85% quality
            .toFile(outputPath)

        // Delete the original file after successful processing
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath)
        }

        return outputPath
    } catch (error) {
        // Clean up on error
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath)
        }
        throw error
    }
}

/**
 * Delete an image file from the filesystem
 * @param filePath - Path to the file to delete
 */
export function deleteImage(filePath: string): void {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
}
