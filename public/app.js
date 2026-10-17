/**
 * FLUIP - Lógica do Aplicativo Frontend PWA
 * Consulta de Pedágio Free Flow por Placa e Checkout Pix Instantâneo
 */

(function () {
  'use strict';

  // Estado da Aplicação
  const state = {
    placaAtual: '',
    debitos: [],
    debitosSelecionadosIds: new Set(),
    taxaConvenienciaPadrao: 2.50,
    cobrancaAtiva: null,
    timerInterval: null,
    pollInterval: null,
    segundosRestantes: 900,
    deferredPrompt: null,
  };

  // Elementos do DOM
  const dom = {
    formConsulta: document.getElementById('formConsulta'),
    inputPlaca: document.getElementById('inputPlaca'),
    btnConsultar: document.getElementById('btnConsultar'),
    btnText: document.getElementById('btnText'),
    btnSpinner: document.getElementById('btnSpinner'),
    resultsSection: document.getElementById('resultsSection'),
    tollsList: document.getElementById('tollsList'),
    resultsCount: document.getElementById('resultsCount'),
    plateResultBadge: document.getElementById('plateResultBadge'),
    selectAllContainer: document.getElementById('selectAllContainer'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    
    // Barra de Checkout
    checkoutBar: document.getElementById('checkoutBar'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryTaxa: document.getElementById('summaryTaxa'),
    summaryTotal: document.getElementById('summaryTotal'),
    btnPagarPix: document.getElementById('btnPagarPix'),
    
    // Modal Pix
    modalPix: document.getElementById('modalPix'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    pixTimer: document.getElementById('pixTimer'),
    qrCodeImage: document.getElementById('qrCodeImage'),
    inputPixCode: document.getElementById('inputPixCode'),
    btnCopyPix: document.getElementById('btnCopyPix'),
    btnSimulatePay: document.getElementById('btnSimulatePay'),
    pixCheckoutContent: document.getElementById('pixCheckoutContent'),
    pixSuccessContent: document.getElementById('pixSuccessContent'),
    
    // Dados do Comprovante
    receiptPlaca: document.getElementById('receiptPlaca'),
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

  // ========================================================
  // 1. INICIALIZAÇÃO & PWA SERVICE WORKER
  // ========================================================
  function init() {
    registerServiceWorker();
    setupPwaInstall();
    setupNetworkListeners();
    setupEventListeners();
    setupPlateMask();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('[Fluip PWA] Service Worker registrado:', reg.scope))
          .catch((err) => console.warn('[Fluip PWA] Erro ao registrar SW:', err));
      });
    }
  }

  function setupPwaInstall() {
    // Detectar se já está instalado em modo standalone
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
  // 2. MÁSCARA E FORMATAÇÃO DA PLACA VEICULAR
  // ========================================================
  function setupPlateMask() {
    dom.inputPlaca.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Limitar a 7 caracteres alfanuméricos
      if (value.length > 7) {
        value = value.substring(0, 7);
      }

      e.target.value = value;
    });

    // Permitir cliques nos chips de placas sugeridas
    document.querySelectorAll('.chip-plate').forEach((chip) => {
      chip.addEventListener('click', () => {
        const placa = chip.getAttribute('data-placa');
        dom.inputPlaca.value = placa;
        consultarDebitos(placa);
      });
    });
  }

  // ========================================================
  // 3. CONSULTA DE DÉBITOS NA API
  // ========================================================
  function setupEventListeners() {
    dom.formConsulta.addEventListener('submit', (e) => {
      e.preventDefault();
      const placa = dom.inputPlaca.value.trim();
      consultarDebitos(placa);
    });

    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked) {
          state.debitos.forEach((d) => state.debitosSelecionadosIds.add(d.id));
        } else {
          state.debitosSelecionadosIds.clear();
        }
        renderizarCards();
        atualizarResumoFinanceiro();
      });
    }

    dom.btnPagarPix.addEventListener('click', gerarPagamentoPix);
    dom.btnCloseModal.addEventListener('click', fecharModalPix);
    dom.modalPix.addEventListener('click', (e) => {
      if (e.target === dom.modalPix) fecharModalPix();
    });

    dom.btnCopyPix.addEventListener('click', copiarChavePix);
    dom.btnSimulatePay.addEventListener('click', simularPagamentoBanco);

    if (dom.btnNewSearch) {
      dom.btnNewSearch.addEventListener('click', () => {
        fecharModalPix();
        dom.inputPlaca.value = '';
        dom.resultsSection.style.display = 'none';
        dom.checkoutBar.style.display = 'none';
        dom.inputPlaca.focus();
      });
    }
  }

  async function consultarDebitos(placa) {
    if (!placa || placa.length < 7) {
      showToast('Digite uma placa válida com 7 caracteres.');
      dom.inputPlaca.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/v1/consultar?placa=${encodeURIComponent(placa)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível consultar os débitos para esta placa.');
      }

      state.placaAtual = data.placa;
      state.debitos = data.debitos || [];
      state.taxaConvenienciaPadrao = data.resumo?.taxaConveniencia || 2.50;

      // Por padrão, seleciona todos os débitos pendentes
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
    if (loading) {
      dom.btnText.style.display = 'none';
      dom.btnSpinner.style.display = 'block';
    } else {
      dom.btnText.style.display = 'inline';
      dom.btnSpinner.style.display = 'none';
    }
  }

  // ========================================================
  // 4. RENDERIZAÇÃO DOS CARDS E RESUMO FINANCEIRO
  // ========================================================
  function exibirResultados() {
    dom.resultsSection.style.display = 'block';
    dom.plateResultBadge.textContent = state.placaAtual;
    dom.resultsCount.textContent = `${state.debitos.length} passagem(ns)`;

    if (state.debitos.length === 0) {
      dom.tollsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🎉</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Nenhum débito encontrado</h3>
          <p style="font-size: 0.825rem; color: #64748b;">Esta placa está 100% em dia com os pedágios automáticos Free Flow!</p>
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

    // Rolar suavemente até a lista
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
            <span class="toll-date">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                <path stroke-width="2" d="M12 6v6l4 2"></path>
              </svg>
              ${debito.dataHoraFormatada}
            </span>
            <span class="evasion-warning">
              ⚠️ Quitar até ${debito.dataLimiteFormatada} (${debito.diasRestantes}d)
            </span>
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
    const taxa = qtd > 0 ? state.taxaConvenienciaPadrao : 0;
    const total = subtotal + taxa;

    dom.summarySubtotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    dom.summaryTaxa.textContent = `R$ ${taxa.toFixed(2).replace('.', ',')}`;
    dom.summaryTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    dom.btnPagarPix.disabled = qtd === 0;
    if (qtd === 0) {
      dom.btnPagarPix.textContent = 'Selecione uma tarifa';
    } else {
      dom.btnPagarPix.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Pagar R$ ${total.toFixed(2).replace('.', ',')} via PIX
      `;
    }
  }

  // ========================================================
  // 5. CHECKOUT PIX & WEBSOCKET/POLLING
  // ========================================================
  async function gerarPagamentoPix() {
    const passagensIds = Array.from(state.debitosSelecionadosIds);
    if (passagensIds.length === 0) {
      showToast('Selecione pelo menos um pedágio para pagar.');
      return;
    }

    dom.btnPagarPix.disabled = true;
    dom.btnPagarPix.textContent = 'Gerando PIX...';

    try {
      const response = await fetch('/api/v1/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: state.placaAtual,
          passagensIds,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar cobrança Pix.');
      }

      state.cobrancaAtiva = data;
      abrirModalPix(data);
    } catch (err) {
      showToast(err.message);
    } finally {
      dom.btnPagarPix.disabled = false;
      atualizarResumoFinanceiro();
    }
  }

  function abrirModalPix(cobranca) {
    dom.pixCheckoutContent.style.display = 'block';
    dom.pixSuccessContent.style.display = 'none';

    // Inserir QR Code e Chave Pix
    dom.qrCodeImage.src = cobranca.qrCodeBase64;
    dom.inputPixCode.value = cobranca.pixCopiaECola;

    // Resetar botão de cópia
    dom.btnCopyPix.classList.remove('copied');
    dom.btnCopyPix.innerHTML = `
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"></rect>
        <path stroke-width="2" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
      </svg>
      Copiar PIX
    `;

    // Iniciar timer regressivo de 15 minutos (900s)
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

    // Iniciar polling automático para detectar pagamento
    iniciarPollingStatus(cobranca.txid);

    // Abrir Modal
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
      dom.btnCopyPix.innerHTML = `
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Copiado!
      `;
      showToast('Código PIX Copia e Cola copiado com sucesso!');
    } catch {
      showToast('Falha ao copiar automaticamente. Selecione e copie o código.');
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
        console.warn('Erro na checagem de status:', e);
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
      showToast('Pagamento confirmado com sucesso!');
    } catch (e) {
      showToast(e.message);
    } finally {
      dom.btnSimulatePay.disabled = false;
      dom.btnSimulatePay.textContent = '⚡ Simular Pagamento Instantâneo (Demo)';
    }
  }

  function exibirSucessoPagamento(cobranca) {
    dom.pixCheckoutContent.style.display = 'none';
    dom.pixSuccessContent.style.display = 'block';

    dom.receiptPlaca.textContent = cobranca.placa || state.placaAtual;
    dom.receiptValor.textContent = `R$ ${Number(cobranca.valorTotal || state.cobrancaAtiva.valorTotal).toFixed(2).replace('.', ',')}`;
    dom.receiptProtocolo.textContent = cobranca.protocoloConcessionaria || `PROT-${Math.floor(100000 + Math.random() * 900000)}`;
    dom.receiptAutenticacao.textContent = cobranca.autenticacaoBancaria || `AUT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    dom.receiptData.textContent = new Date().toLocaleString('pt-BR');

    // Remove débitos pagos da lista atual
    const pagosIds = new Set(state.cobrancaAtiva.passagensIds || []);
    state.debitos = state.debitos.filter((d) => !pagosIds.has(d.id));
    state.debitosSelecionadosIds.clear();

    exibirResultados();
  }

  // ========================================================
  // 6. UTILITÁRIOS
  // ========================================================
  let toastTimeout;
  function showToast(mensagem) {
    if (!dom.toast) return;
    dom.toast.textContent = mensagem;
    dom.toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 3500);
  }

  // Auto-iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
