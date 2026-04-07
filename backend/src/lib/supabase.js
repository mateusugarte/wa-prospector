const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Testa a conexão fazendo um select simples na tabela campaigns.
 * Retorna true se OK, lança erro se falhar.
 */
async function testConnection() {
  const { data, error } = await supabase.from('campaigns').select('id').limit(1);
  if (error) throw new Error(`Supabase connection error: ${error.message}`);
  console.log('[supabase] Conexão OK — campaigns select retornou:', data);
  return true;
}

module.exports = { supabase, testConnection };
