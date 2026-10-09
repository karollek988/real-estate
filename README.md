# Köpanalys

Köpanalys ([kopanalys.se](https://kopanalys.se)) är en oberoende granskning av bostaden du vill köpa: föreningens
ekonomi i klartext, området och kostnaderna som inte står i annonsen. Kunden köper ett paket — Områdesanalys 99 kr,
Trygghetspaket 499 kr eller Tre bostäder 999 kr — och får en rapport på webben och som PDF. BRF-analysen granskas av
en person inom 24 timmar; resten tas fram automatiskt. Rapporten ger fakta med källor, aldrig betyg eller köpråd.

Sajten finns på svenska och engelska. Aktuellt läge och kända problem: [PROJECT_STATE.md](PROJECT_STATE.md).

## Hur det hänger ihop

```text
frontend/  Next.js-appen (sajt, kundkonto, rapport, admin)  ──► Vercel
api/ + analysis_engine/ + BRF-Scraper/ + src/  Python-motorn  ──► Railway (Dockerfile i roten)
supabase/  databasschemat (migrationer)                       ──► Supabase (samma databas för Preview och Production)
```

En merge till `main` går ut på alla domäner och till Railway på en gång. Databasen ändras aldrig av en deploy.
Mer: [docs/architecture/overview.md](docs/architecture/overview.md) och
[docs/operations/environments.md](docs/operations/environments.md).

## Mappar

| Mapp | Innehåll |
|---|---|
| `frontend/` | Next.js 16 (App Router), React 19, Sass, next-intl. Se [frontend/README.md](frontend/README.md) |
| `api/` | FastAPI-tjänsten som appen anropar. Se [api/README.md](api/README.md) |
| `analysis_engine/` | BRF-nyckeltal och regelbaserade iakttagelser (Python) |
| `BRF-Scraper/` | Läser en **uppladdad** årsredovisning (PDF, Word, foto). Hämtar inget själv — namnet är historiskt. Se [BRF-Scraper/README.md](BRF-Scraper/README.md) |
| `src/location_intelligence/`, `src/market_intelligence/` | Område- och marknadsdata (Python) |
| `supabase/` | Migrationer och konfiguration för den lokala databasen |
| `docs/` | Dokumentation. Börja i [docs/README.md](docs/README.md) |

## Kom igång lokalt (Windows)

Krav: Node.js 24, Docker Desktop, Supabase CLI och — för Python-motorn — Python 3.13.

```powershell
./start-local.ps1
```

Skriptet startar den lokala Supabase-databasen i Docker, läser dess nycklar och startar appen på
<http://localhost:3001>. Utan skriptet: kopiera `frontend/.env.example` till `frontend/.env.local`, fyll i värdena och
kör `npm ci` och `npm run dev` i `frontend/`. Python-motorn startas enligt [api/README.md](api/README.md).
Lägg aldrig riktiga nycklar i något annat än `.env.local` — repot är publikt.

## Tester

Samma kontroller som CI kör (detaljer i [CONTRIBUTING.md](CONTRIBUTING.md)):

```bash
cd frontend && npm run typecheck && npm run i18n:check && npm run verify
python -m pytest api/tests
```

## Att arbeta i repot

`main` är alltid produktionsklar och ändras bara via pull request från en `feature/`-, `fix/`- eller
`refactor/`-gren, med godkänd CI (inget godkännande krävs). Rutinen finns i [CONTRIBUTING.md](CONTRIBUTING.md) (på engelska).
Instruktioner för Claude Code finns i [CLAUDE.md](CLAUDE.md).

## Licens

Koden är **inte öppen källkod**. Den är synlig för att kunna läsas, men får inte kopieras, ändras, driftsättas eller
erbjudas som tjänst utan skriftligt tillstånd. Villkoren finns i [LICENSE](LICENSE) (på engelska).
