const { createClient } = require('@supabase/supabase-js');

// Não lançar erro no startup — deixar o servidor subir mesmo sem env vars
// O erro vai aparecer quando a rota /health/db for chamada
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Testa a conexão fazendo um select simples na tabela campaigns.
 * Retorna true se OK, lança erro se falhar.
 */
async function testConnection() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados');
  }
  const { data, error } = await supabase.from('campaigns').select('id').limit(1);
  if (error) throw new Error(`Supabase connection error: ${error.message}`);
  console.log('[supabase] Conexão OK — campaigns select retornou:', data);
  return true;
}

module.exports = { supabase, testConnection };
