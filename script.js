document.addEventListener("DOMContentLoaded", function () {
  // Inicialização do PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js";

  const form = document.getElementById("formularioPrevidencia");
  const resultadosDiv = document.getElementById("resultados");

  // Formatação de moeda
  const salarioInput = document.getElementById("salarioContribuicao");
  const contribuicaoFuturaInput = document.getElementById("contribuicaoFutura");
  formatMoney(salarioInput);
  formatMoney(contribuicaoFuturaInput);

  // Handler do arquivo CNIS
  const cnisInput = document.getElementById("arquivoCNIS");
  cnisInput.addEventListener("change", async function (e) {
    if (e.target.files.length > 0) {
      try {
        const contribuicoes = await processarCNIS(e.target.files[0]);
        console.log("Contribuições encontradas:", contribuicoes);
        // Atualizar campos com base nas contribuições
        atualizarCamposComCNIS(contribuicoes);
      } catch (error) {
        alert("Erro ao processar arquivo CNIS. Verifique se é um PDF válido.");
      }
    }
  });

  // Animação nos campos
  const fields = document.querySelectorAll(".form-group");
  fields.forEach((field, index) => {
    field.style.opacity = "0";
    field.style.transform = "translateY(20px)";
    setTimeout(() => {
      field.style.transition = "all 0.5s ease";
      field.style.opacity = "1";
      field.style.transform = "translateY(0)";
    }, index * 100);
  });

  // Handler do formulário
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showLoading();

    const button = form.querySelector(".btn-calculate");
    button.textContent = "Calculando...";
    button.disabled = true;

    setTimeout(() => {
      const dados = coletarDadosFormulario();
      const idade = calcularIdade(dados.dataNascimento);
      const elegibilidade = verificarElegibilidade(
        idade,
        dados.sexo,
        dados.tempoContribuicao,
        dados.tipoTrabalho
      );
      const beneficio = calcularBeneficio(
        dados.salarioContribuicao,
        dados.tempoContribuicao,
        idade
      );

      mostrarResultados(elegibilidade, beneficio, dados);
      inicializarDashboard(dados, elegibilidade, beneficio);

      button.textContent = "Calcular Aposentadoria";
      button.disabled = false;
    }, 1500);
  });
});

function formatMoney(input) {
  input.addEventListener("input", function (e) {
    let value = e.target.value.replace(/\D/g, "");
    value = (value / 100).toFixed(2);
    e.target.value = value;
  });
}

function showLoading() {
  const loadingBar = document.createElement("div");
  loadingBar.className = "loading-bar";
  document.body.appendChild(loadingBar);

  setTimeout(() => {
    loadingBar.remove();
  }, 1500);
}

async function processarCNIS(file) {
  const fileReader = new FileReader();

  try {
    const pdfData = await new Promise((resolve, reject) => {
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });

    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const contribuicoes = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");

      const regex = /(\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{4})/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        contribuicoes.push({
          inicio: match[1],
          fim: match[2],
        });
      }
    }

    return contribuicoes;
  } catch (error) {
    console.error("Erro ao processar CNIS:", error);
    throw error;
  }
}

function coletarDadosFormulario() {
  return {
    nome: document.getElementById("nome").value,
    dataNascimento: document.getElementById("dataNascimento").value,
    sexo: document.getElementById("sexo").value,
    tipoTrabalho: document.getElementById("tipoTrabalho").value,
    tempoContribuicao: parseInt(
      document.getElementById("tempoContribuicao").value
    ),
    salarioContribuicao: parseFloat(
      document.getElementById("salarioContribuicao").value
    ),
  };
}

function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }

  return idade;
}

function verificarElegibilidade(idade, sexo, tempoContribuicao, tipoTrabalho) {
  let tempoMinimo, idadeMinima;

  switch (tipoTrabalho) {
    case "professor":
      tempoMinimo = sexo === "M" ? 30 : 25;
      idadeMinima = sexo === "M" ? 60 : 57;
      break;
    case "rural":
      tempoMinimo = sexo === "M" ? 20 : 15;
      idadeMinima = sexo === "M" ? 60 : 55;
      break;
    case "militar":
      tempoMinimo = 35;
      idadeMinima = 60;
      break;
    default:
      tempoMinimo = sexo === "M" ? 35 : 30;
      idadeMinima = sexo === "M" ? 65 : 62;
  }

  return {
    tempoSuficiente: tempoContribuicao >= tempoMinimo,
    idadeSuficiente: idade >= idadeMinima,
    podeAposentar: tempoContribuicao >= tempoMinimo && idade >= idadeMinima,
    tempoRestante: Math.max(0, tempoMinimo - tempoContribuicao),
    idadeRestante: Math.max(0, idadeMinima - idade),
  };
}

function calcularBeneficio(salarioContribuicao, tempoContribuicao, idade) {
  const fatorPrevidenciario = calcularFatorPrevidenciario(
    idade,
    tempoContribuicao
  );
  const beneficio = salarioContribuicao * fatorPrevidenciario;

  // Aplicar limites do INSS
  const tetoINSS = 7507.49; // Valor de 2023
  const pisoINSS = 1320.0; // Valor de 2023

  return Math.min(Math.max(beneficio, pisoINSS), tetoINSS);
}

function calcularFatorPrevidenciario(
  idade,
  tempoContribuicao,
  esperancaVida = 76
) {
  const f =
    ((tempoContribuicao * 0.31) / esperancaVida) *
    (1 + (idade + tempoContribuicao * 0.31) / 100);
  return Math.max(f, 1);
}

function simularContribuicao() {
  const contribuicaoMensal = parseFloat(
    document.getElementById("contribuicaoFutura").value
  );
  const mesesContribuicao = parseInt(
    document.getElementById("tempoContribuicaoFutura").value
  );

  const impactoBeneficio = calcularImpactoBeneficio(
    contribuicaoMensal,
    mesesContribuicao
  );
  mostrarResultadoSimulacao(impactoBeneficio);
}

function calcularImpactoBeneficio(contribuicaoMensal, meses) {
  const contribuicaoTotal = contribuicaoMensal * meses;
  const aumentoBeneficio = contribuicaoTotal * 0.02;

  return {
    contribuicaoTotal,
    aumentoBeneficio,
  };
}

function mostrarResultados(elegibilidade, beneficio, dados) {
  const resultadosDiv = document.getElementById("resultados");
  resultadosDiv.style.display = "block";

  let mensagem = `
        <div class="card">
            <h2><i class="fas fa-chart-line"></i> Resultado da Análise</h2>
            ${
              elegibilidade.podeAposentar
                ? `<div class="resultado-positivo">
                    <i class="fas fa-check-circle"></i> Parabéns! Você já pode se aposentar!
                    <p>Benefício estimado: R$ ${beneficio.toFixed(2)}</p>
                   </div>`
                : `<div class="resultado-negativo">
                    <i class="fas fa-exclamation-circle"></i> Você ainda não atingiu os requisitos.
                    ${
                      elegibilidade.tempoRestante > 0
                        ? `<p>Faltam ${elegibilidade.tempoRestante} anos de contribuição.</p>`
                        : ""
                    }
                    ${
                      elegibilidade.idadeRestante > 0
                        ? `<p>Faltam ${elegibilidade.idadeRestante} anos para atingir a idade mínima.</p>`
                        : ""
                    }
                   </div>`
            }
        </div>
    `;

  resultadosDiv.innerHTML = mensagem;
}

function mostrarResultadoSimulacao(impacto) {
  const resultadosDiv = document.getElementById("resultados");

  const simulacaoHTML = `
        <div class="card simulacao-result">
            <h3><i class="fas fa-chart-bar"></i> Resultado da Simulação</h3>
            <p>Contribuição Total: R$ ${impacto.contribuicaoTotal.toFixed(
              2
            )}</p>
            <p>Aumento Estimado no Benefício: R$ ${impacto.aumentoBeneficio.toFixed(
              2
            )}</p>
        </div>
    `;

  resultadosDiv.innerHTML += simulacaoHTML;
}

function atualizarCamposComCNIS(contribuicoes) {
  // Calcular tempo total de contribuição
  let tempoTotal = 0;
  contribuicoes.forEach((contrib) => {
    const inicio = new Date(contrib.inicio.split("/").reverse().join("-"));
    const fim = new Date(contrib.fim.split("/").reverse().join("-"));
    const anos = (fim - inicio) / (1000 * 60 * 60 * 24 * 365.25);
    tempoTotal += anos;
  });

  document.getElementById("tempoContribuicao").value = Math.floor(tempoTotal);
}
// Função para inicializar o dashboard
function inicializarDashboard(dados, elegibilidade, beneficio) {
  document.getElementById("dashboard").style.display = "block";

  criarGraficoContribuicao(dados.tempoContribuicao);
  criarGraficoBeneficio(beneficio);
  criarResumo(dados, elegibilidade, beneficio);
}

// Função para criar gráfico de contribuição
function criarGraficoContribuicao(tempoContribuicao) {
  const ctx = document.getElementById("contribuicaoChart").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Contribuído", "Restante"],
      datasets: [
        {
          data: [tempoContribuicao, Math.max(35 - tempoContribuicao, 0)],
          backgroundColor: [
            "rgba(46, 204, 113, 0.8)",
            "rgba(189, 195, 199, 0.8)",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

// Função para criar gráfico de benefício
function criarGraficoBeneficio(beneficio) {
  const ctx = document.getElementById("beneficioChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Benefício Projetado", "Teto INSS"],
      datasets: [
        {
          label: "Valores em R$",
          data: [beneficio, 7507.49],
          backgroundColor: [
            "rgba(52, 152, 219, 0.8)",
            "rgba(231, 76, 60, 0.8)",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

// Função para gerar PDF
function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Relatório Previdenciário", 20, 20);

  // Adicionar conteúdo ao PDF
  doc.setFontSize(12);
  const resultados = document.getElementById("resultados").innerText;
  doc.text(resultados, 20, 40);

  doc.save("relatorio-previdenciario.pdf");
}

// Função para compartilhar
function compartilharResultado() {
  if (navigator.share) {
    navigator.share({
      title: "Minha Simulação Previdenciária",
      text: document.getElementById("resultados").innerText,
      url: window.location.href,
    });
  } else {
    alert("Compartilhamento não suportado neste navegador");
  }
}
// Simulador de cenários
function simularCenario() {
  const aumentoContribuicao =
    parseFloat(document.getElementById("aumentoContribuicao").value) || 0;
  const periodoAdicional =
    parseInt(document.getElementById("periodoAdicional").value) || 12;

  const cenarioAtual = calcularBeneficioAtual();
  const cenarioOtimizado = calcularBeneficioOtimizado(
    aumentoContribuicao,
    periodoAdicional
  );

  mostrarComparativoCenarios(cenarioAtual, cenarioOtimizado);
}

function calcularBeneficioOtimizado(aumentoContribuicao, periodoAdicional) {
  const salarioAtual = parseFloat(
    document.getElementById("salarioContribuicao").value
  );
  const novoSalario = salarioAtual + aumentoContribuicao;

  // Cálculo considerando o aumento de contribuição
  const beneficioBase = calcularBeneficio(
    novoSalario,
    parseInt(document.getElementById("tempoContribuicao").value) +
      periodoAdicional / 12
  );

  return {
    beneficio: beneficioBase,
    tempoContribuicao: periodoAdicional,
    aumentoMensal: aumentoContribuicao,
  };
}

// Análise de fatores especiais
function calcularFatoresEspeciais() {
  const fatores = {
    insalubridade: document.getElementById("insalubridade").checked,
    periculosidade: document.getElementById("periculosidade").checked,
    deficiencia: document.getElementById("deficiencia").checked,
  };

  const reducaoTempo = calcularReducaoTempo(fatores);
  const aumentoBeneficio = calcularAumentoFatores(fatores);

  mostrarResultadosFatores(reducaoTempo, aumentoBeneficio);
}

function calcularReducaoTempo(fatores) {
  let reducao = 0;
  if (fatores.insalubridade) reducao += 5;
  if (fatores.periculosidade) reducao += 3;
  if (fatores.deficiencia) reducao += 2;
  return reducao;
}

function calcularAumentoFatores(fatores) {
  let aumento = 0;
  if (fatores.insalubridade) aumento += 0.15;
  if (fatores.periculosidade) aumento += 0.1;
  if (fatores.deficiencia) aumento += 0.05;
  return aumento;
}

function mostrarResultadosFatores(reducaoTempo, aumentoBeneficio) {
  const resultadosDiv = document.getElementById("resultadosSimulacao");
  resultadosDiv.style.display = "block";

  resultadosDiv.innerHTML = `
        <div class="resultado-comparativo">
            <div class="comparativo-card">
                <h4>Redução no Tempo de Contribuição</h4>
                <p class="destaque">${reducaoTempo} anos</p>
            </div>
            <div class="comparativo-card">
                <h4>Aumento no Benefício</h4>
                <p class="destaque">+${(aumentoBeneficio * 100).toFixed(0)}%</p>
            </div>
        </div>
    `;
}

// Comparador de regras
function inicializarComparadorRegras() {
  const regras = [
    {
      nome: "Regra Atual",
      descricao: "Regra geral da Previdência",
      requisitos: "Idade mínima + Tempo de contribuição",
    },
    {
      nome: "Regra de Transição",
      descricao: "Para quem já estava contribuindo",
      requisitos: "Pontuação progressiva",
    },
    {
      nome: "Regra por Idade",
      descricao: "Apenas considerando idade",
      requisitos: "Idade mínima + Carência",
    },
  ];

  const comparadorDiv = document.getElementById("comparadorRegras");
  comparadorDiv.innerHTML = regras
    .map(
      (regra) => `
        <div class="regra-item">
            <h4>${regra.nome}</h4>
            <p>${regra.descricao}</p>
            <small>${regra.requisitos}</small>
        </div>
    `
    )
    .join("");
}

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  inicializarComparadorRegras();
  // ... resto do código de inicialização
});
