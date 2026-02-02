import { Request, Response, NextFunction } from 'express';

/**
 * Augmentation des types Express pour inclure les erreurs typées
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export {};
