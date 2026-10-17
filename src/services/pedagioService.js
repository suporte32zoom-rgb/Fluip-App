/**
 * Serviço de Consulta e Gerenciamento de Tarifas de Pedágio Free Flow (Fluip)
 */

class PedagioService {
  constructor() {
    // Armazenamento em memória para consistência de débitos consultados por placa
    this.debitosCache = new Map();
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
   * Gera débitos fictícios realistas com base na placa ou retorna os pendentes em cache.
   * @param {string} placaBruta
   * @returns {Promise<Array>} Lista de débitos pendentes
   */
  async consultarDebitosPorPlaca(placaBruta) {
    const placa = this.validarEFormatarPlaca(placaBruta);

    // Se já geramos débitos para esta placa e existem itens não quitados, retorna
    if (this.debitosCache.has(placa)) {
      const debitosAtuais = this.debitosCache.get(placa);
      // Retorna apenas pendentes
      return debitosAtuais.filter((d) => d.status === 'PENDENTE');
    }

    // Gerar 2 a 3 débitos fictícios com dados realistas
    // Usamos o hash da placa para gerar dados consistentes para a mesma placa
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
        categoriaVeiculo: 'Automóvel Passeio / SUV',
        dataHora: dataPassagem.toISOString(),
        dataHoraFormatada: dataPassagem.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        valorTarifa: Number(valorTarifa.toFixed(2)),
        dataLimiteInfracao: dataLimiteInfracao.toISOString(),
        dataLimiteFormatada: dataLimiteInfracao.toLocaleDateString('pt-BR'),
        diasRestantes,
        status: 'PENDENTE', // PENDENTE | PAGO
      });
    }

    this.debitosCache.set(placa, debitos);
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
   * Baixa as passagens marcando como PAGO após confirmação do Pix
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
