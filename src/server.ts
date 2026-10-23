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

// 1. Rota para consultar a placa e os débitos reais na Infosimples / ANTT
app.all(['/api/consultar-placa/:placa', '/api/v1/consultar-placa/:placa'], async (req, res) => {
  const placa = (req.params['placa'] || '').toUpperCase().trim();
  const tokenSegredo = process.env['INFOSIMPLES_TOKEN'] || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72';

  if (!tokenSegredo) {
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Token de segurança não configurado no ambiente.' 
    });
  }

  const queryObj = req.query as Record<string, string | undefined>;
  const bodyObj = (req.body || {}) as Record<string, unknown>;

  const rawCpf = String(queryObj['cpf'] || bodyObj['cpf'] || '');
  const rawCnpj = String(queryObj['cnpj'] || bodyObj['cnpj'] || '');
  const rawRntrc = String(queryObj['rntrc'] || bodyObj['rntrc'] || '');

  const cpf = rawCpf.replace(/\D/g, '').trim();
  const cnpj = rawCnpj.replace(/\D/g, '').trim();
  const rntrc = rawRntrc.trim();
  const timeout = Number(queryObj['timeout'] || bodyObj['timeout']) || 600;
  const ignoreSiteReceipt = queryObj['ignore_site_receipt'] !== undefined 
    ? Number(queryObj['ignore_site_receipt']) 
    : (bodyObj['ignore_site_receipt'] !== undefined ? Number(bodyObj['ignore_site_receipt']) : 0);

  // Se o usuário enviou CPF, CNPJ ou RNTRC, aciona a rota oficial da ANTT
  if (cpf || cnpj || rntrc) {
    try {
      const urlAntt = 'https://api.infosimples.com/api/v2/consultas/antt/veiculo';
      const responseAntt = await fetch(urlAntt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenSegredo,
          timeout,
          ignore_site_receipt: ignoreSiteReceipt,
          placa,
          ...(cpf ? { cpf } : {}),
          ...(cnpj ? { cnpj } : {}),
          ...(rntrc ? { rntrc } : {}),
        })
      });

      const dadosAntt = (await responseAntt.json()) as Record<string, unknown>;

      if (dadosAntt && dadosAntt['code'] === 200) {
        const itemAntt = (Array.isArray(dadosAntt['data']) ? dadosAntt['data'][0] : (dadosAntt['data'] || {})) as Record<string, unknown>;
        return res.json({
          sucesso: true,
          fonte: 'ANTT / Infosimples (RNTRC Oficial)',
          documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo',
          veiculo: itemAntt['veiculo'] || itemAntt,
          transportador: itemAntt['transportador'] || {},
          rntrc: itemAntt['rntrc'] || {},
          debitos: itemAntt['debitos_pendentes'] || []
        });
      } else if (dadosAntt && dadosAntt['code']) {
        return res.status(400).json({
          sucesso: false,
          codigo: dadosAntt['code'],
          mensagem: (dadosAntt['message'] || dadosAntt['code_message'] || 'Não foi possível localizar dados na ANTT para esta placa e documento.') as string,
          erros: dadosAntt['errors'] || [],
          documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
        });
      }
    } catch (eAntt: unknown) {
      console.warn('[ANTT via consultar-placa SSR] Aviso:', eAntt instanceof Error ? eAntt.message : String(eAntt));
    }
  }

  try {
    const url = 'https://api.infosimples.com/api/v2/consultas/antt/veiculo';
    const altUrl = 'https://api.infosimples.com/v2/consultas/detran/sp/debitos-e-multas';
    
    let dados: Record<string, unknown> | null = null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenSegredo,
          timeout,
          ignore_site_receipt: ignoreSiteReceipt,
          placa,
          ...(cpf ? { cpf } : {}),
          ...(cnpj ? { cnpj } : {}),
          ...(rntrc ? { rntrc } : {}),
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
            placa
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
        codigo: dados['code'],
        mensagem: msg,
        documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
      });
    }

    const dataObj = dados['data'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const itemData = (Array.isArray(dataObj) ? dataObj[0] : (dataObj || {})) as Record<string, unknown>;

    return res.json({
      sucesso: true,
      fonte: 'ANTT / Infosimples',
      veiculo: itemData['veiculo'] || (dataObj as Record<string, unknown> | undefined)?.['veiculo'] || itemData,
      debitos: itemData['debitos_pendentes'] || (dataObj as Record<string, unknown> | undefined)?.['debitos_pendentes'] || []
    });

  } catch {
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
    });
  }
});

// 2. Rota Oficial ANTT / Veículo (Infosimples)
// Docs: https://api.infosimples.com/consultas/docs/antt/veiculo
app.all(['/api/consultar-antt', '/api/v1/consultar-antt'], async (req, res) => {
  const token = process.env['INFOSIMPLES_TOKEN'] || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72';

  const queryObj = req.query as Record<string, string | undefined>;
  const bodyObj = (req.body || {}) as Record<string, unknown>;

  const placa = String(queryObj['placa'] || bodyObj['placa'] || '').toUpperCase().trim();
  const rawCpf = String(queryObj['cpf'] || bodyObj['cpf'] || '');
  const rawCnpj = String(queryObj['cnpj'] || bodyObj['cnpj'] || '');
  const rawRntrc = String(queryObj['rntrc'] || bodyObj['rntrc'] || '');

  const cpf = rawCpf.replace(/\D/g, '').trim();
  const cnpj = rawCnpj.replace(/\D/g, '').trim();
  const rntrc = rawRntrc.trim();
  const timeout = Number(queryObj['timeout'] || bodyObj['timeout']) || 600;
  const ignoreSiteReceipt = queryObj['ignore_site_receipt'] !== undefined 
    ? Number(queryObj['ignore_site_receipt']) 
    : (bodyObj['ignore_site_receipt'] !== undefined ? Number(bodyObj['ignore_site_receipt']) : 0);

  if (!placa) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'O parâmetro "placa" é obrigatório para a consulta ANTT.'
    });
  }

  if (!cpf && !cnpj && !rntrc) {
    return res.status(400).json({
      sucesso: false,
      codigo: 606,
      mensagem: "É necessário informar ao menos um dos parâmetros: 'cpf', 'cnpj' ou 'rntrc' conforme especificação oficial da ANTT.",
      documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
    });
  }

  try {
    const url = 'https://api.infosimples.com/api/v2/consultas/antt/veiculo';
    const params = {
      token,
      timeout,
      ignore_site_receipt: ignoreSiteReceipt,
      placa,
      ...(cpf ? { cpf } : {}),
      ...(cnpj ? { cnpj } : {}),
      ...(rntrc ? { rntrc } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const dados = (await response.json()) as Record<string, unknown>;

    if (dados['code'] && dados['code'] !== 200) {
      return res.status(400).json({
        sucesso: false,
        codigo: dados['code'],
        mensagem: (dados['message'] || dados['code_message'] || 'Não foi possível localizar dados na base da ANTT para estes parâmetros.') as string,
        erros: dados['errors'] || [],
        documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
      });
    }

    const itemData = (Array.isArray(dados['data']) ? dados['data'][0] : (dados['data'] || {})) as Record<string, unknown>;

    return res.status(200).json({
      sucesso: true,
      servico: 'antt/veiculo',
      fonte: 'Agência Nacional de Transportes Terrestres (ANTT)',
      documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo',
      dados: itemData,
      header: dados['header']
    });

  } catch (error: unknown) {
    console.error('[ANTT Consulta SSR] Erro:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro de comunicação ao consultar base oficial da ANTT.'
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
