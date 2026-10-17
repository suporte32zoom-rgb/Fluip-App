import { Router } from 'express';
import pedagioService from '../services/pedagioService.js';
import pagamentoService from '../services/pagamentoService.js';

const router = Router();

// Obter taxa de conveniência padrão da variável de ambiente ou fallback de R$ 1,90
const TAXA_CONVENIENCIA_PADRAO = Number(process.env.TAXA_CONVENIENCIA) || 1.90;

/**
 * GET /api/v1/consultar?placa=XXX
 * Consulta os débitos em aberto para uma placa específica e retorna o resumo financeiro
 */
router.get('/consultar', async (req, res) => {
  try {
    const { placa } = req.query;

    if (!placa) {
      return res.status(400).json({
        success: false,
        error: 'O parâmetro "placa" é obrigatório. Exemplo: /api/v1/consultar?placa=ABC1D23',
      });
    }

    const debitos = await pedagioService.consultarDebitosPorPlaca(placa);
    const placaFormatada = pedagioService.validarEFormatarPlaca(placa);

    // Calcular resumo financeiro com nova taxa de conveniência de R$ 1,90
    const quantidade = debitos.length;
    const subtotal = debitos.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    const taxaConveniencia = quantidade > 0 ? TAXA_CONVENIENCIA_PADRAO : 0;
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
 * Recebe a lista de IDs de tarifas e a forma de pagamento ('pix' | 'credito' | 'debito')
 * Body: { placa: string, passagensIds: string[], formaDePagamento?: string }
 */
router.post('/pagar', async (req, res) => {
  try {
    const { placa, passagensIds, formaDePagamento = 'pix' } = req.body;

    if (!passagensIds || !Array.isArray(passagensIds) || passagensIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'É obrigatório selecionar ao menos uma tarifa para pagamento.',
      });
    }

    const taxaConveniencia = TAXA_CONVENIENCIA_PADRAO;
    const cobranca = pagamentoService.gerarCobranca(passagensIds, taxaConveniencia, placa, formaDePagamento);

    return res.status(201).json({
      success: true,
      mensagem: cobranca.formaDePagamento === 'pix'
        ? 'Cobrança PIX gerada com sucesso. Efetue o pagamento em até 15 minutos.'
        : `Checkout com ${cobranca.formaDePagamento === 'credito' ? 'Cartão de Crédito' : 'Cartão de Débito'} preparado com sucesso.`,
      txid: cobranca.txid,
      placa: cobranca.placa,
      formaDePagamento: cobranca.formaDePagamento,
      passagensIds: cobranca.passagensIds,
      pixCopiaECola: cobranca.pixCopiaECola,
      qrCodeBase64: cobranca.qrCodeBase64,
      opcoesParcelamento: cobranca.opcoesParcelamento,
      formularioCartao: cobranca.formularioCartao,
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
        error: `Cobrança com txid ${txid} não foi localizada no sistema Fluip.`,
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
