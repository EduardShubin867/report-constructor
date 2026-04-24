'use client';

import { Maximize2 } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  buildOsagoChartLegendItems,
  OSAGO_CHART_COLORS,
  OSAGO_CHART_NEGATIVE_COLOR,
  OSAGO_CHART_POSITIVE_COLOR,
  osagoThresholdColor,
} from '@/lib/osago-chart-ui';
import type { OsagoChartSpec } from '@/lib/report-history-types';

function formatValue(value: unknown, valueType: OsagoChartSpec['valueType']): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '');
  if (valueType === 'percent') return `${numeric.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
  if (valueType === 'money') {
    return new Intl.NumberFormat('ru-RU', {
      notation: Math.abs(numeric) >= 1_000_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(numeric);
  }
  return numeric.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

function renderChart(spec: OsagoChartSpec) {
  if ((spec.type === 'line' || spec.type === 'bar') && spec.xKey && spec.series?.length) {
    const firstSeries = spec.series[0];
    if (!firstSeries) return null;

    const common = (
      <>
        <CartesianGrid stroke="#d7dde8" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={spec.xKey}
          tick={{ fontSize: 11, fill: '#667085' }}
          tickLine={false}
          axisLine={false}
          minTickGap={18}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#667085' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={value => formatValue(value, spec.valueType)}
          width={58}
        />
        <Tooltip
          formatter={value => formatValue(value, spec.valueType)}
          labelStyle={{ color: '#111827', fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, borderColor: '#d7dde8' }}
        />
        {spec.thresholds?.map(threshold => (
          <ReferenceLine
            key={`${threshold.label}-${threshold.value}`}
            y={threshold.value}
            stroke={osagoThresholdColor(threshold.tone)}
            strokeDasharray="4 4"
            label={{ value: threshold.label, fontSize: 10, fill: osagoThresholdColor(threshold.tone) }}
          />
        ))}
      </>
    );

    if (spec.type === 'line') {
      return (
        <LineChart data={spec.data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          {common}
          {spec.series.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={OSAGO_CHART_COLORS[index % OSAGO_CHART_COLORS.length]}
              strokeWidth={2.4}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      );
    }

    return (
      <BarChart data={spec.data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        {common}
        <Bar
          dataKey={firstSeries.key}
          name={firstSeries.label}
          fill={OSAGO_CHART_POSITIVE_COLOR}
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        >
          {spec.data.map((datum, index) => (
            <Cell
              key={`${spec.id}-${index}`}
              fill={Number(datum[firstSeries.key]) < 0 ? OSAGO_CHART_NEGATIVE_COLOR : OSAGO_CHART_POSITIVE_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    );
  }

  if (spec.type === 'pie' && spec.labelKey && spec.valueKey) {
    return (
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Tooltip
          formatter={value => formatValue(value, spec.valueType)}
          contentStyle={{ borderRadius: 8, borderColor: '#d7dde8' }}
        />
        <Pie
          data={spec.data}
          dataKey={spec.valueKey}
          nameKey={spec.labelKey}
          innerRadius="48%"
          outerRadius="78%"
          paddingAngle={2}
          isAnimationActive={false}
        >
          {spec.data.map((_datum, index) => (
            <Cell key={`${spec.id}-${index}`} fill={OSAGO_CHART_COLORS[index % OSAGO_CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  return null;
}

function ChartLegend({ chart }: { chart: OsagoChartSpec }) {
  const items = buildOsagoChartLegendItems(chart);
  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-outline-variant/12 pt-2"
      aria-label="Легенда графика"
    >
      {items.map(item => (
        <div key={item.id} className="flex min-w-0 items-center gap-1.5 text-xs text-on-surface-variant">
          <span
            className="h-0 w-5 flex-shrink-0 rounded-full border-t-2"
            style={{
              borderColor: item.color,
              borderTopStyle: item.variant === 'dashed' ? 'dashed' : 'solid',
            }}
            aria-hidden="true"
          />
          <span className="truncate">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCanvas({ chart, expanded = false }: { chart: OsagoChartSpec; expanded?: boolean }) {
  return (
    <div className={expanded ? 'h-[min(70dvh,44rem)] min-h-80 w-full' : 'h-80 min-h-80 w-full sm:h-96'}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart(chart) ?? <div />}
      </ResponsiveContainer>
    </div>
  );
}

function ChartPanel({
  chart,
  expanded = false,
  onExpand,
}: {
  chart: OsagoChartSpec;
  expanded?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div
      className={
        expanded
          ? 'flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-5'
          : 'rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 sm:p-4'
      }
      data-osago-chart-card={!expanded ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-headline text-sm font-semibold text-on-surface sm:text-base">{chart.title}</h3>
        </div>
        {!expanded && onExpand && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mr-1 -mt-1 text-on-surface-variant hover:text-on-surface"
            onClick={onExpand}
            aria-label={`Открыть график "${chart.title}" на весь экран`}
            title="На весь экран"
            data-osago-chart-fullscreen
          >
            <Maximize2 className="h-4 w-4" strokeWidth={2} />
          </Button>
        )}
      </div>
      <ChartCanvas chart={chart} expanded={expanded} />
      <ChartLegend chart={chart} />
    </div>
  );
}

export default function OsagoChartCards({ charts }: { charts: OsagoChartSpec[] }) {
  const [fullscreenChart, setFullscreenChart] = useState<OsagoChartSpec | null>(null);

  if (charts.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {charts.map(chart => (
        <ChartPanel key={chart.id} chart={chart} onExpand={() => setFullscreenChart(chart)} />
      ))}
      <Dialog open={Boolean(fullscreenChart)} onOpenChange={open => !open && setFullscreenChart(null)}>
        <DialogContent
          showClose
          className="h-[92dvh] w-[96vw] max-w-[96vw] overflow-hidden rounded-2xl border border-outline-variant/20"
          data-osago-chart-dialog
        >
          <DialogHeader className="flex-shrink-0 border-b border-outline-variant/12 pb-3">
            <DialogTitle>{fullscreenChart?.title ?? 'График ОСАГО'}</DialogTitle>
          </DialogHeader>
          {fullscreenChart && <ChartPanel chart={fullscreenChart} expanded />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
