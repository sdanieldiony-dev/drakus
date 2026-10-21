// ============================================================
// APP.JS — lógica principal: busca, filtro de confiança, renderização
// ============================================================

let ultimasLojas = []; // guarda o último resultado pra poder refiltrar sem rebuscar

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const trustFilter = document.getElementById("trust-filter");
const trustFilterValue = document.getElementById("trust-filter-value");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  buscar(input.value.trim());
});

trustFilter.addEventListener("input", () => {
  trustFilterValue.textContent = parseFloat(trustFilter.value).toFixed(1);
  aplicarFiltroEExibir();
});

async function buscar(termo) {
  if (!termo) return;
  resultsEl.innerHTML = "";
  ultimasLojas = [];

  statusEl.textContent = `Buscando "${termo}"...`;

  let lojas = [];
  let aviso = null;

  if (CONFIG.USE_MOCK_DATA) {
    lojas = gerarLojasMock(termo);
  } else {
    const resultado = await buscarLojasVirtuais(termo);
    lojas = resultado.lojas;
    aviso = resultado.aviso;
  }

  lojas.forEach((l) => (l.nota = calcularConfianca(l)));
  lojas.sort((a, b) => b.nota - a.nota || (a.preco || 0) - (b.preco || 0));

  ultimasLojas = lojas;

  let mensagem = `${lojas.length} loja(s) encontrada(s) para "${termo}"`;
  if (aviso) {
    mensagem += ` — ${aviso}`;
  }
  statusEl.dataset.base = mensagem;
  aplicarFiltroEExibir();
}

function aplicarFiltroEExibir() {
  const minimo = parseFloat(trustFilter.value);
  const filtradas = ultimasLojas.filter((l) => l.nota >= minimo);

  const base = statusEl.dataset.base || "";
  if (ultimasLojas.length > 0) {
    statusEl.textContent =
      filtradas.length === ultimasLojas.length
        ? base
        : `${base} — mostrando ${filtradas.length} de ${ultimasLojas.length} com nota >= ${minimo.toFixed(1)}`;
  }

  renderizar(filtradas);
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
  return div.innerHTML;
}

function urlSegura(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : null;
  } catch (e) {
    return null;
  }
}

function renderizar(lojas) {
  if (lojas.length === 0) {
    resultsEl.innerHTML = '<div class="empty">Nenhuma loja encontrada com esse filtro. Tente baixar a confianca minima ou trocar o termo de busca.</div>';
    return;
  }

  resultsEl.innerHTML = lojas
    .map((loja, i) => {
      const classeNota = classificarConfianca(loja.nota);
      const badges = gerarBadges(loja)
        .map((b) => `<span class="badge ${b.tipo}">${escapeHtml(b.texto)}</span>`)
        .join("");

      const nomeSeguro = escapeHtml(loja.nome);
      const link = urlSegura(loja.url);
      const nomeHtml = link
        ? `<a class="store-name" href="${link}" target="_blank" rel="noopener noreferrer">${nomeSeguro}</a>`
        : `<div class="store-name">${nomeSeguro}</div>`;

      return `
        <div class="store-card ${i === 0 ? "best" : ""}">
          <div class="trust-score ${classeNota}">${loja.nota.toFixed(1)}</div>
          <div class="store-info">
            ${i === 0 ? '<span class="label-best">Melhor opcao</span>' : ""}
            <div class="store-name-row">
              ${nomeHtml}
              <div class="price">${loja.preco != null ? "R$ " + loja.preco.toFixed(0) : "Preco nao disponivel"}</div>
            </div>
            <div class="store-type">Loja virtual (Mercado Livre)</div>
            <div class="badge-row">${badges}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================================================
// MODO DEMO — dados ficticios pra testar a interface sem rede
// ============================================================
function gerarLojasMock(termo) {
  return [
    {
      nome: termo + " — DenimWay.com.br",
      tipo: "virtual",
      preco: 119,
      vendedorReputacao: 5,
      vendedorMedalha: "platinum",
      qtdVendida: 800,
      temSSL: true,
      temContatoReal: true,
      reclamacoesGraves: 0,
    },
    {
      nome: termo + " — LojaModaBR",
      tipo: "virtual",
      preco: 99,
      vendedorReputacao: 3,
      vendedorMedalha: null,
      qtdVendida: 20,
      temSSL: true,
      temContatoReal: true,
      reclamacoesGraves: 1,
    },
    {
      nome: termo + " — VendeTudoExpress",
      tipo: "virtual",
      preco: 79,
      vendedorReputacao: 1,
      vendedorMedalha: null,
      qtdVendida: 2,
      temSSL: true,
      temContatoReal: false,
      reclamacoesGraves: 3,
    },
  ];
}

// ============================================================
// MODO REAL — busca de lojas virtuais via API publica do Mercado Livre
// (sem chave, aceita chamada direta do navegador). Ver explicacao
// completa em config.js sobre por que nao usamos a SerpAPI aqui.
// ============================================================

async function buscarLojasVirtuais(termo) {
  const siteId = CONFIG.MERCADOLIVRE_SITE_ID || "MLB";
  // Chama nossa própria função serverless (roda no servidor da
  // Netlify), que por sua vez busca no Mercado Livre. Isso evita o
  // bloqueio que acontece quando o navegador chama a API direto.
  const url =
    `/.netlify/functions/buscar-lojas` +
    `?q=${encodeURIComponent(termo)}` +
    `&site=${encodeURIComponent(siteId)}`;

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      console.warn(`Função de busca retornou status ${resp.status} ao buscar "${termo}".`);
      return {
        lojas: [],
        aviso: "nao consegui buscar agora (erro no servidor). Tente de novo em pouco tempo.",
      };
    }

    const data = await resp.json();

    if (data.erro) {
      console.warn("Aviso da função de busca:", data.erro);
      return {
        lojas: [],
        aviso: "o Mercado Livre nao respondeu agora (pode estar limitando acesso). Tente de novo em pouco tempo.",
      };
    }

    const resultados = data.resultados || [];

    if (resultados.length === 0) {
      return { lojas: [], aviso: null };
    }

    const lojas = resultados.map((item) => {
      const levelStr = (item.seller && item.seller.seller_reputation && item.seller.seller_reputation.level_id) || "";
      const levelNum = parseInt(levelStr, 10);
      const reputacao = Number.isFinite(levelNum) ? levelNum : null;
      const medalhaLider = (item.seller && item.seller.seller_reputation && item.seller.seller_reputation.power_seller_status) || null;
      const nickname = item.seller && item.seller.nickname;

      return {
        nome: nickname ? `${item.title} — vendido por ${nickname}` : item.title,
        tipo: "virtual",
        preco: typeof item.price === "number" ? item.price : null,
        url: item.permalink || null,
        temSSL: true,
        temContatoReal: !!nickname,
        reclamacoesGraves: 0,
        vendedorReputacao: reputacao,
        vendedorMedalha: medalhaLider,
        qtdVendida: item.sold_quantity || 0,
      };
    });

    return { lojas, aviso: null };
  } catch (err) {
    console.warn("Erro ao buscar lojas virtuais:", err);
    return {
      lojas: [],
      aviso: "nao consegui buscar agora (erro de conexao). Verifique sua internet e tente de novo.",
    };
  }
}
