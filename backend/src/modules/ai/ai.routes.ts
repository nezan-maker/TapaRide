import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuthenticate } from '../../plugins/rbac.js';
import * as AiController from './ai.controller.js';

const router = Router();

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI requests — please wait a moment and try again.',
    code: 'RATE_LIMITED',
    status: 429,
  },
});

router.get('/status', AiController.getStatus);
router.get('/conversations', authenticate, AiController.listConversations);
router.delete('/conversations/:id', authenticate, AiController.deleteConversationHandler);
router.post('/chat', aiChatLimiter, optionalAuthenticate, AiController.chat);

export default router;
