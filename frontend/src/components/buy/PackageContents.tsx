import { BuildingIcon, MapPinIcon, WalletIcon, CheckIcon } from "@/components/icons";
import { HUSBESIKTNING_REFERENCE_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK, formatSek } from "@/lib/pricing";

// Each analysis is introduced by the question a buyer is actually asking, so
// the package reads as "what do I find out" rather than a list of features.
const ANALYSES = [
  {
    icon: BuildingIcon,
    name: "BRF-analys",
    question: "Är föreningen ekonomiskt stabil?",
    points: [
      "Skuld per lägenhet, soliditet och likviditet",
      "Föreningens resultat och utrymme i avgiften",
      "Styrkor och svagheter i klartext",
    ],
  },
  {
    icon: MapPinIcon,
    name: "Områdesanalys",
    question: "Hur ser området ut?",
    points: [
      "Service, skolor och pendling nära bostaden",
      "Trygghet och samhällsdata för området",
      "Hur priser och befolkning utvecklas",
    ],
  },
  {
    icon: WalletIcon,
    name: "Dolda kostnader",
    question: "Vad kostar det att äga bostaden?",
    points: ["Månadskostnaden: avgift, drift och lån", "Kostnader som inte syns i annonsen"],
  },
];

export function PackageContents() {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-white">Det här får du i Trygghetspaketet</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Tre analyser av en bostad, som svarar på de tre frågorna som är svårast att se i en annons.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {ANALYSES.map(({ icon: Icon, name, question, points }) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-white">{name}</h3>
            <p className="mt-1 text-sm font-medium text-green-300">{question}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-neutral-300">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Till jämförelse</p>
        <p className="mt-2 text-lg font-semibold text-white">
          En husbesiktning kostar runt {formatSek(HUSBESIKTNING_REFERENCE_PRICE_SEK)} kr.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Trygghetspaketet kostar {TRYGGHETSPAKET_PRICE_SEK} kr och ersätter inte en besiktning. Du får svar
          på frågorna om föreningen, området och kostnaderna innan du lägger bud.
        </p>
        <p className="mt-2 text-xs text-neutral-500">Besiktningspris: Anticimex, villa, 2026.</p>
      </div>
    </section>
  );
}
