import nodemailer from 'nodemailer'
import { config } from '@/config/config.js'

export const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  auth: {
    user: config.mail.user,
    pass: config.mail.pass,
  },
})
