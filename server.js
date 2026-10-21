import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './src/routes/api.js';
import authRoutes from './src/routes/auth.js';
import pedagioRoutes from './src/routes/pedagioRoutes.js';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir Service Worker e Manifest sem cache HTTP no navegador (essencial para deploys instantâneos)
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(publicDir, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(publicDir, 'manifest.json'));
});

// Servidor de arquivos estáticos da pasta /public (Frontend PWA)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Rotas da API RESTful (v1), Free Flow Oficial e Autenticação Opcional
app.use('/api', pedagioRoutes);
app.use('/api/v1', pedagioRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// Endpoint de verificação de integridade (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    app: 'Estradapay - Intermediação Free Flow',
    ambiente: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
});

// Fallback SPA / PWA: Qualquer rota não reconhecida serve o index.html
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Inicialização do servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🚀 Estradapay - Servidor Free Flow Rodando!`);
  console.log(`📍 URL Local: http://localhost:${PORT}`);
  console.log(`💳 Gateway Ativo | Pagamento Exclusivo PIX | Taxa Estradapay: R$ 1,00 fixa`);
  console.log(`📁 Pasta Pública: ${publicDir}`);
  console.log(`=================================================`);
});

export default app;
