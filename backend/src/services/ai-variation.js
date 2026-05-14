const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Gera N variações únicas a partir de 5 mensagens de referência.
 * Faz uma única chamada à API da Anthropic — nunca N chamadas separadas.
 *
 * @param {string[]} referenceMessages - Array com exatamente 5 mensagens de referência
 * @param {number} count - Quantidade de variações a gerar (igual ao nº de dispatches)
 * @returns {Promise<string[]>} - Array de strings com as variações geradas
 */
async function generateVariations(referenceMessages, count) {
  const prompt = `Você é um especialista em copywriting para WhatsApp.

O usuário escreveu as 5 mensagens de referência abaixo. Todas têm o mesmo contexto e intenção.
Gere exatamente ${count} variações únicas com base nessas referências.

Regras obrigatórias:
- Cada variação deve ser textualmente diferente das outras e das referências
- Preserve o tom, contexto e intenção das mensagens originais
- Mensagens curtas e naturais, como uma pessoa enviaria no WhatsApp
- Não use linguagem corporativa ou formal demais
- Não adicione saudações genéricas como "Olá!" se não estiverem nas referências
- Cada variação em uma linha separada, sem numeração, sem prefixo, sem aspas

Mensagens de referência:
${referenceMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Retorne apenas as ${count} variações, uma por linha, sem mais nada.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Se a IA retornou menos que o esperado, preenche ciclicamente
  if (lines.length < count) {
    while (lines.length < count) {
      lines.push(lines[lines.length % referenceMessages.length]);
    }
  }

  return lines.slice(0, count);
}

module.exports = { generateVariations };
