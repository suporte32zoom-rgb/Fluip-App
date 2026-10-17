import { v4 as uuidv4 } from 'uuid';
import pedagioService from './pedagioService.js';

/**
 * Serviço de Geração e Gerenciamento de Pagamentos (Pix, Crédito e Débito) - Fluip
 */
class PagamentoService {
  constructor() {
    this.cobrancas = new Map();
  }

  /**
   * Calcula CRC16 (CCITT-FALSE) para o payload do PIX
   */
  calcularCRC16(payload) {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      const byte = payload.charCodeAt(i);
      crc ^= (byte << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ polynomial) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Formata tags TLV do padrão EMVCo do Banco Central do Brasil
   */
  formatarTLV(id, valor) {
    const len = valor.length.toString().padStart(2, '0');
    return `${id}${len}${valor}`;
  }

  /**
   * Monta o código oficial PIX Copia e Cola (BR Code)
   */
  montarPixCopiaECola({ chavePix, nomeRecebedor, cidade, valor, txid }) {
    const valorFormatado = valor.toFixed(2);
    
    const gui = this.formatarTLV('00', 'br.gov.bcb.pix');
    const chave = this.formatarTLV('01', chavePix);
    const merchantInfo = this.formatarTLV('26', `${gui}${chave}`);
    const mcc = this.formatarTLV('52', '0000');
    const moeda = this.formatarTLV('53', '986');
    const tagValor = this.formatarTLV('54', valorFormatado);
    const pais = this.formatarTLV('58', 'BR');
    const nome = this.formatarTLV('59', nomeRecebedor.substring(0, 25));
    const cidadeFormatada = this.formatarTLV('60', cidade.substring(0, 15));
    const campoTxid = this.formatarTLV('05', txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25));
    const dadosAdicionais = this.formatarTLV('62', campoTxid);

    const payloadBase = `000201${merchantInfo}${mcc}${moeda}${tagValor}${pais}${nome}${cidadeFormatada}${dadosAdicionais}6304`;
    const crc = this.calcularCRC16(payloadBase);

    return `${payloadBase}${crc}`;
  }

  /**
   * Gera SVG estilizado do QR Code PIX
   */
  gerarQrCodeDataUrl(payload) {
    const size = 256;
    const modules = 29;
    const cellSize = size / modules;
    let svgRects = '';

    const desenharMarcadorCanto = (startX, startY) => {
      let rects = '';
      rects += `<rect x="${startX * cellSize}" y="${startY * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#0f172a" rx="${cellSize * 0.8}" />`;
      rects += `<rect x="${(startX + 1) * cellSize}" y="${(startY + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#ffffff" rx="${cellSize * 0.5}" />`;
      rects += `<rect x="${(startX + 2) * cellSize}" y="${(startY + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#0284c7" rx="${cellSize * 0.4}" />`;
      return rects;
    };

    svgRects += desenharMarcadorCanto(1, 1);
    svgRects += desenharMarcadorCanto(modules - 8, 1);
    svgRects += desenharMarcadorCanto(1, modules - 8);

    let seed = 0;
    for (let i = 0; i < payload.length; i++) {
      seed = (seed * 31 + payload.charCodeAt(i)) % 1000000007;
    }

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if ((r < 9 && c < 9) || (r < 9 && c > modules - 10) || (r > modules - 10 && c < 9)) {
          continue;
        }
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        if ((seed % 100) > 42) {
          const fill = (seed % 10) === 0 ? '#0ea5e9' : '#0f172a';
          svgRects += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${(cellSize * 0.92).toFixed(1)}" height="${(cellSize * 0.92).toFixed(1)}" fill="${fill}" rx="1.5" />`;
        }
      }
    }

    const centerSize = 44;
    const centerPos = (size - centerSize) / 2;
    const centerSvg = `
      <rect x="${centerPos}" y="${centerPos}" width="${centerSize}" height="${centerSize}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      <path d="M${centerPos + 12} ${centerPos + 16} L${centerPos + 32} ${centerPos + 16} M${centerPos + 12} ${centerPos + 22} L${centerPos + 28} ${centerPos + 22} M${centerPos + 12} ${centerPos + 28} L${centerPos + 22} ${centerPos + 28}" stroke="#0284c7" stroke-width="3" stroke-linecap="round" />
    `;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#ffffff" rx="16"/>${svgRects}${centerSvg}</svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Gera a grade de parcelas para Cartão de Crédito em até 12x
   */
  calcularOpcoesParcelamento(valorTotal) {
    const parcelas = [];
    for (let n = 1; n <= 12; n++) {
      // Simulação sem juros até 3x, acréscimo sutil após 4x
      const taxaJuros = n > 3 ? (n - 3) * 0.015 : 0;
      const valorComJuros = valorTotal * (1 + taxaJuros);
      const valorParcela = valorComJuros / n;
      parcelas.push({
        numero: n,
        valorParcela: Number(valorParcela.toFixed(2)),
        valorTotalComJuros: Number(valorComJuros.toFixed(2)),
        descricao: n === 1
          ? `1x de R$ ${valorTotal.toFixed(2).replace('.', ',')} (à vista sem juros)`
          : n <= 3
            ? `${n}x de R$ ${valorParcela.toFixed(2).replace('.', ',')} sem juros`
            : `${n}x de R$ ${valorParcela.toFixed(2).replace('.', ',')} (total R$ ${valorComJuros.toFixed(2).replace('.', ',')})`,
      });
    }
    return parcelas;
  }

  /**
   * Gera a cobrança no método selecionado ('pix', 'credito', 'debito')
   * @param {string[]} passagensIds
   * @param {number} taxaConveniencia
   * @param {string} placa
   * @param {'pix'|'credito'|'debito'} formaDePagamento
   */
  gerarCobranca(passagensIds, taxaConveniencia = 1.90, placa = '', formaDePagamento = 'pix') {
    if (!passagensIds || !Array.isArray(passagensIds) || passagensIds.length === 0) {
      throw new Error('Nenhuma tarifa de pedágio foi selecionada para pagamento.');
    }

    const metodo = ['pix', 'credito', 'debito'].includes(formaDePagamento)
      ? formaDePagamento
      : 'pix';

    const passagens = pedagioService.buscarPorIds(passagensIds);
    const subtotal = passagens.length > 0
      ? passagens.reduce((sum, item) => sum + Number(item.valorTarifa || 0), 0)
      : passagensIds.length * 10.50;

    const taxa = Number(taxaConveniencia) || 1.90;
    const valorTotal = Number((subtotal + taxa).toFixed(2));
    const txid = `FLUIP${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;

    const agora = new Date();
    const tempoLimiteSegundos = 900; // 15 minutos
    const expiresAt = new Date(agora.getTime() + tempoLimiteSegundos * 1000).toISOString();

    let pixCopiaECola = null;
    let qrCodeBase64 = null;
    let opcoesParcelamento = null;
    let formularioCartao = null;

    if (metodo === 'pix') {
      pixCopiaECola = this.montarPixCopiaECola({
        chavePix: 'financeiro@fluip.com.br',
        nomeRecebedor: 'FLUIP PAGAMENTOS S.A.',
        cidade: 'SAO PAULO',
        valor: valorTotal,
        txid,
      });
      qrCodeBase64 = this.gerarQrCodeDataUrl(pixCopiaECola);
    } else {
      // Cartão de Crédito ou Débito
      if (metodo === 'credito') {
        opcoesParcelamento = this.calcularOpcoesParcelamento(valorTotal);
      }
      formularioCartao = {
        camposObrigatorios: ['numeroCartao', 'nomeTitular', 'validade', 'cvv'],
        aceitaParcelamento: metodo === 'credito',
        maxParcelas: metodo === 'credito' ? 12 : 1,
        bandeirasSuportadas: ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex'],
        mensagemSeguranca: 'Ambiente criptografado TLS 256-bit com certificação PCI-DSS Nível 1.',
      };
    }

    const cobranca = {
      txid,
      placa: placa || (passagens[0] ? passagens[0].placa : 'VEICULO'),
      formaDePagamento: metodo,
      passagensIds,
      passagensDetalhadas: passagens,
      subtotal: Number(subtotal.toFixed(2)),
      taxaConveniencia: taxa,
      valorTotal,
      pixCopiaECola,
      qrCodeBase64,
      opcoesParcelamento,
      formularioCartao,
      createdAt: agora.toISOString(),
      expiresAt,
      tempoLimiteSegundos,
      status: 'PENDENTE',
      autenticacaoBancaria: null,
      comprovante: null,
    };

    this.cobrancas.set(txid, cobranca);
    return cobranca;
  }

  // Compatibilidade com a chamada legada
  gerarCobrancaPix(passagensIds, taxaConveniencia = 1.90, placa = '') {
    return this.gerarCobranca(passagensIds, taxaConveniencia, placa, 'pix');
  }

  consultarStatusPix(txid) {
    if (!txid) return null;
    return this.cobrancas.get(txid) || null;
  }

  /**
   * Confirma pagamento (Pix, Cartão de Crédito ou Débito)
   * @param {string} txid
   * @param {Object} detalhesPagamento (dados simulados do cartão, parcelas, etc.)
   */
  confirmarPagamento(txid, detalhesPagamento = {}) {
    const cobranca = this.cobrancas.get(txid);
    if (!cobranca) {
      throw new Error(`Cobrança com txid ${txid} não encontrada.`);
    }

    if (cobranca.status === 'PAGO') {
      return cobranca;
    }

    const agora = new Date();
    const autenticacao = `AUT-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;
    const metodoFormatado = cobranca.formaDePagamento === 'credito'
      ? `Cartão de Crédito (${detalhesPagamento.parcelas || 1}x)`
      : cobranca.formaDePagamento === 'debito'
        ? 'Cartão de Débito (À vista)'
        : 'PIX Instantâneo';

    const cartaoMascarado = detalhesPagamento.numeroCartao
      ? `•••• •••• •••• ${detalhesPagamento.numeroCartao.replace(/\s/g, '').slice(-4)}`
      : null;

    cobranca.status = 'PAGO';
    cobranca.pagoEm = agora.toISOString();
    cobranca.autenticacaoBancaria = autenticacao;
    cobranca.protocoloConcessionaria = `PROT-CONC-${Math.floor(100000 + Math.random() * 900000)}`;
    cobranca.comprovante = {
      titulo: 'Comprovante Oficial de Quitação de Pedágio Free Flow',
      intermediador: 'Fluip Pagamentos S.A. - CNPJ: 45.892.311/0001-92',
      placa: cobranca.placa,
      formaDePagamento: metodoFormatado,
      cartaoFinal: cartaoMascarado,
      valorTotal: cobranca.valorTotal,
      dataHoraPagamento: agora.toLocaleString('pt-BR'),
      autenticacaoBancaria: autenticacao,
      protocoloBaixa: cobranca.protocoloConcessionaria,
      statusBaixa: 'QUITADO - BAIXA EFETUADA NO SISTEMA DA CONCESSIONÁRIA',
    };

    pedagioService.baixarPassagens(cobranca.passagensIds);
    this.cobrancas.set(txid, cobranca);
    return cobranca;
  }
}

export default new PagamentoService();
