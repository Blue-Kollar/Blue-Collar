// Express type augmentation for authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
