import { domainLabels, stateLabels } from '../mission/explain';
import { CREW_IDS, DOMAIN_IDS } from '../mission/types';
import type { CellState, CrewId, DomainId } from '../mission/types';
import { SHORT_STATE, crewLabel } from './labels';

export interface CellSelection {
  readonly crew: CrewId;
  readonly domain: DomainId;
}

type Props = {
  day: number;
  /** [crew index][domain index] */
  grid: readonly (readonly CellState[])[];
  selected: CellSelection | null;
  onSelect: (selection: CellSelection) => void;
};

export function CrewGrid({ day, grid, selected, onSelect }: Props) {
  return (
    <section className="crew-grid" aria-labelledby="crew-grid-heading">
      <h3 id="crew-grid-heading" className="section-heading">
        Signal category by crew member and domain
      </h3>
      <div className="crew-grid__scroll">
        <table>
          <caption className="visually-hidden">
            Signal categories on day {day} for four synthetic crew members. Select a cell for
            measurement details.
          </caption>
          <thead>
            <tr>
              <th scope="col">Crew</th>
              {DOMAIN_IDS.map((domain) => (
                <th key={domain} scope="col">
                  {domainLabels[domain]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CREW_IDS.map((crew, crewIndex) => (
              <tr key={crew}>
                <th scope="row">{crewLabel(crew)}</th>
                {DOMAIN_IDS.map((domain, domainIndex) => {
                  const state = grid[crewIndex]?.[domainIndex] ?? 'no_data';
                  const isSelected = selected?.crew === crew && selected.domain === domain;
                  return (
                    <td key={domain}>
                      <button
                        type="button"
                        className="crew-cell"
                        data-state={state}
                        aria-pressed={isSelected}
                        aria-label={`${crewLabel(crew)}, ${domainLabels[domain]}: ${stateLabels[state]}. Show measurement details`}
                        onClick={() => onSelect({ crew, domain })}
                      >
                        <span className="crew-cell__marker" aria-hidden="true" />
                        <span aria-hidden="true">{SHORT_STATE[state]}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
