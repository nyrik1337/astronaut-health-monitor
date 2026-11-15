import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeYDomain } from '../domain/chartDomain';
import { formatClock, formatDateTime, formatNumber, withUnit } from '../domain/format';
import type { MetricDefinition } from '../domain/metrics';
import type { SeriesPoint } from '../domain/readings';
import { CHART_COLORS } from '../theme';
import { useT } from '../i18n';
import { vitalLabel } from './vitalLabel';

type Props = {
  definition: MetricDefinition;
  series: readonly SeriesPoint[];
  median: number | null;
};

const CHART_HEIGHT = 200;
/** Size used before the container is measured, so the first paint does not render an empty chart. */
const INITIAL_DIMENSION = { width: 640, height: CHART_HEIGHT };
const AXIS_TICK = { fill: CHART_COLORS.muted, fontSize: 12 };

function chartSummary(definition: MetricDefinition, series: readonly SeriesPoint[], median: number | null): string {
  const first = series[0];
  const last = series.at(-1);
  if (first === undefined || last === undefined) {
    return `${definition.label}: no readings.`;
  }
  const latest = last.value === null ? 'missing' : withUnit(formatNumber(last.value, definition.decimals), definition.unit);
  const medianText = median === null ? 'no personal median available' : `personal median ${withUnit(formatNumber(median, definition.decimals), definition.unit)}`;
  return `${definition.label} over ${series.length} readings from ${formatDateTime(first.time)} to ${formatDateTime(last.time)}. Latest ${latest}; ${medianText}.`;
}

export function MetricChart({ definition, series, median }: Props) {
  const { t } = useT();
  const label = vitalLabel(definition, t);
  const values = series.flatMap((point) => (point.value === null ? [] : [point.value]));
  const domain = computeYDomain(values, median, definition.decimals);

  if (domain === null) {
    return <p className="chart-empty">{t('mch.empty', { metric: label })}</p>;
  }

  const formatValue = (value: number): string => formatNumber(value, definition.decimals);

  return (
    <div className="chart" role="img" aria-label={chartSummary(definition, series, median)}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={INITIAL_DIMENSION}>
        {/* The wrapper is role="img" with a text summary and the data table is the keyboard/screen-reader
            alternative, so Recharts' focusable accessibility layer is disabled to avoid a focus trap inside an image. */}
        <LineChart data={[...series]} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.rule} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatClock}
            tick={AXIS_TICK}
            stroke={CHART_COLORS.ink}
            minTickGap={24}
          />
          <YAxis domain={[domain[0], domain[1]]} tickFormatter={formatValue} tick={AXIS_TICK} stroke={CHART_COLORS.ink} width={48} />
          <Tooltip
            labelFormatter={(label) => (typeof label === 'number' ? formatDateTime(label) : label)}
            formatter={(value) => [
              typeof value === 'number' ? withUnit(formatValue(value), definition.unit) : 'Missing',
              label,
            ]}
            contentStyle={{ border: `1px solid ${CHART_COLORS.rule}`, borderRadius: 6, background: CHART_COLORS.surface, color: CHART_COLORS.ink }}
          />
          {median !== null && (
            <ReferenceLine
              y={median}
              stroke={CHART_COLORS.accent}
              strokeWidth={2}
              label={{ value: t('mch.median', { value: formatValue(median) }), position: 'insideTopLeft', fill: CHART_COLORS.accent, fontSize: 12 }}
            />
          )}
          <Line
            type="linear"
            dataKey="value"
            stroke={CHART_COLORS.ink}
            strokeWidth={1.5}
            dot={{ r: 2, fill: CHART_COLORS.ink, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
