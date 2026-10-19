import { Router, RequestHandler } from 'express';

export const authenticateToken: RequestHandler;
export const authController: Record<string, RequestHandler>;

declare const router: Router;
export default router;
