import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError.js'
import { uploadFile, getSignedDownloadUrl } from '../services/storage.service.js'
import { processImage } from '../utils/imageProcessor.js'
import { db } from '../db.js'

const UPLOAD_DIR = process.env['UPLOAD_DIR'] ?? 'storage/uploads'
const MAX_FILE_SIZE = Number(process.env['MAX_FILE_SIZE'] ?? 5 * 1024 * 1024) // 5 MB

const uploadPath = path.resolve(UPLOAD_DIR)
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true })

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])

/** Sanitise a filename: strip directory traversal, keep only safe chars, add entropy. */
function sanitiseFilename(original: string): string {
  const ext = path.extname(original).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin'
  const safe = path
    .basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60)
  return `${safe}-${randomBytes(8).toString('hex')}${ext}`
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => cb(null, sanitiseFilename(file.originalname)),
})

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true)
  cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, GIF)', 400))
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } })

export const handleMulterError = (err: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`, 400))
    }
    return next(new AppError(err.message, 400))
  }
  next(err)
}

/**
 * Post-upload middleware: processes image variants, offloads all to S3,
 * persists MediaAsset record, and attaches `req.mediaAsset` for the controller.
 */
export async function processAndStore(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next()

  try {
    const { path: localPath, mimetype, originalname, size } = req.file

    // Generate responsive derivatives (thumb / medium / full)
    const variants = await processImage(localPath)

    const prefix = `media/${Date.now()}`
    const [thumbKey, mediumKey, fullKey] = await Promise.all([
      uploadFile(variants.thumb,  `${prefix}-thumb.webp`,  'image/webp'),
      uploadFile(variants.medium, `${prefix}-medium.webp`, 'image/webp'),
      uploadFile(variants.full,   `${prefix}-full.webp`,   'image/webp'),
    ])

    // Sign URLs (no-op for local paths, pre-signed for S3)
    const [thumbUrl, mediumUrl, fullUrl] = await Promise.all([
      getSignedDownloadUrl(thumbKey),
      getSignedDownloadUrl(mediumKey),
      getSignedDownloadUrl(fullKey),
    ])

    // Persist metadata
    const asset = await db.mediaAsset.create({
      data: {
        originalName: originalname,
        mimeType: mimetype,
        size,
        thumbKey,   thumbUrl,
        mediumKey,  mediumUrl,
        fullKey,    fullUrl,
        uploadedById: req.user?.id,
      },
    })

    ;(req as any).mediaAsset = asset
    next()
  } catch (err) {
    next(err)
  }
}
