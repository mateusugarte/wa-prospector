/**
 * Message Spinner — gera variações de mensagens para anti-bloqueio WhatsApp
 */

const SYNONYMS = [
  ['Olá', 'Oi', 'Boa tarde', 'Bom dia', 'E aí'],
  ['pode', 'consegue', 'tem como'],
  ['obrigado', 'obrigada', 'grato', 'grata'],
  ['abraços', 'até mais', 'até logo', 'um abraço'],
];

const FILLERS = ['', ' 😊', ' 👋', ' ✅', '!', '.'];

/**
 * Processa blocos {opção1|opção2|opção3} escolhendo uma opção aleatória.
 */
function spinBlocks(text) {
  return text.replace(/\{([^}]+)\}/g, (_, options) => {
    const parts = options.split('|');
    return parts[Math.floor(Math.random() * parts.length)];
  });
}

/**
 * Adiciona variação natural ao texto (mesmo sem blocos {|}).
 * Altera punctuação final e/ou adiciona filler aleatório.
 */
function addNaturalVariation(text) {
  // Variação no final da mensagem
  const lastChar = text.slice(-1);
  const filler = FILLERS[Math.floor(Math.random() * FILLERS.length)];

  if (['.', '!', '?'].includes(lastChar)) {
    // Às vezes troca . por ! ou remove
    const endings = [lastChar, lastChar === '.' ? '!' : '.', ''];
    const newEnding = endings[Math.floor(Math.random() * endings.length)];
    return text.slice(0, -1) + newEnding + filler;
  }

  return text + filler;
}

/**
 * Aplica spin completo: resolve blocos {|} e adiciona variação natural.
 * @param {string} template
 * @returns {string} mensagem final única
 */
function spin(template) {
  const spun = spinBlocks(template);
  return addNaturalVariation(spun).trim();
}

/**
 * Gera N previews do template.
 * @param {string} template
 * @param {number} n
 * @returns {string[]}
 */
function preview(template, n = 5) {
  return Array.from({ length: n }, () => spin(template));
}

module.exports = { spin, preview, spinBlocks };
