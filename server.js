import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './src/routes/api.js';

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

// Servidor de arquivos estáticos da pasta /public (Frontend PWA)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Rotas da API RESTful (v1)
app.use('/api/v1', apiRoutes);

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
