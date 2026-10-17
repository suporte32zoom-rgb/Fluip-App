export interface CobrancaPix {
  txid: string;
  placa: string;
  passagensIds: string[];
  passagensDetalhadas: unknown[];
  subtotal: number;
  taxaConveniencia: number;
  valorTotal: number;
  pixCopiaECola: string;
  qrCodeBase64: string;
  createdAt: string;
  expiresAt: string;
  tempoLimiteSegundos: number;
  status: 'PENDENTE' | 'PAGO' | 'EXPIRADO';
  autenticacaoBancaria: string | null;
  protocoloConcessionaria?: string;
  comprovante: unknown;
  pagoEm?: string;
}

declare class PagamentoService {
  gerarCobrancaPix(passagensIds: string[], taxaConveniencia?: number, placa?: string): CobrancaPix;
  consultarStatusPix(txid: string): CobrancaPix | null;
  confirmarPagamento(txid: string): CobrancaPix;
}

declare const pagamentoService: PagamentoService;
export default pagamentoService;
