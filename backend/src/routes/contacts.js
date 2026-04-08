const router = require('express').Router();
const { supabase } = require('../lib/supabase');
const { ApifyClient } = require('apify-client');

function getApify() {
  const token = process.env.APIFY_TOKEN;
  if (!token || token === 'SEU_TOKEN_APIFY_AQUI') {
    throw new Error('APIFY_TOKEN não configurado no servidor');
  }
  return new ApifyClient({ token });
}

// GET /api/contacts/niches — lista nichos com totais e disponíveis
router.get('/niches', async (req, res) => {
  try {
    const { data: all } = await supabase.from('contacts').select('niche, sent_count');
    const map = {};
    for (const c of (all || [])) {
      if (!map[c.niche]) map[c.niche] = { niche: c.niche, total: 0, available: 0 };
      map[c.niche].total++;
      if (c.sent_count === 0) map[c.niche].available++;
    }
    res.json(Object.values(map).sort((a, b) => a.niche.localeCompare(b.niche)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts?niche=xxx&page=1
router.get('/', async (req, res) => {
  try {
    const { niche, page = 1 } = req.query;
    const size = 50;
    const from = (page - 1) * size;
    let q = supabase.from('contacts').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);
    if (niche) q = q.eq('niche', niche);
    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    res.json({ contacts: data || [], total: count || 0, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/available?niche=xxx&quantity=50
router.get('/available', async (req, res) => {
  try {
    const { niche, quantity = 10 } = req.query;
    if (!niche) return res.status(400).json({ error: 'niche é obrigatório' });
    const { data, error } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .eq('niche', niche)
      .eq('sent_count', 0)
      .order('created_at')
      .limit(Number(quantity));
    if (error) throw new Error(error.message);
    res.json({ contacts: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/import — importar via Apify
router.post('/import', async (req, res) => {
  try {
    const { niche, actorId, searchTerms, maxResults = 100 } = req.body;
    if (!niche || !actorId || !searchTerms) {
      return res.status(400).json({ error: 'niche, actorId e searchTerms são obrigatórios' });
    }

    const apify = getApify();
    const terms = searchTerms.split('\n').map(s => s.trim()).filter(Boolean);
    const perTerm = Math.max(1, Math.ceil(maxResults / terms.length));

    console.log(`[apify] iniciando | nicho: ${niche} | actor: ${actorId} | termos: ${terms.length}`);
    res.json({ status: 'running', message: 'Importação iniciada, aguarde...' });

    // Roda em background para não segurar a requisição
    setImmediate(async () => {
      try {
        const run = await apify.actor(actorId).call({
          searchStringsArray: terms,
          maxCrawledPlacesPerSearch: perTerm,
          language: 'pt',
        }, { waitSecs: 600 });

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        console.log(`[apify] ${items.length} resultados recebidos`);

        const contacts = [];
        for (const item of items) {
          const rawPhone =
            item.phone || item.phoneNumber || item.telefone ||
            item.contact?.phone || item.phones?.[0] ||
            item.telephone || item.tel;
          const name =
            item.name || item.title || item.businessName || item.company || null;

          if (rawPhone) {
            const phone = String(rawPhone).replace(/\D/g, '');
            if (phone.length >= 10) contacts.push({ phone, name: name || null, niche });
          }
        }

        if (contacts.length > 0) {
          await supabase.from('contacts')
            .upsert(contacts, { onConflict: 'phone,niche', ignoreDuplicates: true });
        }
        console.log(`[apify] ${contacts.length} contatos salvos no nicho: ${niche}`);
      } catch (err) {
        console.error('[apify] erro na importação:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/niche/:niche — deleta todos de um nicho
router.delete('/niche/:niche', async (req, res) => {
  try {
    const { error } = await supabase.from('contacts').delete().eq('niche', decodeURIComponent(req.params.niche));
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
