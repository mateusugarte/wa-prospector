/**
 * Scheduler — calcula delays aleatórios com minutos + segundos + milissegundos
 */

const INTERVAL_OPTIONS = [
  { label: '1 a 3 minutos',  min: 1,  max: 3  },
  { label: '1 a 5 minutos',  min: 1,  max: 5  },
  { label: '2 a 6 minutos',  min: 2,  max: 6  },
  { label: '3 a 7 minutos',  min: 3,  max: 7  },
  { label: '5 a 10 minutos', min: 5,  max: 10 },
  { label: '10 a 15 minutos',min: 10, max: 15 },
  { label: '15 a 30 minutos',min: 15, max: 30 },
];

/**
 * Calcula delay aleatório com minutos, segundos e milissegundos independentes.
 * @param {number} minMinutes
 * @param {number} maxMinutes
 * @returns {number} delay em milissegundos
 */
function getRandomDelay(minMinutes, maxMinutes) {
  const minutes = Math.floor(minMinutes + Math.random() * (maxMinutes - minMinutes + 1));
  const seconds = Math.floor(Math.random() * 60);
  const ms      = Math.floor(Math.random() * 1000);
  return (minutes * 60 * 1000) + (seconds * 1000) + ms;
}

/**
 * Formata delay em string legível para logs.
 * @param {number} delayMs
 * @returns {string}
 */
function formatDelay(delayMs) {
  const totalSeconds = Math.floor(delayMs / 1000);
  const ms      = delayMs % 1000;
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m ${seconds}s ${ms}ms`;
}

/**
 * Delay de digitação aleatório por contato: 2000–5000ms
 * Segundos e milissegundos são independentes para cada contato.
 * @returns {number} delay em milissegundos
 */
function getTypingDelay() {
  const seconds = 2 + Math.floor(Math.random() * 4);   // 2, 3, 4 ou 5 segundos
  const ms      = Math.floor(Math.random() * 1000);    // 0–999ms
  return Math.min(seconds * 1000 + ms, 5000);          // máx 5000ms
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getRandomDelay, formatDelay, getTypingDelay, sleep, INTERVAL_OPTIONS };
