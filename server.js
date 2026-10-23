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

// 1. Rota para consultar a placa e os débitos reais na Infosimples
app.get('/api/consultar-placa/:placa', async (req, res) => {
  const { placa } = req.params;
  const tokenSegredo = process.env.INFOSIMPLES_TOKEN || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72'; // Variável segura do servidor

  if (!tokenSegredo) {
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Token de segurança não configurado no ambiente.' 
    });
  }

  try {
    // Endpoint oficial de consulta da Infosimples
    const url = 'https://api.infosimples.com/v2/consultas/detran/sp/debitos-e-multas';
    const altUrl = 'https://api.infosimples.com/api/v2/consultas/detran/sp/debitos-e-multas';
    
    let dados = null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenSegredo,
          placa: (placa || '').toUpperCase()
        })
      });
      const text = await response.text();
      try {
        dados = JSON.parse(text);
      } catch (e) {
        const altResponse = await fetch(altUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenSegredo,
            placa: (placa || '').toUpperCase()
          })
        });
        const altText = await altResponse.text();
        dados = JSON.parse(altText);
      }
    } catch (err) {
      console.warn('[Infosimples server.js fetch error]:', err.message);
    }

    if (!dados) {
      return res.status(500).json({ 
        sucesso: false, 
        mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
      });
    }

    if (dados.code && dados.code !== 200) {
      return res.status(400).json({ 
        sucesso: false, 
        mensagem: dados.message || dados.code_message || 'Não foi possível localizar dados para esta placa.' 
      });
    }

    const itemData = Array.isArray(dados.data) ? dados.data[0] : (dados.data || {});

    res.json({
      sucesso: true,
      veiculo: itemData.veiculo || dados.data?.veiculo || {},
      debitos: itemData.debitos_pendentes || dados.data?.debitos_pendentes || []
    });

  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
    });
  }
});

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
