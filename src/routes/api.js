import { Router } from 'express';
import pedagioService from '../services/pedagioService.js';
import pagamentoService from '../services/pagamentoService.js';
import freeFlowBaseService from '../services/freeFlowBaseService.js';

const router = Router();

/**
 * GET /api/v1/porticos
 * Retorna os pórticos e rodovias Free Flow sincronizados com a base aberta Sem Parar (GitHub)
 * Suporta filtros por estado (?uf=SP) e busca por texto (?q=Dutra)
 */
router.get('/porticos', (req, res) => {
  try {
    const { uf, q, status } = req.query;
    const resultado = freeFlowBaseService.obterPorticos({ uf, q, status });

    return res.status(200).json({
      success: true,
      metadados: resultado.metadados,
      total: resultado.total,
      porticos: resultado.porticos,
    });
  } catch (error) {
    console.error('[API /porticos] Erro ao carregar dados:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao carregar base de pórticos Free Flow.',
    });
  }
});

/**
 * POST /api/v1/porticos/sync
 * Força a sincronização imediata com o repositório público do Sem Parar no GitHub
 */
router.post('/porticos/sync', async (req, res) => {
  try {
    const resultado = await freeFlowBaseService.sincronizarComGitHub(true);
    return res.status(200).json({
      success: true,
      mensagem: 'Base de dados sincronizada com sucesso com o repositório do Sem Parar no GitHub.',
      resultado,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao sincronizar com GitHub.',
    });
  }
});

// Obter parâmetros da taxa de administração/conveniência proporcional
// Taxa Estradapay fixa: R$ 1,00 por transação unificada (independente do valor ou quantidade)
const TAXA_CONVENIENCIA_FIXA = Number(process.env.TAXA_CONVENIENCIA_FIXA) || 1.00;

/**
 * GET /api/v1/consultar?placa=XXX
 * Consulta os débitos em aberto para uma placa específica e retorna o resumo financeiro
 */
router.get('/consultar', async (req, res) => {
  try {
    const { placa, estrangeira, placaEstrangeira } = req.query;
    const isEstrangeira = estrangeira === 'true' || placaEstrangeira === 'true';

    if (!placa) {
      return res.status(400).json({
        success: false,
        error: 'O parâmetro "placa" é obrigatório. Exemplo: /api/v1/consultar?placa=ABC1D23',
      });
    }

    const debitos = await pedagioService.consultarDebitosPorPlaca(placa, isEstrangeira);
    const placaFormatada = pedagioService.validarEFormatarPlaca(placa, isEstrangeira);

    // Calcular resumo financeiro com regra de taxa fixa: Total = subtotal + 1.00
    const quantidade = debitos.length;
    const subtotal = debitos.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    const taxaConveniencia = quantidade > 0 ? TAXA_CONVENIENCIA_FIXA : 0;
    const totalGeral = Number((subtotal + taxaConveniencia).toFixed(2));

    return res.status(200).json({
      success: true,
      placa: placaFormatada,
      debitos,
      resumo: {
        quantidade,
        subtotal: Number(subtotal.toFixed(2)),
        taxaConveniencia: Number(taxaConveniencia.toFixed(2)),
        totalGeral,
        moeda: 'BRL',
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Erro ao processar consulta de pedágio.',
    });
  }
});

/**
 * POST /api/v1/pagar
 * Recebe a lista de IDs de tarifas e gera cobrança exclusivamente via PIX Instantâneo
 * Body: { placa: string, passagensIds: string[] }
 */
router.post('/pagar', async (req, res) => {
  try {
    const { placa, passagensIds } = req.body;

    if (!passagensIds || !Array.isArray(passagensIds) || passagensIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'É obrigatório selecionar ao menos uma tarifa para pagamento.',
      });
    }

    // Calcula a cobrança aplicando a taxa fixa de R$ 1,00 via PIX
    const cobranca = pagamentoService.gerarCobranca(passagensIds, null, placa, 'pix');

    return res.status(201).json({
      success: true,
      mensagem: 'Cobrança PIX gerada com sucesso. Efetue o pagamento em até 15 minutos.',
      txid: cobranca.txid,
      placa: cobranca.placa,
      formaDePagamento: 'pix',
      passagensIds: cobranca.passagensIds,
      pixCopiaECola: cobranca.pixCopiaECola,
      qrCodeBase64: cobranca.qrCodeBase64,
      valorTotal: cobranca.valorTotal,
      resumo: {
        passagensQuantidade: cobranca.passagensIds.length,
        subtotal: cobranca.subtotal,
        taxaConveniencia: cobranca.taxaConveniencia,
        totalGeral: cobranca.valorTotal,
      },
      expiresAt: cobranca.expiresAt,
      tempoLimiteSegundos: cobranca.tempoLimiteSegundos,
      status: cobranca.status,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar cobrança.',
    });
  }
});

/**
 * POST /api/v1/pagar-cartao
 * Processa a liquidação simulada via Cartão de Crédito ou Débito
 * Body: { txid: string, numeroCartao: string, nomeTitular: string, validade: string, cvv: string, parcelas?: number }
 */
router.post('/pagar-cartao', async (req, res) => {
  try {
    const { txid, numeroCartao, nomeTitular, validade, cvv, parcelas = 1 } = req.body;

    if (!txid) {
      return res.status(400).json({ success: false, error: 'O código txid da transação é obrigatório.' });
    }

    if (!numeroCartao || !nomeTitular || !validade || !cvv) {
      return res.status(400).json({ success: false, error: 'Todos os campos do cartão são obrigatórios.' });
    }

    const cobrancaAtualizada = pagamentoService.confirmarPagamento(txid, {
      numeroCartao,
      nomeTitular,
      validade,
      parcelas: Number(parcelas) || 1,
    });

    return res.status(200).json({
      success: true,
      mensagem: 'Pagamento com cartão autorizado pela emissora e débitos baixados na concessionária!',
      cobranca: cobrancaAtualizada,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Falha ao processar pagamento com cartão.',
    });
  }
});

/**
 * GET /api/v1/status/:txid
 */
router.get('/status/:txid', (req, res) => {
  const { txid } = req.params;
  const cobranca = pagamentoService.consultarStatusPix(txid);

  if (!cobranca) {
    return res.status(404).json({
      success: false,
      error: 'Cobrança não encontrada.',
    });
  }

  return res.status(200).json({
    success: true,
    txid: cobranca.txid,
    formaDePagamento: cobranca.formaDePagamento,
    status: cobranca.status,
    pagoEm: cobranca.pagoEm || null,
    autenticacaoBancaria: cobranca.autenticacaoBancaria || null,
    protocoloConcessionaria: cobranca.protocoloConcessionaria || null,
    comprovante: cobranca.comprovante || null,
  });
});

/**
 * POST /api/v1/simular-pagamento/:txid
 */
router.post('/simular-pagamento/:txid', (req, res) => {
  try {
    const { txid } = req.params;
    const { parcelas, numeroCartao } = req.body || {};
    const cobrancaAtualizada = pagamentoService.confirmarPagamento(txid, {
      parcelas: parcelas || 1,
      numeroCartao: numeroCartao || '4532 1100 8899 4321',
    });

    return res.status(200).json({
      success: true,
      mensagem: 'Pagamento simulado com sucesso. Débitos liquidados!',
      cobranca: cobrancaAtualizada,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Erro ao simular pagamento.',
    });
  }
});

/**
 * POST /api/v1/webhook/pix
 */
router.post('/webhook/pix', (req, res) => {
  try {
    const { txid, endToEndId } = req.body;

    if (!txid) {
      return res.status(400).json({
        success: false,
        error: 'O campo "txid" é obrigatório no payload do webhook.',
      });
    }

    const cobranca = pagamentoService.consultarStatusPix(txid);
    if (!cobranca) {
      return res.status(404).json({
        success: false,
        error: `Cobrança com txid ${txid} não foi localizada no sistema Estradapay.`,
      });
    }

    const cobrancaAtualizada = pagamentoService.confirmarPagamento(txid);

    return res.status(200).json({
      success: true,
      mensagem: 'Baixa realizada com sucesso junto à concessionária de rodovias.',
      txid,
      endToEndId: endToEndId || `E00000000${Date.now()}`,
      status: cobrancaAtualizada.status,
      protocoloBaixa: cobrancaAtualizada.protocoloConcessionaria,
      autenticacao: cobrancaAtualizada.autenticacaoBancaria,
      dataProcessamento: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar webhook de pagamento.',
    });
  }
});

export default router;
