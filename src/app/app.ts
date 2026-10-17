import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';

export interface DebitoPedagioItem {
  id: string;
  placa: string;
  concessionaria: string;
  rodovia: string;
  portico: string;
  sentido: string;
  categoriaVeiculo: string;
  dataHora: string;
  dataHoraFormatada: string;
  valorTarifa: number;
  dataLimiteInfracao: string;
  dataLimiteFormatada: string;
  diasRestantes: number;
  status: 'PENDENTE' | 'PAGO';
}

export interface OpcaoParcelaItem {
  numero: number;
  valorParcela: number;
  valorTotalComJuros: number;
  descricao: string;
}

export interface CobrancaPixResposta {
  success: boolean;
  txid: string;
  placa: string;
  formaDePagamento?: 'pix' | 'credito' | 'debito';
  passagensIds?: string[];
  pixCopiaECola?: string | null;
  qrCodeBase64?: string | null;
  opcoesParcelamento?: OpcaoParcelaItem[] | null;
  valorTotal: number;
  resumo: {
    passagensQuantidade: number;
    subtotal: number;
    taxaConveniencia: number;
    totalGeral: number;
  };
  expiresAt: string;
  tempoLimiteSegundos: number;
  status: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private http = inject(HttpClient);

  // Form Control para a Placa (aceita 7 ou 8 caracteres com hífen)
  placaControl = new FormControl('', [
    Validators.required,
    Validators.minLength(7),
    Validators.maxLength(8),
  ]);

  // Form Controls para o Cartão
  cartaoNumeroControl = new FormControl('', [Validators.required]);
  cartaoNomeControl = new FormControl('', [Validators.required]);
  cartaoValidadeControl = new FormControl('', [Validators.required]);
  cartaoCvvControl = new FormControl('', [Validators.required]);
  cartaoParcelaControl = new FormControl(1);

  // Sinais de Estado
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successToast = signal<string | null>(null);
  
  placaPesquisada = signal<string>('');
  debitos = signal<DebitoPedagioItem[]>([]);
  selecionadosIds = signal<Set<string>>(new Set());
  taxaConveniencia = signal<number>(1.90);

  // Tipo de Placa Detectada: 'mercosul' | 'antiga' | 'neutro'
  tipoPlaca = signal<'mercosul' | 'antiga' | 'neutro'>('neutro');

  // Forma de pagamento ativa no checkout
  formaPagamento = signal<'pix' | 'credito' | 'debito'>('pix');

  // Modal e Cobrança
  modalPixAberto = signal(false);
  cobrancaAtiva = signal<CobrancaPixResposta | null>(null);
  pixCopiado = signal(false);
  segundosRestantes = signal(900);
  pagamentoConcluido = signal(false);
  dadosComprovante = signal<{
    placa: string;
    formaPagamento: string;
    valorTotal: number;
    protocolo: string;
    autenticacao: string;
    dataHora: string;
  } | null>(null);

  // PWA Install prompt
  pwaInstallEvent = signal<Event | null>(null);
  showIosGuide = signal(false);

  // Estado Computado do Resumo Financeiro
  debitosSelecionados = computed(() => {
    const ids = this.selecionadosIds();
    return this.debitos().filter((d) => ids.has(d.id));
  });

  subtotal = computed(() => {
    return this.debitosSelecionados().reduce((acc, curr) => acc + curr.valorTarifa, 0);
  });

  taxaCalculada = computed(() => {
    return this.debitosSelecionados().length > 0 ? this.taxaConveniencia() : 0;
  });

  totalGeral = computed(() => {
    return this.subtotal() + this.taxaCalculada();
  });

  todosSelecionados = computed(() => {
    const todos = this.debitos();
    return todos.length > 0 && this.selecionadosIds().size === todos.length;
  });

  tempoFormatado = computed(() => {
    const sec = this.segundosRestantes();
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${String(min).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  });

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.pwaInstallEvent.set(e);
      });
    }
  }

  formatarPlacaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (raw.length > 7) {
      raw = raw.substring(0, 7);
    }

    let formatted = raw;
    let tipo: 'mercosul' | 'antiga' | 'neutro' = 'neutro';

    const char4 = raw[3] || '';
    const char5 = raw[4] || '';

    const isChar4Num = /[0-9]/.test(char4);
    const isChar5Num = /[0-9]/.test(char5);
    const isChar5Letter = /[A-Z]/.test(char5);

    if (raw.length >= 5) {
      if (isChar4Num && isChar5Letter) {
        // Mercosul: ABC1D23
        tipo = 'mercosul';
        formatted = raw;
      } else if (isChar4Num && isChar5Num) {
        // Tradicional: ABC-1234
        tipo = 'antiga';
        formatted = `${raw.substring(0, 3)}-${raw.substring(3)}`;
      }
    }

    this.tipoPlaca.set(tipo);
    this.placaControl.setValue(formatted, { emitEvent: false });
  }

  formatarCartaoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const limpo = input.value.replace(/\D/g, '').substring(0, 16);
    const formatado = limpo.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.cartaoNumeroControl.setValue(formatado, { emitEvent: false });
  }

  formatarValidadeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 2) {
      v = `${v.substring(0, 2)}/${v.substring(2)}`;
    }
    this.cartaoValidadeControl.setValue(v, { emitEvent: false });
  }

  formatarCvvInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const v = input.value.replace(/\D/g, '').substring(0, 4);
    this.cartaoCvvControl.setValue(v, { emitEvent: false });
  }

  usarPlacaExemplo(placa: string) {
    this.placaControl.setValue(placa);
    const raw = placa.replace(/[^A-Z0-9]/gi, '');
    const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(raw);
    this.tipoPlaca.set(isMercosul ? 'mercosul' : 'antiga');
    this.consultarDebitos();
  }

  consultarDebitos() {
    const valorBruto = (this.placaControl.value || '').trim().toUpperCase();
    const limpa = valorBruto.replace(/[^A-Z0-9]/gi, '');
    if (limpa.length < 7) {
      this.mostrarToast('Digite uma placa válida com 7 caracteres (ex: ABC1D23 ou ABC-1234).');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.http.get<{ success: boolean; placa: string; debitos: DebitoPedagioItem[]; resumo: { taxaConveniencia: number } }>(
      `/api/v1/consultar?placa=${encodeURIComponent(limpa)}`
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.placaPesquisada.set(res.placa);
          this.debitos.set(res.debitos);
          this.taxaConveniencia.set(res.resumo?.taxaConveniencia || 1.90);
          this.selecionadosIds.set(new Set(res.debitos.map((d) => d.id)));
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.error || 'Erro ao consultar placa. Verifique os dados digitados.';
        this.errorMessage.set(msg);
        this.mostrarToast(msg);
      },
    });
  }

  toggleSelecao(id: string) {
    const atuais = new Set(this.selecionadosIds());
    if (atuais.has(id)) {
      atuais.delete(id);
    } else {
      atuais.add(id);
    }
    this.selecionadosIds.set(atuais);
  }

  toggleSelecionarTodos() {
    if (this.todosSelecionados()) {
      this.selecionadosIds.set(new Set());
    } else {
      this.selecionadosIds.set(new Set(this.debitos().map((d) => d.id)));
    }
  }

  selecionarMetodoPagamento(metodo: 'pix' | 'credito' | 'debito') {
    this.formaPagamento.set(metodo);
    this.iniciarCheckout(metodo);
  }

  iniciarCheckout(metodo: 'pix' | 'credito' | 'debito' = this.formaPagamento()) {
    const ids = Array.from(this.selecionadosIds());
    if (ids.length === 0) {
      this.mostrarToast('Selecione ao menos um pedágio para efetuar o pagamento.');
      return;
    }

    this.loading.set(true);

    this.http.post<CobrancaPixResposta>('/api/v1/pagar', {
      placa: this.placaPesquisada(),
      passagensIds: ids,
      formaDePagamento: metodo,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.cobrancaAtiva.set(res);
          this.abrirModalPix(res);
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.error || 'Erro ao preparar cobrança.';
        this.mostrarToast(msg);
      },
    });
  }

  abrirModalPix(cobranca: CobrancaPixResposta) {
    this.modalPixAberto.set(true);
    this.pagamentoConcluido.set(false);
    this.pixCopiado.set(false);
    this.segundosRestantes.set(cobranca.tempoLimiteSegundos || 900);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const atual = this.segundosRestantes() - 1;
      this.segundosRestantes.set(atual);
      if (atual <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.mostrarToast('Prazo de 15 minutos expirado. Gere uma nova cobrança.');
        this.fecharModalPix();
      }
    }, 1000);

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.verificarStatusPix(cobranca.txid);
    }, 3000);
  }

  fecharModalPix() {
    this.modalPixAberto.set(false);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  verificarStatusPix(txid: string) {
    this.http.get<{ success: boolean; status: string; autenticacaoBancaria?: string; protocoloConcessionaria?: string; comprovante?: { formaDePagamento?: string } }>(
      `/api/v1/status/${txid}`
    ).subscribe({
      next: (res) => {
        if (res.success && res.status === 'PAGO') {
          this.confirmarSucesso(res.protocoloConcessionaria, res.autenticacaoBancaria, res.comprovante?.formaDePagamento);
        }
      },
      error: (err) => {
        console.warn('Status poll:', err);
      },
    });
  }

  simularPagamentoInstantaneo() {
    const cobranca = this.cobrancaAtiva();
    if (!cobranca) return;

    this.loading.set(true);
    this.http.post<{ success: boolean; cobranca: { protocoloConcessionaria: string; autenticacaoBancaria: string; comprovante?: { formaDePagamento?: string } } }>(
      `/api/v1/simular-pagamento/${cobranca.txid}`,
      {}
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.confirmarSucesso(res.cobranca.protocoloConcessionaria, res.cobranca.autenticacaoBancaria, 'PIX Instantâneo');
          this.mostrarToast('Pagamento confirmado e baixa registrada!');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarToast(err.error?.error || 'Erro ao simular quitação.');
      },
    });
  }

  processarPagamentoCartao() {
    const cobranca = this.cobrancaAtiva();
    if (!cobranca) return;

    const num = (this.cartaoNumeroControl.value || '').trim();
    const nome = (this.cartaoNomeControl.value || '').trim();
    const val = (this.cartaoValidadeControl.value || '').trim();
    const cvv = (this.cartaoCvvControl.value || '').trim();
    const parcelas = Number(this.cartaoParcelaControl.value) || 1;

    if (!num || num.length < 15) {
      this.mostrarToast('Informe um número de cartão válido.');
      return;
    }
    if (!nome) {
      this.mostrarToast('Informe o nome impresso no cartão.');
      return;
    }
    if (!val || val.length < 5) {
      this.mostrarToast('Informe a validade no formato MM/AA.');
      return;
    }
    if (!cvv || cvv.length < 3) {
      this.mostrarToast('Informe o código de segurança (CVV).');
      return;
    }

    this.loading.set(true);
    this.http.post<{ success: boolean; cobranca: { protocoloConcessionaria: string; autenticacaoBancaria: string; comprovante?: { formaDePagamento?: string } } }>(
      '/api/v1/pagar-cartao',
      {
        txid: cobranca.txid,
        numeroCartao: num,
        nomeTitular: nome,
        validade: val,
        cvv,
        parcelas: this.formaPagamento() === 'credito' ? parcelas : 1,
      }
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          const desc = this.formaPagamento() === 'credito'
            ? `Cartão de Crédito (${parcelas}x)`
            : 'Cartão de Débito (À vista)';
          this.confirmarSucesso(res.cobranca.protocoloConcessionaria, res.cobranca.autenticacaoBancaria, desc);
          this.mostrarToast('Pagamento com cartão autorizado e débitos quitados!');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarToast(err.error?.error || 'Erro ao processar cartão.');
      },
    });
  }

  private confirmarSucesso(protocolo?: string, autenticacao?: string, forma?: string) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);

    const cobranca = this.cobrancaAtiva();
    this.dadosComprovante.set({
      placa: cobranca?.placa || this.placaPesquisada(),
      formaPagamento: forma || (this.formaPagamento() === 'credito' ? 'Cartão de Crédito' : this.formaPagamento() === 'debito' ? 'Cartão de Débito' : 'PIX Instantâneo'),
      valorTotal: cobranca?.valorTotal || this.totalGeral(),
      protocolo: protocolo || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      autenticacao: autenticacao || `AUT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      dataHora: new Date().toLocaleString('pt-BR'),
    });

    this.pagamentoConcluido.set(true);

    const idsPagos = new Set(cobranca?.passagensIds || []);
    const restantes = this.debitos().filter((d) => !idsPagos.has(d.id));
    this.debitos.set(restantes);
    this.selecionadosIds.set(new Set());
  }

  copiarChavePix() {
    const codigo = this.cobrancaAtiva()?.pixCopiaECola || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(codigo).then(() => {
        this.pixCopiado.set(true);
        this.mostrarToast('Código PIX Copia e Cola copiado com sucesso!');
        setTimeout(() => this.pixCopiado.set(false), 3000);
      });
    }
  }

  instalarPwa() {
    const promptEvent = this.pwaInstallEvent() as { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> } | null;
    if (promptEvent && promptEvent.prompt) {
      promptEvent.prompt();
      if (promptEvent.userChoice) {
        promptEvent.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            this.pwaInstallEvent.set(null);
            this.mostrarToast('Fluip instalado com sucesso!');
          }
        });
      }
    } else {
      this.showIosGuide.set(true);
    }
  }

  novaConsulta() {
    this.fecharModalPix();
    this.placaControl.setValue('');
    this.tipoPlaca.set('neutro');
    this.placaPesquisada.set('');
    this.debitos.set([]);
    this.selecionadosIds.set(new Set());
  }

  mostrarToast(msg: string) {
    this.successToast.set(msg);
    setTimeout(() => {
      this.successToast.set(null);
    }, 3500);
  }
}
