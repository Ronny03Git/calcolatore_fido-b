// scripts/update_tassi.js  — CommonJS, robusto, con soft-fail
const fs = require('fs/promises');

const SERIES = 'EST.B.EU000A2QQF32.CR'; // €STR 3M composto
const OUTFILE = 'config/tassi.json';

async function fetchText(url, accept = '*/*') {
  const r = await fetch(url, {
    headers: {
      'Accept': accept,
      'User-Agent': 'Mozilla/5.0 (compatible; AutoTassi/1.0; +https://github.com/)',
      'Referer': 'https://www.ecb.europa.eu/'
    }
  });
  const body = await r.text();
  if (!r.ok) {
    const snippet = body.slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`HTTP ${r.status} @ ${url} :: ${snippet}`);
  }
  return body.trim();
}

function parseCsvLast(body) {
  // filtra commenti "#", prende l’ultima riga, seconda colonna come valore
  const rows = body.split('\n').filter(l => l && !l.startsWith('#'));
  if (rows.length === 0) throw new Error('CSV vuoto');
  const last = rows[rows.length - 1].split(',');
  const date = last[0];
  const value = Number(last[1]);
  if (!Number.isFinite(value)) throw new Error('CSV: valore non numerico');
  return { date, value };
}

function tryParseSdmxJson(body) {
  // Parser tollerante per SDMX-JSON (lastNObservations=1):
  // Cerchiamo un numero nelle "observations"
  const j = JSON.parse(body);
  const ds = j.dataSets && j.dataSets[0];
  if (!ds) throw new Error('JSON SDMX: dataSets mancante');
  // Percorri tutte le series e osservazioni e prendi il primo numero
  const series = ds.series;
  if (!series) throw new Error('JSON SDMX: series mancante');
  for (const key of Object.keys(series)) {
    const arr = series[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && item.observations) {
        for (const k of Object.keys(item.observations)) {
          const v = item.observations[k];
          const num = Array.isArray(v) ? Number(v[0]) : Number(v);
          if (Number.isFinite(num)) {
            // Proviamo a recuperare la data dalle dimensioni del tempo (se esiste)
            // Altrimenti lasciamo null (verrà valorizzata più avanti se serve)
            return { date: null, value: num };
          }
        }
      }
    }
  }
  throw new Error('JSON SDMX: nessuna osservazione numerica trovata');
}

async function getLatest() {
  const urls = [
    // Nuovo Data Portal
    { url: `https://data-api.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=csvdata&detail=dataonly`, type: 'csv' },
    { url: `https://data-api.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=jsondata&detail=dataonly`, type: 'json' },
    // Vecchio SDW
    { url: `https://sdw-wsrest.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=csvdata`, type: 'csv' },
    { url: `https://sdw-wsrest.ecb.europa.eu/service/data/EST/${SERIES}?lastNObservations=1&format=jsondata`, type: 'json' },
  ];

  let lastErr;
  for (const { url, type } of urls) {
    try {
      const body = await fetchText(url, type === 'csv' ? 'text/csv,*/*;q=0.1' : 'application/json,*/*;q=0.1');
      if (/blocked due to security/i.test(body)) throw new Error('WAF blocked');
      if (type === 'csv') return parseCsvLast(body);
      const out = tryParseSdmxJson(body);
      // se la data è nulla, usiamo oggi (meglio di niente)
      if (!out.date) out.date = new Date().toISOString().slice(0,10);
      return out;
    } catch (e) {
      lastErr = e;
      console.warn('Tentativo fallito:', e.message);
    }
  }
  throw lastErr || new Error('Nessun endpoint disponibile');
}

(async function main() {
  let updated = false;
  try {
    const { date, value } = await getLatest();
    const raw = await fs.readFile(OUTFILE, 'utf-8').catch(() => '{}');
    const cfg = JSON.parse(raw || '{}');
    cfg.indice3m = value;               // percentuale
    cfg.ultimoAggiornamento = date;     // YYYY-MM-DD
    await fs.writeFile(OUTFILE, JSON.stringify(cfg, null, 2));
    console.log('Aggiornato:', { date, value });
    updated = true;
  } catch (err) {
    console.error('Aggiornamento NON riuscito:', err.message);
  }

  // Soft-fail: non facciamo fallire il job se l’ECB torna errore (lasciamo i valori precedenti)
  if (!updated) {
    console.log('Mantengo i valori correnti in config/tassi.json. Esco con codice 0.');
  }
  process.exit(0);
})();
