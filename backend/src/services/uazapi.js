const axios = require('axios');

function getClient() {
  const baseURL = process.env.UAZAPI_BASE_URL;
  const token = process.env.UAZAPI_TOKEN;

  if (!baseURL || !token) {
    throw new Error('UAZAPI_BASE_URL e UAZAPI_TOKEN são obrigatórios no .env');
  }

  return axios.create({
    baseURL,
    headers: {
      admintoken: token,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Cria uma nova instância WhatsApp na UazAPI.
 * @param {string} name - Nome da instância
 */
async function createInstance(name) {
  const client = getClient();
  const { data } = await client.post('/instance/create', { name });
  return data;
}

/**
 * Obtém o QR Code para conectar a instância.
 * @param {string} instanceId
 */
async function getQRCode(instanceId) {
  const client = getClient();
  const { data } = await client.get(`/instance/${instanceId}/qrcode`);
  return data;
}

/**
 * Retorna o status atual da instância.
 * @param {string} instanceId
 */
async function getStatus(instanceId) {
  const client = getClient();
  const { data } = await client.get(`/instance/${instanceId}/status`);
  return data;
}

/**
 * Envia mensagem de texto simples.
 * @param {string} instanceId
 * @param {string} phone - Número no formato internacional (ex: 5511999999999)
 * @param {string} message
 */
async function sendText(instanceId, phone, message) {
  const client = getClient();
  const { data } = await client.post(`/message/${instanceId}/sendText`, {
    phone,
    message,
  });
  return data;
}

/**
 * Simula digitação antes de enviar a mensagem.
 * @param {string} instanceId
 * @param {string} phone
 * @param {number} duration - Duração em milissegundos
 */
async function sendTyping(instanceId, phone, duration) {
  const client = getClient();
  const { data } = await client.post(`/message/${instanceId}/sendTyping`, {
    phone,
    duration,
  });
  return data;
}

/**
 * Verifica se um número existe no WhatsApp.
 * @param {string} instanceId
 * @param {string} phone
 */
async function checkNumber(instanceId, phone) {
  const client = getClient();
  const { data } = await client.post(`/contact/${instanceId}/checkNumber`, {
    phone,
  });
  return data;
}

/**
 * Desconecta a instância do WhatsApp.
 * @param {string} instanceId
 */
async function disconnect(instanceId) {
  const client = getClient();
  const { data } = await client.post(`/instance/${instanceId}/disconnect`);
  return data;
}

module.exports = {
  createInstance,
  getQRCode,
  getStatus,
  sendText,
  sendTyping,
  checkNumber,
  disconnect,
};
