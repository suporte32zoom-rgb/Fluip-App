/**
 * FLUIP - Lógica do Aplicativo Frontend PWA
 * Suporte Completo: Placas Mercosul (ABC1D23) e Antigas (ABC-1234)
 * Múltiplas Formas de Pagamento (PIX, Cartão de Crédito e Débito)
 * Taxa de Conveniência: R$ 1,90
 */

(function () {
  'use strict';

  const state = {
    placaAtual: '',
    debitos: [],
    debitosSelecionadosIds: new Set(),
    taxaConvenienciaPadrao: 1.90,
    formaPagamentoSelecionada: 'pix', // 'pix' | 'credito' | 'debito'
    tipoPlacaDetectada: 'neutro', // 'mercosul' | 'antiga' | 'neutro'
    cobrancaAtiva: null,
    timerInterval: null,
    pollInterval: null,
    segundosRestantes: 900,
    deferredPrompt: null,
  };

  const dom = {
    formConsulta: document.getElementById('formConsulta'),
    inputPlaca: document.getElementById('inputPlaca'),
    plateBox: document.getElementById('plateBox'),
    plateHeaderTitle: document.getElementById('plateHeaderTitle'),
    plateHeaderSubtitle: document.getElementById('plateHeaderSubtitle'),
    plateTypeBadge: document.getElementById('plateTypeBadge'),
    btnConsultar: document.getElementById('btnConsultar'),
    btnText: document.getElementById('btnText'),
    btnSpinner: document.getElementById('btnSpinner'),
    resultsSection: document.getElementById('resultsSection'),
    tollsList: document.getElementById('tollsList'),
    resultsCount: document.getElementById('resultsCount'),
    plateResultBadge: document.getElementById('plateResultBadge'),
    selectAllContainer: document.getElementById('selectAllContainer'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    
    // Resumo Fixo Inferior
    checkoutBar: document.getElementById('checkoutBar'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryTaxa: document.getElementById('summaryTaxa'),
    summaryTotal: document.getElementById('summaryTotal'),
    btnPagarPix: document.getElementById('btnPagarPix'),
    
    // Modal e Abas de Pagamento
    modalPix: document.getElementById('modalPix'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    tabBtnPix: document.getElementById('tabBtnPix'),
    tabBtnCredito: document.getElementById('tabBtnCredito'),
    tabBtnDebito: document.getElementById('tabBtnDebito'),
    tabContentPix: document.getElementById('tabContentPix'),
    tabContentCard: document.getElementById('tabContentCard'),
    
    // Elementos Pix
    pixTimer: document.getElementById('pixTimer'),
    qrCodeImage: document.getElementById('qrCodeImage'),
    inputPixCode: document.getElementById('inputPixCode'),
    btnCopyPix: document.getElementById('btnCopyPix'),
    btnSimulatePay: document.getElementById('btnSimulatePay'),
    
    // Elementos Cartão
    cardPreviewNumber: document.getElementById('cardPreviewNumber'),
    cardPreviewName: document.getElementById('cardPreviewName'),
    cardPreviewExpiry: document.getElementById('cardPreviewExpiry'),
    cardInputNumber: document.getElementById('cardInputNumber'),
    cardInputName: document.getElementById('cardInputName'),
    cardInputExpiry: document.getElementById('cardInputExpiry'),
    cardInputCvv: document.getElementById('cardInputCvv'),
    installmentsWrapper: document.getElementById('installmentsWrapper'),
    cardSelectInstallments: document.getElementById('cardSelectInstallments'),
    btnSubmitCardPayment: document.getElementById('btnSubmitCardPayment'),
    
    // Telas de Alternância
    pixCheckoutContent: document.getElementById('pixCheckoutContent'),
    pixSuccessContent: document.getElementById('pixSuccessContent'),
    
    // Comprovante
    receiptPlaca: document.getElementById('receiptPlaca'),
    receiptFormaPagamento: document.getElementById('receiptFormaPagamento'),
    receiptValor: document.getElementById('receiptValor'),
    receiptProtocolo: document.getElementById('receiptProtocolo'),
    receiptAutenticacao: document.getElementById('receiptAutenticacao'),
    receiptData: document.getElementById('receiptData'),
    btnNewSearch: document.getElementById('btnNewSearch'),
    
    // PWA & Conexão
    btnInstallPwa: document.getElementById('btnInstallPwa'),
    offlineBanner: document.getElementById('offlineBanner'),
    toast: document.getElementById('toast'),
    iosGuideModal: document.getElementById('iosGuideModal'),
    btnCloseIosGuide: document.getElementById('btnCloseIosGuide'),
  };

  function init() {
    registerServiceWorker();
    setupPwaInstall();
    setupNetworkListeners();
    setupEventListeners();
    setupDynamicPlateMask();
    setupCardFormHandlers();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('[Fluip PWA] Service Worker ativo:', reg.scope))
          .catch((err) => console.warn('[Fluip PWA] Erro ao registrar SW:', err));
      });
    }
  }

  function setupPwaInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone && dom.btnInstallPwa) {
      dom.btnInstallPwa.style.display = 'none';
      return;
    }

    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      if (dom.btnInstallPwa) dom.btnInstallPwa.style.display = 'inline-flex';
    });

    if (dom.btnInstallPwa) {
      dom.btnInstallPwa.addEventListener('click', async () => {
        if (state.deferredPrompt) {
          state.deferredPrompt.prompt();
          const { outcome } = await state.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            dom.btnInstallPwa.style.display = 'none';
            showToast('Fluip instalado com sucesso!');
          }
          state.deferredPrompt = null;
        } else if (isIOS && dom.iosGuideModal) {
          dom.iosGuideModal.style.display = 'flex';
        } else {
          showToast('Aplicativo pronto para uso na web!');
        }
      });
    }

    if (dom.btnCloseIosGuide) {
      dom.btnCloseIosGuide.addEventListener('click', () => {
        dom.iosGuideModal.style.display = 'none';
      });
    }
  }

  function setupNetworkListeners() {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) {
        if (dom.offlineBanner) dom.offlineBanner.style.display = 'flex';
      } else {
        if (dom.offlineBanner) dom.offlineBanner.style.display = 'none';
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  // ========================================================
  // MÁSCARA DINÂMICA: MERCOSUL (ABC1D23) E ANTIGA (ABC-1234)
  // ========================================================
  function setupDynamicPlateMask() {
    dom.inputPlaca.addEventListener('input', (e) => {
      let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Limitar tamanho bruto a 7 caracteres alfanuméricos
      if (raw.length > 7) {
        raw = raw.substring(0, 7);
      }

      let formatted = raw;
      let tipo = 'neutro';

      // Análise do padrão conforme caracteres digitados
      // 1. As 3 primeiras posições devem ser letras
      const letrasIniciais = raw.substring(0, 3).replace(/[^A-Z]/g, '');
      const char4 = raw[3] || '';
      const char5 = raw[4] || '';

      const isChar4Num = /[0-9]/.test(char4);
      const isChar5Num = /[0-9]/.test(char5);
      const isChar5Letter = /[A-Z]/.test(char5);

      if (raw.length >= 5) {
        if (isChar4Num && isChar5Letter) {
          // Padrão Mercosul: 3 letras, 1 número, 1 letra, 2 números (ex: ABC1D23)
          tipo = 'mercosul';
          formatted = raw; // Mercosul não leva hífen
        } else if (isChar4Num && isChar5Num) {
          // Padrão Tradicional/Antigo: 3 letras, 4 números (ex: ABC-1234)
          tipo = 'antiga';
          formatted = `${raw.substring(0, 3)}-${raw.substring(3)}`;
        }
      } else if (raw.length === 4 && isChar4Num) {
        tipo = 'neutro';
      }

      e.target.value = formatted;
      atualizarTemaVisualPlaca(tipo, raw);
    });

    // Chips com exemplos rápidos
    document.querySelectorAll('.chip-plate').forEach((chip) => {
      chip.addEventListener('click', () => {
        const placa = chip.getAttribute('data-placa');
        dom.inputPlaca.value = placa;
        
        // Simular evento input para atualizar tema
        const raw = placa.replace(/[^A-Z0-9]/g, '');
        const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(raw);
        atualizarTemaVisualPlaca(isMercosul ? 'mercosul' : 'antiga', raw);

        consultarDebitos(placa);
      });
    });
  }

  function atualizarTemaVisualPlaca(tipo, raw) {
    state.tipoPlacaDetectada = tipo;

    if (tipo === 'mercosul') {
      dom.plateBox.classList.remove('theme-antiga');
      dom.plateBox.classList.add('theme-mercosul');
      dom.plateHeaderTitle.textContent = 'MERCOSUL';
      dom.plateHeaderSubtitle.textContent = 'BRASIL';
      dom.plateTypeBadge.className = 'plate-badge-type badge-mercosul';
      dom.plateTypeBadge.innerHTML = '🇧🇷 Padrão Mercosul detectado';
    } else if (tipo === 'antiga') {
      dom.plateBox.classList.remove('theme-mercosul');
      dom.plateBox.classList.add('theme-antiga');
      dom.plateHeaderTitle.textContent = 'BRASIL • PADRÃO ANTERIOR';
      dom.plateHeaderSubtitle.textContent = 'BR';
      dom.plateTypeBadge.className = 'plate-badge-type badge-antiga';
      dom.plateTypeBadge.innerHTML = '🚗 Padrão Tradicional (Cinza)';
    } else {
      dom.plateBox.classList.remove('theme-antiga');
      dom.plateBox.classList.add('theme-mercosul');
      dom.plateHeaderTitle.textContent = 'BRASIL / MERCOSUL & ANTIGA';
      dom.plateHeaderSubtitle.textContent = 'BRASIL';
      dom.plateTypeBadge.className = 'plate-badge-type badge-neutral';
      dom.plateTypeBadge.textContent = raw.length === 0 ? 'Digite a placa veicular' : `${raw.length}/7 caracteres digitados`;
    }
  }

  function setupCardFormHandlers() {
    dom.cardInputNumber.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 16);
      let formatted = v.replace(/(\d{4})(?=\d)/g, '$1 ');
      e.target.value = formatted;
      dom.cardPreviewNumber.textContent = formatted || '•••• •••• •••• ••••';
    });

    dom.cardInputName.addEventListener('input', (e) => {
      const v = e.target.value.toUpperCase();
      e.target.value = v;
      dom.cardPreviewName.textContent = v || 'NOME COMPLETO';
    });

    dom.cardInputExpiry.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (v.length >= 2) {
        v = `${v.substring(0, 2)}/${v.substring(2)}`;
      }
      e.target.value = v;
      dom.cardPreviewExpiry.textContent = v || 'MM/AA';
    });

    dom.cardInputCvv.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    });

    dom.cardSelectInstallments.addEventListener('change', () => {
      atualizarBotaoPagarCartao();
    });

    dom.btnSubmitCardPayment.addEventListener('click', processarPagamentoCartao);
  }

  function setupEventListeners() {
    dom.formConsulta.addEventListener('submit', (e) => {
      e.preventDefault();
      consultarDebitos(dom.inputPlaca.value.trim());
    });

    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.debitos.forEach((d) => state.debitosSelecionadosIds.add(d.id));
        } else {
          state.debitosSelecionadosIds.clear();
        }
        renderizarCards();
        atualizarResumoFinanceiro();
      });
    }

    dom.btnPagarPix.addEventListener('click', () => {
      iniciarCheckout(state.formaPagamentoSelecionada);
    });

    dom.btnCloseModal.addEventListener('click', fecharModalPix);
    dom.modalPix.addEventListener('click', (e) => {
      if (e.target === dom.modalPix) fecharModalPix();
    });

    [dom.tabBtnPix, dom.tabBtnCredito, dom.tabBtnDebito].forEach((btn) => {
      btn.addEventListener('click', () => {
        const metodo = btn.getAttribute('data-method');
        alternarFormaPagamento(metodo);
      });
    });

    dom.btnCopyPix.addEventListener('click', copiarChavePix);
    dom.btnSimulatePay.addEventListener('click', simularPagamentoBanco);

    if (dom.btnNewSearch) {
      dom.btnNewSearch.addEventListener('click', () => {
        fecharModalPix();
        dom.inputPlaca.value = '';
        atualizarTemaVisualPlaca('neutro', '');
        dom.resultsSection.style.display = 'none';
        dom.checkoutBar.style.display = 'none';
        dom.inputPlaca.focus();
      });
    }
  }

  function alternarFormaPagamento(metodo) {
    state.formaPagamentoSelecionada = metodo;

    dom.tabBtnPix.classList.toggle('active', metodo === 'pix');
    dom.tabBtnCredito.classList.toggle('active', metodo === 'credito');
    dom.tabBtnDebito.classList.toggle('active', metodo === 'debito');

    if (metodo === 'pix') {
      dom.tabContentPix.style.display = 'block';
      dom.tabContentCard.style.display = 'none';
    } else {
      dom.tabContentPix.style.display = 'none';
      dom.tabContentCard.style.display = 'block';

      if (metodo === 'credito') {
        dom.installmentsWrapper.style.display = 'block';
      } else {
        dom.installmentsWrapper.style.display = 'none';
      }

      atualizarBotaoPagarCartao();
    }

    iniciarCheckout(metodo, false);
  }

  function atualizarBotaoPagarCartao() {
    const total = state.cobrancaAtiva?.valorTotal || calcularTotalAtual();
    const metodo = state.formaPagamentoSelecionada;

    if (metodo === 'credito') {
      const parcelaTexto = dom.cardSelectInstallments.options[dom.cardSelectInstallments.selectedIndex]?.text || '';
      dom.btnSubmitCardPayment.textContent = `Confirmar Pagamento (${parcelaTexto || 'R$ ' + total.toFixed(2).replace('.', ',')})`;
    } else {
      dom.btnSubmitCardPayment.textContent = `Pagar R$ ${total.toFixed(2).replace('.', ',')} no Débito (À vista)`;
    }
  }

  function calcularTotalAtual() {
    const selecionados = state.debitos.filter((d) => state.debitosSelecionadosIds.has(d.id));
    const subtotal = selecionados.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    const taxa = selecionados.length > 0 ? state.taxaConvenienciaPadrao : 0;
    return subtotal + taxa;
  }

  async function consultarDebitos(placa) {
    const limpa = (placa || '').replace(/[^A-Z0-9]/gi, '');
    if (limpa.length < 7) {
      showToast('Digite uma placa válida com 7 caracteres (ex: ABC1D23 ou ABC-1234).');
      dom.inputPlaca.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/v1/consultar?placa=${encodeURIComponent(limpa)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro na consulta.');
      }

      state.placaAtual = data.placa;
      state.debitos = data.debitos || [];
      state.taxaConvenienciaPadrao = data.resumo?.taxaConveniencia || 1.90;
      state.debitosSelecionadosIds = new Set(state.debitos.map((d) => d.id));

      exibirResultados();
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    dom.btnConsultar.disabled = loading;
    dom.btnText.style.display = loading ? 'none' : 'inline';
    dom.btnSpinner.style.display = loading ? 'block' : 'none';
  }

  function exibirResultados() {
    dom.resultsSection.style.display = 'block';
    dom.plateResultBadge.textContent = state.placaAtual;
    dom.resultsCount.textContent = `${state.debitos.length} passagem(ns)`;

    if (state.debitos.length === 0) {
      dom.tollsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🎉</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Nenhum débito encontrado</h3>
          <p style="font-size: 0.825rem; color: #64748b;">Esta placa está 100% em dia com os pedágios Free Flow!</p>
        </div>
      `;
      dom.checkoutBar.style.display = 'none';
      dom.selectAllContainer.style.display = 'none';
      return;
    }

    dom.selectAllContainer.style.display = 'flex';
    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.checked = state.debitosSelecionadosIds.size === state.debitos.length;
    }

    renderizarCards();
    atualizarResumoFinanceiro();
    dom.checkoutBar.style.display = 'block';
    dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderizarCards() {
    dom.tollsList.innerHTML = '';

    state.debitos.forEach((debito) => {
      const isSelected = state.debitosSelecionadosIds.has(debito.id);
      const card = document.createElement('div');
      card.className = `toll-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute('data-id', debito.id);

      card.innerHTML = `
        <div class="toll-card-checkbox">
          <div class="custom-checkbox">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
            </svg>
          </div>
        </div>
        <div class="toll-card-info">
          <div class="toll-card-top">
            <span class="concessionaire-name">${debito.concessionaria}</span>
            <span class="toll-amount">R$ ${debito.valorTarifa.toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="portico-location">${debito.portico} • ${debito.sentido}</div>
          <div class="toll-meta">
            <span class="toll-date">🕒 ${debito.dataHoraFormatada}</span>
            <span class="evasion-warning">⚠️ Limite: ${debito.dataLimiteFormatada} (${debito.diasRestantes}d)</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        toggleDebitoSelecao(debito.id);
      });

      dom.tollsList.appendChild(card);
    });
  }

  function toggleDebitoSelecao(id) {
    if (state.debitosSelecionadosIds.has(id)) {
      state.debitosSelecionadosIds.delete(id);
    } else {
      state.debitosSelecionadosIds.add(id);
    }

    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.checked = state.debitosSelecionadosIds.size === state.debitos.length;
    }

    renderizarCards();
    atualizarResumoFinanceiro();
  }

  function atualizarResumoFinanceiro() {
    const selecionados = state.debitos.filter((d) => state.debitosSelecionadosIds.has(d.id));
    const qtd = selecionados.length;
    const subtotal = selecionados.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    // Taxa de R$ 1,90
    const taxa = qtd > 0 ? state.taxaConvenienciaPadrao : 0;
    const total = subtotal + taxa;

    dom.summarySubtotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    dom.summaryTaxa.textContent = `R$ ${taxa.toFixed(2).replace('.', ',')}`;
    dom.summaryTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    dom.btnPagarPix.disabled = qtd === 0;
    dom.btnPagarPix.innerHTML = qtd === 0
      ? 'Selecione uma tarifa'
      : `Pagar R$ ${total.toFixed(2).replace('.', ',')} • PIX / Cartão`;
  }

  async function iniciarCheckout(formaDePagamento = 'pix', abrirModal = true) {
    const passagensIds = Array.from(state.debitosSelecionadosIds);
    if (passagensIds.length === 0) {
      showToast('Selecione pelo menos um pedágio para pagar.');
      return;
    }

    try {
      const response = await fetch('/api/v1/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: state.placaAtual,
          passagensIds,
          formaDePagamento,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao preparar cobrança.');
      }

      state.cobrancaAtiva = data;

      if (data.qrCodeBase64) dom.qrCodeImage.src = data.qrCodeBase64;
      if (data.pixCopiaECola) dom.inputPixCode.value = data.pixCopiaECola;

      if (data.opcoesParcelamento && Array.isArray(data.opcoesParcelamento)) {
        dom.cardSelectInstallments.innerHTML = '';
        data.opcoesParcelamento.forEach((op) => {
          const option = document.createElement('option');
          option.value = op.numero;
          option.textContent = op.descricao;
          dom.cardSelectInstallments.appendChild(option);
        });
      }

      atualizarBotaoPagarCartao();

      if (abrirModal) {
        abrirModalCheckout(data);
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  function abrirModalCheckout(cobranca) {
    dom.pixCheckoutContent.style.display = 'block';
    dom.pixSuccessContent.style.display = 'none';

    dom.btnCopyPix.classList.remove('copied');
    dom.btnCopyPix.innerHTML = 'Copiar PIX';

    state.segundosRestantes = cobranca.tempoLimiteSegundos || 900;
    atualizarDisplayTimer();
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.segundosRestantes--;
      atualizarDisplayTimer();
      if (state.segundosRestantes <= 0) {
        clearInterval(state.timerInterval);
        showToast('Tempo limite de pagamento expirado. Gere uma nova cobrança.');
        fecharModalPix();
      }
    }, 1000);

    iniciarPollingStatus(cobranca.txid);
    dom.modalPix.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function fecharModalPix() {
    dom.modalPix.classList.remove('open');
    document.body.style.overflow = '';
    clearInterval(state.timerInterval);
    clearInterval(state.pollInterval);
  }

  function atualizarDisplayTimer() {
    const minutos = Math.floor(state.segundosRestantes / 60);
    const segundos = state.segundosRestantes % 60;
    dom.pixTimer.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }

  async function copiarChavePix() {
    const codigo = dom.inputPixCode.value;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        dom.inputPixCode.select();
        document.execCommand('copy');
      }
      dom.btnCopyPix.classList.add('copied');
      dom.btnCopyPix.innerHTML = '✓ Copiado!';
      showToast('Código PIX Copia e Cola copiado com sucesso!');
    } catch {
      showToast('Falha ao copiar automaticamente.');
    }
  }

  function iniciarPollingStatus(txid) {
    clearInterval(state.pollInterval);
    state.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/status/${txid}`);
        const data = await response.json();
        if (data.success && data.status === 'PAGO') {
          clearInterval(state.pollInterval);
          clearInterval(state.timerInterval);
          exibirSucessoPagamento(data);
        }
      } catch (e) {
        console.warn('Checagem de status:', e);
      }
    }, 3000);
  }

  async function simularPagamentoBanco() {
    if (!state.cobrancaAtiva?.txid) return;

    dom.btnSimulatePay.disabled = true;
    dom.btnSimulatePay.textContent = 'Processando no Banco Central...';

    try {
      const response = await fetch(`/api/v1/simular-pagamento/${state.cobrancaAtiva.txid}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao simular quitação.');
      }

      clearInterval(state.pollInterval);
      clearInterval(state.timerInterval);
      exibirSucessoPagamento(data.cobranca);
      showToast('Pagamento Pix confirmado!');
    } catch (e) {
      showToast(e.message);
    } finally {
      dom.btnSimulatePay.disabled = false;
      dom.btnSimulatePay.textContent = '⚡ Simular Pagamento Instantâneo PIX (Demo)';
    }
  }

  async function processarPagamentoCartao() {
    if (!state.cobrancaAtiva?.txid) return;

    const num = dom.cardInputNumber.value.trim();
    const nome = dom.cardInputName.value.trim();
    const exp = dom.cardInputExpiry.value.trim();
    const cvv = dom.cardInputCvv.value.trim();
    const parcelas = Number(dom.cardSelectInstallments.value) || 1;

    if (!num || num.length < 15) {
      showToast('Por favor, informe um número de cartão válido.');
      dom.cardInputNumber.focus();
      return;
    }

    if (!nome) {
      showToast('Por favor, informe o nome impresso no cartão.');
      dom.cardInputName.focus();
      return;
    }

    if (!exp || exp.length < 5) {
      showToast('Informe a validade no formato MM/AA.');
      dom.cardInputExpiry.focus();
      return;
    }

    if (!cvv || cvv.length < 3) {
      showToast('Informe o código de segurança (CVV).');
      dom.cardInputCvv.focus();
      return;
    }

    dom.btnSubmitCardPayment.disabled = true;
    dom.btnSubmitCardPayment.textContent = 'Processando com a adquirente...';

    try {
      const response = await fetch('/api/v1/pagar-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txid: state.cobrancaAtiva.txid,
          numeroCartao: num,
          nomeTitular: nome,
          validade: exp,
          cvv,
          parcelas: state.formaPagamentoSelecionada === 'credito' ? parcelas : 1,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Transação com cartão não autorizada.');
      }

      clearInterval(state.pollInterval);
      clearInterval(state.timerInterval);
      exibirSucessoPagamento(data.cobranca);
      showToast('Pagamento com cartão aprovado com sucesso!');
    } catch (e) {
      showToast(e.message);
    } finally {
      dom.btnSubmitCardPayment.disabled = false;
      atualizarBotaoPagarCartao();
    }
  }

  function exibirSucessoPagamento(cobranca) {
    dom.pixCheckoutContent.style.display = 'none';
    dom.pixSuccessContent.style.display = 'block';

    dom.receiptPlaca.textContent = cobranca.placa || state.placaAtual;
    dom.receiptFormaPagamento.textContent = cobranca.comprovante?.formaDePagamento || (
      state.formaPagamentoSelecionada === 'credito' ? 'Cartão de Crédito' :
      state.formaPagamentoSelecionada === 'debito' ? 'Cartão de Débito' : 'PIX Instantâneo'
    );
    dom.receiptValor.textContent = `R$ ${Number(cobranca.valorTotal || state.cobrancaAtiva.valorTotal).toFixed(2).replace('.', ',')}`;
    dom.receiptProtocolo.textContent = cobranca.protocoloConcessionaria || `PROT-${Math.floor(100000 + Math.random() * 900000)}`;
    dom.receiptAutenticacao.textContent = cobranca.autenticacaoBancaria || `AUT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    dom.receiptData.textContent = new Date().toLocaleString('pt-BR');

    const pagosIds = new Set(state.cobrancaAtiva.passagensIds || []);
    state.debitos = state.debitos.filter((d) => !pagosIds.has(d.id));
    state.debitosSelecionadosIds.clear();

    exibirResultados();
  }

  let toastTimeout;
  function showToast(mensagem) {
    if (!dom.toast) return;
    dom.toast.textContent = mensagem;
    dom.toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
