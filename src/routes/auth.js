import { Router } from 'express';
import { authController, authenticateToken } from '../controllers/authController.js';

const router = Router();

// Rotas públicas de autenticação (Cadastro e Login 100% opcionais)
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rotas protegidas (exigem Bearer Token do usuário autenticado)
router.get('/me', authenticateToken, authController.me);

// Gerenciamento da "Minha Garagem"
router.get('/garagem', authenticateToken, authController.getGaragem);
router.post('/garagem', authenticateToken, authController.addGaragem);
router.delete('/garagem/:idOuPlaca', authenticateToken, authController.removeGaragem);

// Histórico de Comprovantes e Quitações
router.get('/historico', authenticateToken, authController.getHistorico);
router.post('/historico', authenticateToken, authController.addHistorico);

// Alertas de Pedágio (WhatsApp / E-mail)
router.post('/alertas', authenticateToken, authController.updateAlertas);

export default router;
