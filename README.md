# Auto-aggiornamento TAN/TAEG con GitHub Actions + Pages (senza server)

Questo kit aggiorna **automaticamente** l'indice base (es. €STR 3M composto) e lo espone in `config/tassi.json`.
La tua pagina (`public/index.html`) legge quel JSON e ricalcola TAN/TAEG.

## Come usare

1. Crea un **nuovo repo GitHub** e copia tutto il contenuto di questa cartella nella **root** del repo.
2. Abilita **GitHub Pages**: Settings → Pages → Source = `GitHub Actions` (consigliato) *oppure* `main / root`.
3. Verifica che `https://<utente>.github.io/<repo>/config/tassi.json` sia raggiungibile dopo il primo commit.
4. L'**action** aggiorna ogni giorno (cron `5 9 * * *` UTC) `config/tassi.json` chiamando l'ECB (nuovo endpoint → fallback SDW).
5. La pagina `public/index.html` mostra un badge con l'indice e la data: chiama `GET /config/tassi.json`.

> Se vuoi ospitare la pagina altrove, lascia comunque il workflow attivo: la tua pagina potrà leggere
> `https://raw.githubusercontent.com/<utente>/<repo>/main/config/tassi.json?ts=...` (CORS consentito).

## Personalizza
- **Serie (indice)**: in `scripts/update_tassi.js` modifica `SERIES` se vuoi 1M/6M (1M=`...QF24.CR`, 6M=`...QF40.CR`).
- **Spreads** e `extraFisso`: sono in `config/tassi.json` e nella pagina; puoi mantenerli nel JSON e leggerli lato client.
- **Orario**: cambia il cron nel workflow.

## Note
- Se ti serve **Euribor®** ufficiale, serve licenza/vendor: sostituisci `update_tassi.js` per leggere il tuo endpoint autorizzato.
- Con €STR non ci sono le limitazioni di licenza dell’Euribor, ed è pubblicato dall'ECB.

Buon lavoro!
