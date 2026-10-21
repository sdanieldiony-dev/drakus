exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método não permitido" }) };
  }
  try {
    const { message, history = [] } = JSON.parse(event.body || "{}");
    if (!message) {
      return { statusCode: 400, body: JSON.stringify({ error: "Mensagem vazia" }) };
    }
    const past = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10);
    while (past.length && past[0].role !== "user") past.shift();
    const messages = [...past, { role: "user", content: message }];

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 400,
        system:
          "Você é o Drakus, um mini robô assistente pessoal com rosto de dragão. " +
          "Responda sempre em português do Brasil, de forma natural e curta (no máximo 2 ou 3 frases). " +
          "Suas respostas serão faladas em voz alta, então não use markdown, listas, símbolos nem emojis.",
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: (data.error && data.error.message) || "Erro na API" }) };
    }
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ reply }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falha ao falar com a IA" }) };
  }
};
