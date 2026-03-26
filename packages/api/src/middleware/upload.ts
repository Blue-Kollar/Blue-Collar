import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { AppError } from '../utils/AppError.js'
import type { Request } from 'express'

// Get configuration from environment variables with sensible defaults
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'storage/uploads'
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default

// Ensure upload directory exists
const uploadPath = path.resolve(UPLOAD_DIR)
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true })
}

/**
 * Configure multer disk storage
 */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadPath)
    },
    filename: (_req, file, cb) => {
        // Generate unique filename: timestamp-randomstring.ext
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        const ext = path.extname(file.originalname)
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
    },
})

/**
 * File filter to validate image types
 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept only image files
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, GIF)', 400))
    }
}

/**
 * Multer upload middleware configured for image uploads
 */
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
})

/**
 * Error handler for multer errors
 */
export const handleMulterError = (err: any, _req: Request, _res: any, next: any) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`, 400))
        }
        return next(new AppError(err.message, 400))
    }
    next(err)
}
