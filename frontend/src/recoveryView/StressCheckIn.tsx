export type StressRating = 1 | 2 | 3 | 4 | 5;

export const STRESS_LABELS: Record<StressRating, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Very high',
};

const RATINGS: readonly StressRating[] = [1, 2, 3, 4, 5];

type Props = {
  name: string;
  legend: string;
  value: StressRating | null;
  onChange: (value: StressRating) => void;
};

/** Voluntary 1–5 self-report. Leaving it unanswered is always allowed. */
export function StressCheckIn({ name, legend, value, onChange }: Props) {
  return (
    <fieldset className="stress-check-in">
      <legend>{legend}</legend>
      <div className="stress-check-in__options">
        {RATINGS.map((rating) => (
          <label key={rating} className="stress-check-in__option">
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
            />
            <span className="numeric">{rating}</span> {STRESS_LABELS[rating]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
