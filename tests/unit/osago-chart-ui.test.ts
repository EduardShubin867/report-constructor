import { buildOsagoChartLegendItems } from '@/lib/osago-chart-ui';
import type { OsagoChartSpec } from '@/lib/report-history-types';

describe('osago chart UI helpers', () => {
  it('builds series and threshold legend items for line charts', () => {
    const spec: OsagoChartSpec = {
      id: 'loss-ratio',
      type: 'line',
      title: 'Loss ratio',
      xKey: 'month',
      valueType: 'percent',
      series: [
        { key: 'lr', label: 'LR' },
        { key: 'target', label: 'Цель' },
      ],
      thresholds: [{ value: 75, label: 'Порог', tone: 'warning' }],
      data: [{ month: '2026-01', lr: 80, target: 75 }],
    };

    expect(buildOsagoChartLegendItems(spec)).toEqual([
      { id: 'series:lr', label: 'LR', color: '#2563eb', variant: 'solid' },
      { id: 'series:target', label: 'Цель', color: '#16a34a', variant: 'solid' },
      { id: 'threshold:Порог:75', label: 'Порог', color: '#f59e0b', variant: 'dashed' },
    ]);
  });

  it('builds segment legend items for pie charts', () => {
    const spec: OsagoChartSpec = {
      id: 'segments',
      type: 'pie',
      title: 'Segments',
      labelKey: 'segment',
      valueKey: 'premium',
      valueType: 'money',
      data: [
        { segment: 'Такси', premium: 120 },
        { segment: 'Личные', premium: 240 },
      ],
    };

    expect(buildOsagoChartLegendItems(spec)).toEqual([
      { id: 'segment:Такси:0', label: 'Такси', color: '#2563eb', variant: 'solid' },
      { id: 'segment:Личные:1', label: 'Личные', color: '#16a34a', variant: 'solid' },
    ]);
  });
});
