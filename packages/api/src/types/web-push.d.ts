declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  export interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer,
    options?: Record<string, unknown>,
  ): Promise<SendResult>

  const webpush: {
    setVapidDetails: typeof setVapidDetails
    sendNotification: typeof sendNotification
  }
  export default webpush
}
