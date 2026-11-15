import { CREW_IDS, DOMAIN_IDS } from '../mission/types';
import type { CellState, CrewId, DomainId } from '../mission/types';
import { useT } from '../i18n';

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
  const { t } = useT();
  return (
    <section className="crew-grid" aria-labelledby="crew-grid-heading">
      <h3 id="crew-grid-heading" className="section-heading">
        {t('cg.title')}
      </h3>
      <div className="crew-grid__scroll">
        <table>
          <caption className="visually-hidden">
            {t('cg.caption', { day })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('cg.crew')}</th>
              {DOMAIN_IDS.map((domain) => (
                <th key={domain} scope="col">
                  {t(`domain.${domain}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CREW_IDS.map((crew, crewIndex) => (
              <tr key={crew}>
                <th scope="row">{t('cg.member', { crew })}</th>
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
                        aria-label={t('cg.cell', { crew: t('cg.member', { crew }), domain: t(`domain.${domain}`), state: t(`state.${state}`) })}
                        onClick={() => onSelect({ crew, domain })}
                      >
                        <span className="crew-cell__marker" aria-hidden="true" />
                        <span aria-hidden="true">{t(`short.${state}`)}</span>
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
