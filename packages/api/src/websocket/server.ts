import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'

import { corsConfig } from '../config/cors.js'
import { logger } from '../config/logger.js'
import { db } from '../db.js'
import { verifyToken } from '../utils/tokenValidator.js'

interface AuthenticatedSocket extends Socket {
  userId?: string
}

export class WebSocketServer {
  private io: SocketIOServer
  private activeConnections = new Map<string, Set<string>>()

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: corsConfig,
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    })
    this.setupMiddleware()
    this.setupEvents()
  }

  private setupMiddleware() {
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('No auth token'))
      }
      try {
        const decoded = verifyToken(token)
        socket.userId = decoded.id
        next()
      } catch {
        next(new Error('Invalid token'))
      }
    })
  }

  private setupEvents() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!
      logger.info({ userId }, 'WebSocket connected')

      if (!this.activeConnections.has(userId)) {
        this.activeConnections.set(userId, new Set())
      }
      this.activeConnections.get(userId)!.add(socket.id)

      // Emit presence
      this.broadcastPresence(userId, 'online')

      // Join user's conversation rooms
      socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conversation:${conversationId}`)
        this.broadcastTyping(conversationId, userId, false)
      })

      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`)
      })

      socket.on('send_message', async (data: { conversationId: string; body: string }) => {
        try {
          const message = await db.message.create({
            data: {
              conversationId: data.conversationId,
              senderId: userId,
              body: data.body,
            },
            include: { sender: true },
          })
          this.io.to(`conversation:${data.conversationId}`).emit('message_received', message)
          
          // Create notification for others
          const participants = await db.conversationParticipant.findMany({
            where: { conversationId: data.conversationId, userId: { not: userId } },
          })
          for (const p of participants) {
            this.io.to(`user:${p.userId}`).emit('new_message', {
              conversationId: data.conversationId,
              from: userId,
              preview: data.body.substring(0, 100),
            })
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message' })
          logger.error(error, 'Failed to save message')
        }
      })

      socket.on('typing', (conversationId: string) => {
        this.broadcastTyping(conversationId, userId, true)
        setTimeout(() => this.broadcastTyping(conversationId, userId, false), 3000)
      })

      socket.on('disconnect', () => {
        const connections = this.activeConnections.get(userId)
        if (connections) {
          connections.delete(socket.id)
          if (connections.size === 0) {
            this.activeConnections.delete(userId)
            this.broadcastPresence(userId, 'offline')
          }
        }
        logger.info({ userId }, 'WebSocket disconnected')
      })
    })
  }

  private broadcastPresence(userId: string, status: 'online' | 'offline') {
    this.io.to(`user:${userId}`).emit('presence_changed', { userId, status })
  }

  private broadcastTyping(conversationId: string, userId: string, isTyping: boolean) {
    this.io.to(`conversation:${conversationId}`).emit('typing', { userId, isTyping })
  }

  public getIO() {
    return this.io
  }

  public isUserOnline(userId: string): boolean {
    return this.activeConnections.has(userId) && this.activeConnections.get(userId)!.size > 0
  }
}
