import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { BASELINE_DAYS, MISSION_DAYS } from '../mission/types';
import type { Baseline } from '../mission/types';
import { useChartColors } from '../theme';
import { formatValue } from './labels';

type Props = {
  values: readonly number[];
  baseline: Baseline | null;
  label: string;
  unit: string;
  decimals: number;
  summary: string;
};

const CHART_HEIGHT = 200;
const INITIAL_DIMENSION = { width: 640, height: CHART_HEIGHT };
const X_TICKS = [1, 100, 200, 300, 400, 500];

/** Synthetic values up to the selected day, with the personal range once it is frozen. */
export function MissionChart({ values, baseline, label, unit, decimals, summary }: Props) {
  const colors = useChartColors();
  const AXIS_TICK = { fill: colors.muted, fontSize: 12 };
  const data = values.map((value, index) => ({ day: index + 1, value }));
  const all = baseline ? [...values, baseline.lo, baseline.hi] : [...values];
  const low = Math.min(...all);
  const high = Math.max(...all);
  const pad = (high - low) * 0.1 || 1;
  const last = data.at(-1)?.day ?? 1;

  return (
    <div className="chart" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={INITIAL_DIMENSION}>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={colors.rule} />
          <XAxis
            dataKey="day"
            type="number"
            domain={[1, MISSION_DAYS]}
            ticks={X_TICKS}
            tick={AXIS_TICK}
            stroke={colors.ink}
          />
          <YAxis
            domain={[low - pad, high + pad]}
            tickFormatter={(v: number) => formatValue(v, decimals)}
            tick={AXIS_TICK}
            stroke={colors.ink}
            width={52}
            label={{ value: unit, angle: -90, position: 'insideLeft', fill: colors.muted, fontSize: 12 }}
          />
          {baseline && last > BASELINE_DAYS && (
            <ReferenceArea
              x1={BASELINE_DAYS + 1}
              x2={last}
              y1={baseline.lo}
              y2={baseline.hi}
              fill={colors.accent}
              fillOpacity={0.08}
              stroke="none"
            />
          )}
          <ReferenceLine x={BASELINE_DAYS} stroke={colors.muted} strokeDasharray="3 3" />
          <Line
            type="linear"
            dataKey="value"
            name={label}
            stroke={colors.ink}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
