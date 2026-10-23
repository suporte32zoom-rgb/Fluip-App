import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import pedagioRoutes from './routes/pedagioRoutes.js';

// Carregar variáveis de ambiente (.env)
dotenv.config();

// Garantir token padrão de contingência da Infosimples se não injetado pelo host
process.env['INFOSIMPLES_TOKEN'] = process.env['INFOSIMPLES_TOKEN'] || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72';

const browserDistFolder = join(import.meta.dirname, '../browser');
const publicFolder = join(process.cwd(), 'public');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Rota para consultar a placa e os débitos reais na Infosimples
app.get('/api/consultar-placa/:placa', async (req, res) => {
  const { placa } = req.params;
  const tokenSegredo = process.env['INFOSIMPLES_TOKEN']; // Variável segura do servidor

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
    
    let dados: Record<string, unknown> | null = null;
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
        dados = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const altResponse = await fetch(altUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: tokenSegredo,
            placa: (placa || '').toUpperCase()
          })
        });
        const altText = await altResponse.text();
        dados = JSON.parse(altText) as Record<string, unknown>;
      }
    } catch (e: unknown) {
      console.warn('[Infosimples src/server.ts fetch warning]:', e instanceof Error ? e.message : String(e));
    }

    if (!dados) {
      return res.status(500).json({ 
        sucesso: false, 
        mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
      });
    }

    if (dados['code'] && dados['code'] !== 200) {
      const msg = (dados['message'] || dados['code_message'] || 'Não foi possível localizar dados para esta placa.') as string;
      return res.status(400).json({ 
        sucesso: false, 
        mensagem: msg 
      });
    }

    const dataObj = dados['data'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const itemData = Array.isArray(dataObj) ? dataObj[0] : (dataObj || {});

    return res.json({
      sucesso: true,
      veiculo: itemData['veiculo'] || (dataObj as Record<string, unknown> | undefined)?.['veiculo'] || {},
      debitos: itemData['debitos_pendentes'] || (dataObj as Record<string, unknown> | undefined)?.['debitos_pendentes'] || []
    });

  } catch {
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
    });
  }
});

// Montar rotas da API Estradapay, Free Flow Oficial e Autenticação
app.use('/api', pedagioRoutes);
app.use('/api/v1', pedagioRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

// Servir Service Worker e Manifest sem cache HTTP no navegador (essencial para deploys instantâneos)
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(join(publicFolder, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(join(publicFolder, 'manifest.json'));
});

// Servir arquivos estáticos do public (manifest, icons, sw, etc.)
app.use(express.static(publicFolder));

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
