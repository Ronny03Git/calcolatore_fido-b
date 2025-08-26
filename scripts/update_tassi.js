// scripts/update_tassi.js
// Aggiorna config/tassi.json con l'ultima osservazione per il tenore 3M "compounded" dell'€STR.
// Se vuoi usare un'altra serie, cambia la costante SERIES.

import fs from 'fs/promises';

const SERIES = 'EST.B.EU000A2QQF32.CR'; // €STR compounded 3M
const OUTFILE = new URL('../config/tassi.json', import.meta.url);

async function fetchCsv(url) {
  const r = await fetch(url, {
    headers: {
      'Accept': 'text/csv',
      'User-Agent': 'Mozilla/5.0 (compatible; AutoTassi/1.0)'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = (await r.text()).trim();
  if (/blocked due to security/i.test(text)) throw new Error('WAF blocked');
  const rows = text.split('\n').filter(l => l && !l.startsWith('#'));
  const last = rows[rows.length - 1].split(',');
  const date = last[0];
  const value = Number(last[1]);
  if (!Number.isFinite(value)) throw new Error('NaN value');
  return { date, value };
}

async function getLatest() {
  const urls = [
    `https://data-api.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=csvdata`,
    `https://sdw-wsrest.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=csvdata`,
  ];
  let out, lastErr;
  for (const u of urls) {
    try { out = await fetchCsv(u); return out; }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Nessun endpoint disponibile');
}

async function main() {
  const { date, value } = await getLatest();
  const raw = await fs.readFile(OUTFILE, 'utf-8').catch(() => '{}');
  const cfg = JSON.parse(raw || '{}');
  cfg.indice3m = value;
  cfg.ultimoAggiornamento = date;
  await fs.writeFile(OUTFILE, JSON.stringify(cfg, null, 2));
  console.log('Aggiornato:', { date, value });
}

main().catch(err => {
  console.error('Errore aggiornamento tassi:', err);
  process.exit(1);
});
