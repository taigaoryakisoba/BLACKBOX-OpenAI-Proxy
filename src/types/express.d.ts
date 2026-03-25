declare global {
  namespace Express {
    interface Request {
      reqId: string;
    }
  }
}

export {};
