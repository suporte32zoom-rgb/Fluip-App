/**
 * Rotas Dedicadas de Pedágio e Free Flow (Estradapay)
 * Endpoint oficial: GET /api/freeflow
 * Fornece catálogo completo de pórticos com CORS aberto, cache em memória e contingência garantida.
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import freeFlowBaseService from '../services/freeFlowBaseService.js';

const BACKUP_PATH = path.join(process.cwd(), 'src/data/freeFlowBackup.json');
const PUBLIC_BACKUP_PATH = path.join(process.cwd(), 'public/data/porticos.json');

const router = Router();

// Middleware de CORS aberto para qualquer origem
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Handler principal para obter pórticos Free Flow
 */
const handleGetFreeFlow = async (req, res) => {
  setCorsHeaders(res);

  const { uf, q, status } = req.query;

  try {
    const dados = freeFlowBaseService.obterPorticos({ uf, q, status });

    if (dados && Array.isArray(dados.porticos) && dados.porticos.length > 0) {
      return res.status(200).json({
        success: true,
        metadados: dados.metadados,
        total: dados.total,
        porticos: dados.porticos,
      });
    }

    // Se o serviço retornou vazio, aciona o backup local seguro
    throw new Error('Serviço retornou lista vazia. Carregando backup estático.');
  } catch (error) {
    console.warn('[pedagioRoutes] Falha no serviço dinâmico. Utilizando contingência de backup:', error.message);

    try {
      const targetFile = fs.existsSync(BACKUP_PATH) ? BACKUP_PATH : (fs.existsSync(PUBLIC_BACKUP_PATH) ? PUBLIC_BACKUP_PATH : null);
      if (targetFile) {
        const conteudo = fs.readFileSync(targetFile, 'utf-8');
        const backupData = JSON.parse(conteudo);
        let porticos = backupData.porticos || [];

        if (uf && uf !== 'TODOS') {
          const ufUpper = String(uf).toUpperCase().trim();
          porticos = porticos.filter((p) => p.uf === ufUpper);
        }

        if (q) {
          const qLower = String(q).toLowerCase().trim();
          porticos = porticos.filter((p) =>
            (p.rodovia && p.rodovia.toLowerCase().includes(qLower)) ||
            (p.concessionaria && p.concessionaria.toLowerCase().includes(qLower)) ||
            (p.municipio && p.municipio.toLowerCase().includes(qLower))
          );
        }

        return res.status(200).json({
          success: true,
          metadados: {
            ...backupData.metadados,
            origem: 'BACKUP_ESTATICO_CONTINGENCIA',
            dataSincronizacao: new Date().toISOString(),
          },
          total: porticos.length,
          porticos,
        });
      }
    } catch (errBackup) {
      console.error('[pedagioRoutes] Erro ao ler backup local:', errBackup);
    }

    // Resposta de emergência estruturada caso até o arquivo de disco falhe
    return res.status(200).json({
      success: true,
      metadados: {
        fonte: 'Base Aberta Sem Parar / CC BY 4.0',
        origem: 'EMERGENCIA_EN_MEMORIA',
      },
      total: 3,
      porticos: [
        {
          id: 'portico_dutra_01',
          concessionaria: 'CCR RioSP',
          rodovia: 'BR-116 (Via Dutra - Trecho Metropolitano SP)',
          km: 'Km 204',
          municipio: 'Arujá',
          uf: 'SP',
          tarifaBase: 4.10,
          prazoPagamentoDias: 30,
          status: 'ATIVO',
          localizacaoDescricao: 'Pórtico Free Flow Metropolitano Arujá / Guarulhos',
        },
        {
          id: 'portico_riosp_01',
          concessionaria: 'CCR RioSP',
          rodovia: 'BR-101 (Rio-Santos)',
          km: 'Km 538,5',
          municipio: 'Paraty',
          uf: 'RJ',
          tarifaBase: 4.80,
          prazoPagamentoDias: 30,
          status: 'ATIVO',
          localizacaoDescricao: 'Trevo de acesso histórico a Paraty',
        },
        {
          id: 'portico_tamoios_01',
          concessionaria: 'Concessionária Tamoios',
          rodovia: 'SP-099 (Contorno Sul Caraguatatuba - São Sebastião)',
          km: 'Km 13+500',
          municipio: 'Caraguatatuba',
          uf: 'SP',
          tarifaBase: 5.20,
          prazoPagamentoDias: 30,
          status: 'ATIVO',
          localizacaoDescricao: 'Novo Contorno da Serra do Mar',
        },
      ],
    });
  }
};

/**
 * Rota Oficial ANTT / Veículo (Infosimples)
 * Docs: https://api.infosimples.com/consultas/docs/antt/veiculo
 * Requisição: https://api.infosimples.com/api/v2/consultas/antt/veiculo?token=...&timeout=600&ignore_site_receipt=0&placa=&cpf=&cnpj=&rntrc=
 */
const handleConsultarAntt = async (req, res) => {
  setCorsHeaders(res);
  const token = process.env.INFOSIMPLES_TOKEN || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72';

  const placa = (req.query.placa || req.body?.placa || '').toUpperCase().trim();
  const cpf = (req.query.cpf || req.body?.cpf || '').replace(/\D/g, '').trim();
  const cnpj = (req.query.cnpj || req.body?.cnpj || '').replace(/\D/g, '').trim();
  const rntrc = (req.query.rntrc || req.body?.rntrc || '').trim();
  const timeout = Number(req.query.timeout || req.body?.timeout) || 600;
  const ignoreSiteReceipt = req.query.ignore_site_receipt !== undefined 
    ? Number(req.query.ignore_site_receipt) 
    : (req.body?.ignore_site_receipt !== undefined ? Number(req.body.ignore_site_receipt) : 0);

  if (!placa) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'O parâmetro "placa" é obrigatório para a consulta ANTT.'
    });
  }

  if (!cpf && !cnpj && !rntrc) {
    return res.status(400).json({
      sucesso: false,
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

    const dados = await response.json();

    if (dados.code && dados.code !== 200) {
      return res.status(400).json({
        sucesso: false,
        codigo: dados.code,
        mensagem: dados.message || dados.code_message || 'Não foi possível localizar dados na base da ANTT para estes parâmetros.',
        erros: dados.errors || [],
        documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
      });
    }

    const itemData = Array.isArray(dados.data) ? dados.data[0] : (dados.data || {});

    return res.status(200).json({
      sucesso: true,
      servico: 'antt/veiculo',
      fonte: 'Agência Nacional de Transportes Terrestres (ANTT)',
      documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo',
      dados: itemData,
      header: dados.header
    });

  } catch (error) {
    console.error('[ANTT Consulta] Erro:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro de comunicação ao consultar base oficial da ANTT.'
    });
  }
};

/**
 * 1. Rota para consultar a placa e os débitos reais na Infosimples / ANTT
 * GET & POST /api/consultar-placa/:placa
 */
const handleConsultarPlaca = async (req, res) => {
  setCorsHeaders(res);
  const { placa } = req.params;
  const tokenSegredo = process.env.INFOSIMPLES_TOKEN || 'x0tKkeGRNjcCuMbrF7DPtkF8hGGDJANd7lFNIU72';

  if (!tokenSegredo) {
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Token de segurança não configurado no ambiente.' 
    });
  }

  const cpf = (req.query.cpf || req.body?.cpf || '').replace(/\D/g, '').trim();
  const cnpj = (req.query.cnpj || req.body?.cnpj || '').replace(/\D/g, '').trim();
  const rntrc = (req.query.rntrc || req.body?.rntrc || '').trim();
  const timeout = Number(req.query.timeout || req.body?.timeout) || 600;
  const ignoreSiteReceipt = req.query.ignore_site_receipt !== undefined 
    ? Number(req.query.ignore_site_receipt) 
    : (req.body?.ignore_site_receipt !== undefined ? Number(req.body.ignore_site_receipt) : 0);

  // Se o usuário enviou CPF, CNPJ ou RNTRC, aciona prioritariamente a API oficial da ANTT
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
          placa: (placa || '').toUpperCase(),
          ...(cpf ? { cpf } : {}),
          ...(cnpj ? { cnpj } : {}),
          ...(rntrc ? { rntrc } : {}),
        })
      });

      const dadosAntt = await responseAntt.json();

      if (dadosAntt && dadosAntt.code === 200) {
        const itemAntt = Array.isArray(dadosAntt.data) ? dadosAntt.data[0] : (dadosAntt.data || {});
        return res.json({
          sucesso: true,
          fonte: 'ANTT / Infosimples (RNTRC Oficial)',
          documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo',
          veiculo: itemAntt.veiculo || itemAntt,
          transportador: itemAntt.transportador || {},
          rntrc: itemAntt.rntrc || {},
          debitos: itemAntt.debitos_pendentes || []
        });
      } else if (dadosAntt && dadosAntt.code) {
        return res.status(400).json({
          sucesso: false,
          codigo: dadosAntt.code,
          mensagem: dadosAntt.message || dadosAntt.code_message || 'Não foi possível localizar dados na ANTT para esta placa e documento.',
          erros: dadosAntt.errors || [],
          documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
        });
      }
    } catch (eAntt) {
      console.warn('[ANTT via consultar-placa] Aviso de rede:', eAntt.message);
    }
  }

  // Consulta padrão via endpoint da Infosimples
  try {
    const url = 'https://api.infosimples.com/api/v2/consultas/antt/veiculo';
    const altUrl = 'https://api.infosimples.com/v2/consultas/detran/sp/debitos-e-multas';
    
    let dados = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenSegredo,
          timeout,
          ignore_site_receipt: ignoreSiteReceipt,
          placa: (placa || '').toUpperCase(),
          ...(cpf ? { cpf } : {}),
          ...(cnpj ? { cnpj } : {}),
          ...(rntrc ? { rntrc } : {}),
        })
      });
      const text = await response.text();
      try {
        dados = JSON.parse(text);
      } catch (errJson) {
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
    } catch (e) {
      console.warn('[Infosimples pedagioRoutes fetch warning]:', e.message);
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
        codigo: dados.code,
        mensagem: dados.message || dados.code_message || 'Não foi possível localizar dados para esta placa.',
        erros: dados.errors || [],
        documentacao: 'https://api.infosimples.com/consultas/docs/antt/veiculo'
      });
    }

    const itemData = Array.isArray(dados.data) ? dados.data[0] : (dados.data || {});

    res.json({
      sucesso: true,
      fonte: 'ANTT / Infosimples',
      veiculo: itemData.veiculo || dados.data?.veiculo || itemData,
      debitos: itemData.debitos_pendentes || dados.data?.debitos_pendentes || []
    });

  } catch (error) {
    res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro de comunicação com a base de dados de trânsito.' 
    });
  }
};

// Rota GET /freeflow
router.get('/freeflow', handleGetFreeFlow);
router.get('/api/freeflow', handleGetFreeFlow);

// Rotas de Consulta na Infosimples / ANTT
router.get('/consultar-placa/:placa', handleConsultarPlaca);
router.post('/consultar-placa/:placa', handleConsultarPlaca);
router.get('/api/consultar-placa/:placa', handleConsultarPlaca);
router.post('/api/consultar-placa/:placa', handleConsultarPlaca);

router.get('/consultar-antt', handleConsultarAntt);
router.post('/consultar-antt', handleConsultarAntt);
router.get('/api/consultar-antt', handleConsultarAntt);
router.post('/api/consultar-antt', handleConsultarAntt);

// Preflight CORS
router.options('/freeflow', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});
router.options('/api/freeflow', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});
router.options('/consultar-placa/:placa', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});
router.options('/api/consultar-placa/:placa', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});
router.options('/consultar-antt', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});
router.options('/api/consultar-antt', (req, res) => {
  setCorsHeaders(res);
  res.status(204).end();
});

export default router;

