import type { KeyboardEvent } from "react";
import { percentText } from "@/lib/markov/fields";
import { EDGES, ROW_TOLERANCE, STATES, STATE_IDS, edgeKey, edgesFrom, stayProbability, type MarkovParams, type StateId, type TrackedId } from "@/lib/markov/model";
import { formatInt } from "@/lib/admin/stats";
import { EDGE_SHAPES, NODE_H, NODE_W, POSITIONS, SOURCE_SHAPE, VIEW } from "./diagramLayout";

const percent = (fraction: number) => `${percentText(fraction)} %`;

/** "a, b och c" */
function andList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}

/**
 * The customer state model as a picture: nine boxes and the moves between them. Each box shows how many
 * people are in it at the end of the run. Pick a box to see its moves written out; the arrows leaving it
 * get thicker the likelier the move. The complete list of numbers is in the editor under the diagram, so
 * the picture never holds information that is only in the picture.
 */
export function StateDiagram({
  params,
  populations,
  sourceLabel,
  selected,
  onSelect,
}: {
  params: MarkovParams;
  /** people per state at the end of the run; null while the boxes can't be read */
  populations: Record<TrackedId, number> | null;
  /** what the S0 box says about the monthly visitors: "3 000 / mån" */
  sourceLabel: string;
  selected: StateId | null;
  onSelect: (id: StateId | null) => void;
}) {
  const hot = (from: StateId) => selected !== null && from === selected;
  // faint arrows first, then the chosen state's, so the chosen ones are never underneath
  const drawn = EDGES.filter((edge) => EDGE_SHAPES[edgeKey(edge.from, edge.to)]);
  const ordered = [...drawn.filter((edge) => !hot(edge.from)), ...drawn.filter((edge) => hot(edge.from))];

  function onKeyDown(event: KeyboardEvent<SVGGElement>, id: StateId) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(selected === id ? null : id);
  }

  return (
    <div className="markov-diagram-scroll">
      <svg className="markov-diagram" viewBox={`0 ${VIEW.top} ${VIEW.width} ${VIEW.height}`} role="group" aria-label="Tillståndsmodell: nio tillstånd och övergångarna mellan dem">
        <defs>
          <marker id="markov-arrow-dim" className="markov-tip is-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,1 L10,5 L0,9 z" />
          </marker>
          {STATE_IDS.map((id) => (
            <marker key={id} id={`markov-arrow-${id}`} className={`markov-tip series-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,1 L10,5 L0,9 z" />
            </marker>
          ))}
        </defs>

        <path className="markov-edge is-source" d={SOURCE_SHAPE} markerEnd="url(#markov-arrow-dim)" />

        {ordered.map((edge) => {
          const key = edgeKey(edge.from, edge.to);
          const shape = EDGE_SHAPES[key];
          if (!shape) return null;
          const chance = params.transitions[key] ?? 0;
          const isHot = hot(edge.from);
          return (
            <path
              key={key}
              className={`markov-edge${isHot ? ` is-hot series-${edge.from}` : ""}${chance === 0 ? " is-none" : ""}`}
              d={shape.d}
              style={isHot ? { strokeWidth: 1.6 + 4.4 * Math.sqrt(chance) } : undefined}
              markerEnd={isHot ? `url(#markov-arrow-${edge.from})` : "url(#markov-arrow-dim)"}
            />
          );
        })}

        {STATE_IDS.map((id) => {
          const { x, y } = POSITIONS[id];
          const info = STATES[id];
          const isSource = id === "never";
          const isSelected = selected === id;
          const people = isSource ? sourceLabel : populations ? formatInt(populations[id as TrackedId]) : "–";
          return (
            <g
              key={id}
              className={`markov-node series-${id}${isSource ? " is-source" : ""}${isSelected ? " is-selected" : ""}`}
              transform={`translate(${x},${y})`}
              {...(isSource
                ? {}
                : {
                    role: "button",
                    tabIndex: 0,
                    "aria-pressed": isSelected,
                    "aria-label": `${info.code} ${info.label}, ${people} personer. ${isSelected ? "Dölj" : "Visa"} övergångarna.`,
                    onClick: () => onSelect(isSelected ? null : id),
                    onKeyDown: (event: KeyboardEvent<SVGGElement>) => onKeyDown(event, id),
                  })}
            >
              <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={12} />
              <text className="markov-node-code" y={-12} textAnchor="middle">
                {info.code}
              </text>
              <text className="markov-node-label" y={4} textAnchor="middle">
                {info.label}
              </text>
              <text className="markov-node-count" y={22} textAnchor="middle">
                {people}
              </text>
            </g>
          );
        })}

        {/* the chosen state's chances, on top of everything */}
        {drawn
          .filter((edge) => hot(edge.from))
          .map((edge) => {
            const key = edgeKey(edge.from, edge.to);
            const shape = EDGE_SHAPES[key];
            if (!shape) return null;
            return (
              <text key={key} className={`markov-edge-label series-${edge.from}`} x={shape.label.x} y={shape.label.y} textAnchor={shape.label.anchor}>
                {percent(params.transitions[key] ?? 0)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

/** The chosen state's moves in words: the same numbers as the arrows, readable without seeing them. */
export function SelectedMoves({ params, selected }: { params: MarkovParams; selected: StateId | null }) {
  if (selected === null || selected === "never") {
    return <p className="markov-note">Välj ett tillstånd i bilden för att se vart människorna går därifrån. Rutornas siffror är antalet personer i tillståndet vid slutet av körningen.</p>;
  }
  const info = STATES[selected];
  const moves = edgesFrom(selected).map((edge) => `${percent(params.transitions[edgeKey(edge.from, edge.to)] ?? 0)} till ${STATES[edge.to].label}`);
  const stays = stayProbability(params.transitions, selected);
  return (
    <p className="markov-note" aria-live="polite">
      <strong>
        {info.code} {info.label}:
      </strong>{" "}
      varje månad går {andList(moves)}
      {stays >= -ROW_TOLERANCE ? <>. Resten, {percent(Math.max(0, stays))}, stannar kvar.</> : <>. Det blir mer än 100 %: rätta rutorna nedan.</>}
    </p>
  );
}
