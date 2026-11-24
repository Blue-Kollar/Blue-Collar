import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

export interface ProcessedImages {
  thumb: string   // 64×64
  medium: string  // 256×256
  full: string    // 800×800
}

/**
 * Process uploaded image: generate thumb (64×64), medium (256×256), and full (800×800)
 * WebP variants. Returns paths to all three files.
 */
export async function processImage(inputPath: string): Promise<ProcessedImages> {
  const { dir, name } = path.parse(inputPath)

  const thumbPath  = path.join(dir, `${name}-thumb.webp`)
  const mediumPath = path.join(dir, `${name}-medium.webp`)
  const fullPath   = path.join(dir, `${name}.webp`)

  const generated: string[] = []

  try {
    const sizes: Array<{ size: number; out: string }> = [
      { size: 64,  out: thumbPath  },
      { size: 256, out: mediumPath },
      { size: 800, out: fullPath   },
    ]

    for (const { size, out } of sizes) {
      await sharp(inputPath)
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(out)
      generated.push(out)
    }

    // Remove original upload after all variants are written
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)

    return { thumb: thumbPath, medium: mediumPath, full: fullPath }
  } catch (error) {
    // Clean up any partially-written files
    for (const f of generated) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
    throw error
  }
}

/**
 * Delete all image size variants for a given base path.
 * Accepts either the full-size path (e.g. `foo.webp`) or any variant path.
 */
export function deleteImages(basePath: string): void {
  const { dir, name: rawName } = path.parse(basePath)
  // Strip any size suffix so we always derive the base name
  const base = rawName.replace(/-(thumb|medium)$/, '')

  for (const suffix of ['', '-thumb', '-medium']) {
    const p = path.join(dir, `${base}${suffix}.webp`)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

/**
 * Delete a single image file from the filesystem (legacy helper).
 */
export function deleteImage(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
