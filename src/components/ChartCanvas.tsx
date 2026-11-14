import { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartThemeColors {
  textPrimary: string;
  textMuted: string;
  gridColor: string;
  surfaceBg: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  shellYellow: string;
  shellOrange: string;
  shellBlack: string;
  shellWhite: string;
  neutralSlate: string;
  crimson: string;
}

export function getChartThemeColors(isDark: boolean): ChartThemeColors {
  return isDark
    ? {
        textPrimary: '#F5F5F4',
        textMuted: '#A1A1AA',
        gridColor: 'rgba(255, 255, 255, 0.08)',
        surfaceBg: '#141417',
        tooltipBg: '#1C1C21',
        tooltipBorder: 'rgba(255, 200, 0, 0.35)',
        tooltipText: '#FAFAFA',
        shellYellow: '#FFC800',
        shellOrange: '#F58220',
        shellBlack: '#E4E4E7',
        shellWhite: '#FFFFFF',
        neutralSlate: '#71717A',
        crimson: '#EF4444',
      }
    : {
        textPrimary: '#111111',
        textMuted: '#52525B',
        gridColor: 'rgba(17, 17, 17, 0.08)',
        surfaceBg: '#FFFFFF',
        tooltipBg: '#111111',
        tooltipBorder: '#FFC800',
        tooltipText: '#FFFFFF',
        shellYellow: '#FFC800',
        shellOrange: '#F58220',
        shellBlack: '#18181B',
        shellWhite: '#FFFFFF',
        neutralSlate: '#71717A',
        crimson: '#DC2626',
      };
}

interface ChartCanvasProps {
  config: ChartConfiguration;
  isDark: boolean;
  heightClass?: string;
  ariaLabel: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function ChartCanvas({
  config,
  isDark,
  heightClass = 'h-[280px]',
  ariaLabel,
  isEmpty = false,
  emptyMessage = 'No records match the current filters.',
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (isEmpty || !canvasRef.current) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    const theme = getChartThemeColors(isDark);

    Chart.defaults.font.family = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = theme.textMuted;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const existingPlugins = (config.options?.plugins ?? {}) as Record<string, Record<string, unknown>>;
    const existingLegend = existingPlugins.legend ?? {};
    const existingLegendLabels = (existingLegend.labels ?? {}) as Record<string, unknown>;
    const existingTooltip = existingPlugins.tooltip ?? {};

    const mergedConfig: ChartConfiguration = {
      ...config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 240,
        },
        ...config.options,
        plugins: {
          ...config.options?.plugins,
          legend: {
            ...existingLegend,
            labels: {
              color: theme.textPrimary,
              boxWidth: 10,
              boxHeight: 10,
              padding: 14,
              font: {
                size: 12,
                weight: 500,
              },
              ...existingLegendLabels,
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            titleFont: {
              weight: 600,
              size: 12,
            },
            bodyFont: {
              family: '"JetBrains Mono", monospace',
              size: 11,
            },
            ...existingTooltip,
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, mergedConfig);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config, isDark, isEmpty]);

  if (isEmpty) {
    return (
      <div
        className={`${heightClass} flex items-center justify-center rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-sm text-neutral-500 dark:text-neutral-400 px-4 text-center`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} aria-label={ariaLabel} role="img" />
    </div>
  );
}
