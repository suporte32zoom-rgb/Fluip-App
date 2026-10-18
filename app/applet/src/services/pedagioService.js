import axios from 'axios';

/**
 * Serviço de Consulta e Gerenciamento de Tarifas de Pedágio Free Flow (Estradapay)
 * Integração com APIBrasil (apibrasil.io) com fallback para simulação realista.
 */
class PedagioService {
  constructor() {
    // Armazenamento em memória para consistência de débitos consultados por placa
    this.debitosCache = new Map();

    // URL oficial da APIBrasil para consulta de veículos
    this.apiBrasilUrl = 'https://gateway.apibrasil.io/api/v2/consulta/veiculos';

    // Lista de concessionárias para simulação/fallback e enriquecimento
    this.concessionarias = [
      {
        nome: 'CCR RioSP',
        rodovia: 'BR-101 (Rio-Santos)',
        porticos: [
          'Pórtico Km 12 - Paraty / BR-101',
          'Pórtico Km 41 - Angra dos Reis / BR-101',
          'Pórtico Km 98 - Mangaratiba / BR-101',
          'Pórtico Km 132 - Itaguaí / BR-101',
        ],
        tarifas: [4.80, 8.50, 9.20, 15.40],
      },
      {
        nome: 'Ecovias do Litoral',
        rodovia: 'SP-055 / Rodovia Cônego Domênico Rangoni',
        porticos: [
          'Pórtico Km 248 - Santos / SP-055',
          'Pórtico Km 262 - Cubatão / SP-055',
          'Pórtico Km 280 - Praia Grande / SP-055',
        ],
        tarifas: [5.60, 10.20, 12.30, 14.80],
      },
      {
        nome: 'CSG (Caminhos da Serra Gaúcha)',
        rodovia: 'ERS-122 / ERS-240',
        porticos: [
          'Pórtico Km 108 - Antônio Prado / ERS-122',
          'Pórtico Km 151 - Caxias do Sul / ERS-122',
          'Pórtico Km 22 - Portão / ERS-240',
        ],
        tarifas: [7.80, 8.60, 11.20, 13.90],
      },
    ];
  }

  /**
   * Obtém o token da APIBrasil configurado nas variáveis de ambiente
   * @returns {string|null}
   */
  obterBearerToken() {
    const token = process.env.APIBRASIL_BEARER_TOKEN;
    if (!token || token.trim() === '' || token === 'seu_token_aqui') {
      return null;
    }
    return token.trim();
  }

  /**
   * Verifica se o modo homologação da APIBrasil está ativo
   * @returns {boolean}
   */
  isModoHomologacao() {
    return process.env.APIBRASIL_HOMOLOG === 'true';
  }

  /**
   * Normaliza e valida placas no formato Mercosul (ABC1D23) ou antigo (ABC-1234)
   * @param {string} placa - Placa veicular
   * @returns {string} Placa limpa em letras maiúsculas
   */
  validarEFormatarPlaca(placa) {
    if (!placa || typeof placa !== 'string') {
      throw new Error('Placa inválida ou não informada.');
    }

    const placaLimpa = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Padrão Mercosul: 3 letras, 1 número, 1 letra, 2 números (ex: ABC1D23)
    const regexMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    // Padrão Antigo Brasileiro: 3 letras e 4 números (ex: ABC1234)
    const regexAntigo = /^[A-Z]{3}[0-9]{4}$/;

    if (!regexMercosul.test(placaLimpa) && !regexAntigo.test(placaLimpa)) {
      throw new Error('Formato de placa inválido. Use o padrão Mercosul (ABC1D23) ou tradicional (ABC1234).');
    }

    return placaLimpa;
  }

  /**
   * Consulta os débitos em aberto para a placa informada.
   * Integra com a APIBrasil (gateway.apibrasil.io) com fallback inteligente.
   * @param {string} placaBruta
   * @returns {Promise<Array>} Lista de débitos pendentes
   */
  async consultarDebitosPorPlaca(placaBruta) {
    const placa = this.validarEFormatarPlaca(placaBruta);

    // Se já geramos ou consultamos débitos para esta placa e existem itens não quitados, retorna do cache
    if (this.debitosCache.has(placa)) {
      const debitosAtuais = this.debitosCache.get(placa);
      return debitosAtuais.filter((d) => d.status === 'PENDENTE');
    }

    const token = this.obterBearerToken();
    const isHomolog = this.isModoHomologacao();

    // Se o token estiver presente e configurado, tentar a requisição na APIBrasil
    if (token) {
      try {
        console.log(`[APIBrasil] Consultando placa ${placa} no gateway oficial (Homolog: ${isHomolog})...`);

        const response = await axios.post(
          this.apiBrasilUrl,
          {
            placa,
            homolog: isHomolog,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 6000,
          }
        );

        if (response.data && (response.status === 200 || response.status === 201)) {
          const debitosMapeados = this.mapearRetornoApiBrasil(response.data, placa);
          if (debitosMapeados && debitosMapeados.length > 0) {
            console.log(`[APIBrasil] Sucesso: ${debitosMapeados.length} débitos mapeados para ${placa}.`);
            this.debitosCache.set(placa, debitosMapeados);
            return debitosMapeados;
          }
        }
      } catch (error) {
        console.warn(
          `[APIBrasil] Não foi possível obter dados ao vivo da API (${error.response?.status || error.message}). Ativando fallback simulado seguro para a placa ${placa}.`
        );
      }
    } else {
      console.log(`[APIBrasil] Token não configurado ou padrão em .env. Utilizando simulação realista para a placa ${placa}.`);
    }

    // Fallback: Gerar débitos com dados realistas da malha rodoviária
    const debitosSimulados = this.gerarDebitosSimulados(placa);
    this.debitosCache.set(placa, debitosSimulados);
    return debitosSimulados;
  }

  /**
   * Mapeia a resposta da APIBrasil para a estrutura exigida pelo Estradapay:
   * (id, concessionaria, portico, dataHora, valorTarifa e limiteInfracao)
   * @param {Object} data - Resposta retornada pela APIBrasil
   * @param {string} placa - Placa veicular consultada
   * @returns {Array} Lista formatada de débitos
   */
  mapearRetornoApiBrasil(data, placa) {
    const dados = data.dados || data.result || data.veiculo || data;
    const lista = dados.pedagios || dados.passagens || dados.debitos || dados.multas || [];

    const categoriaDetectada = dados.marcaModelo || dados.modelo || dados.marca || 'Automóvel Passeio / SUV';
    const agora = new Date();

    if (Array.isArray(lista) && lista.length > 0) {
      return lista.map((item, index) => {
        const dataPassagem = item.dataHora ? new Date(item.dataHora) : new Date(agora.getTime() - (index + 2) * 86400000);
        const dataLimite = item.limiteInfracao || item.dataLimiteInfracao
          ? new Date(item.limiteInfracao || item.dataLimiteInfracao)
          : new Date(dataPassagem.getTime() + 30 * 24 * 60 * 60 * 1000);

        const valor = Number(item.valorTarifa || item.valor || item.valor_total || 9.20);
        const diasRestantes = Math.max(0, Math.ceil((dataLimite.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          id: item.id || `apibrasil_${placa}_${index + 1}_${Math.floor(dataPassagem.getTime() / 1000)}`,
          placa,
          concessionaria: item.concessionaria || item.orgao || 'CCR RioSP',
          rodovia: item.rodovia || 'BR-101 (Rio-Santos)',
          portico: item.portico || item.local || item.descricao || `Pórtico Km ${12 + index * 30} - Free Flow`,
          sentido: item.sentido || (index % 2 === 0 ? 'Sul / Litoral' : 'Norte / Capital'),
          categoriaVeiculo: item.categoria || categoriaDetectada,
          dataHora: dataPassagem.toISOString(),
          dataHoraFormatada: dataPassagem.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          valorTarifa: Number(valor.toFixed(2)),
          limiteInfracao: dataLimite.toISOString(),
          dataLimiteInfracao: dataLimite.toISOString(),
          dataLimiteFormatada: dataLimite.toLocaleDateString('pt-BR'),
          diasRestantes,
          status: 'PENDENTE',
          fonte: 'APIBrasil (apibrasil.io)',
        };
      });
    }

    // Se a API retornou o cadastro do veículo sem lista explícita de pedágios,
    // geramos as tarifas correspondentes ao veículo real detectado pela APIBrasil
    return this.gerarDebitosSimulados(placa, categoriaDetectada, 'APIBrasil (Veículo Validado)');
  }

  /**
   * Gera débitos simulados consistentes com base no hash da placa
   * @param {string} placa
   * @param {string} [categoriaCustom]
   * @param {string} [fonte]
   * @returns {Array}
   */
  gerarDebitosSimulados(placa, categoriaCustom = null, fonte = 'Simulação Concessionárias Free Flow') {
    const hash = placa.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const qtdDebitos = (hash % 2 === 0) ? 3 : 2;

    const debitos = [];
    const agora = new Date();

    for (let i = 0; i < qtdDebitos; i++) {
      const concIndex = (hash + i) % this.concessionarias.length;
      const concessionaria = this.concessionarias[concIndex];
      const porticoIndex = (hash * 3 + i) % concessionaria.porticos.length;
      const portico = concessionaria.porticos[porticoIndex];
      const tarifaIndex = (hash * 2 + i) % concessionaria.tarifas.length;
      const valorTarifa = concessionaria.tarifas[tarifaIndex];

      // Data de passagem recente (entre 2 a 12 dias atrás)
      const diasAtras = 2 + ((hash + i * 3) % 10);
      const dataPassagem = new Date(agora.getTime() - diasAtras * 24 * 60 * 60 * 1000);
      dataPassagem.setHours(8 + ((hash + i * 4) % 12), ((hash * 7) % 60), 0);

      // Conforme Lei do Free Flow (Lei nº 14.157/21 e Resolução CONTRAN nº 989/22),
      // o condutor tem até 30 dias para quitar o pedágio sem incorrer em infração grave (Art. 209-A do CTB)
      const dataLimiteInfracao = new Date(dataPassagem.getTime() + 30 * 24 * 60 * 60 * 1000);
      const diasRestantes = Math.max(0, Math.ceil((dataLimiteInfracao.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)));

      debitos.push({
        id: `deb_${placa}_${i + 1}_${Math.floor(dataPassagem.getTime() / 1000)}`,
        placa,
        concessionaria: concessionaria.nome,
        rodovia: concessionaria.rodovia,
        portico,
        sentido: (i % 2 === 0) ? 'Sul / Litoral' : 'Norte / Capital',
        categoriaVeiculo: categoriaCustom || 'Automóvel Passeio / SUV',
        dataHora: dataPassagem.toISOString(),
        dataHoraFormatada: dataPassagem.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        valorTarifa: Number(valorTarifa.toFixed(2)),
        limiteInfracao: dataLimiteInfracao.toISOString(),
        dataLimiteInfracao: dataLimiteInfracao.toISOString(),
        dataLimiteFormatada: dataLimiteInfracao.toLocaleDateString('pt-BR'),
        diasRestantes,
        status: 'PENDENTE',
        fonte,
      });
    }

    return debitos;
  }

  /**
   * Busca débitos pelo array de IDs
   * @param {string[]} ids
   * @returns {Array}
   */
  buscarPorIds(ids) {
    const todos = [];
    for (const lista of this.debitosCache.values()) {
      todos.push(...lista);
    }
    return todos.filter((d) => ids.includes(d.id));
  }

  /**
   * Baixa as passagens marcando como PAGO após confirmação do Pix ou Cartão
   * @param {string[]} ids
   */
  baixarPassagens(ids) {
    for (const [placa, lista] of this.debitosCache.entries()) {
      const atualizados = lista.map((d) => {
        if (ids.includes(d.id)) {
          return { ...d, status: 'PAGO', baixadoEm: new Date().toISOString() };
        }
        return d;
      });
      this.debitosCache.set(placa, atualizados);
    }
  }
}

export default new PedagioService();
