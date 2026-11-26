"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { FieldMeasurementChartData } from "@/lib/eap-measurement-charts";

interface EapMeasurementChartsPanelProps {
  chartData: FieldMeasurementChartData;
  compact?: boolean;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function EapMeasurementChartsPanel({
  chartData,
  compact = false,
}: EapMeasurementChartsPanelProps) {
  const { floorComparison, financialComposition, serviceStatusDistribution } = chartData;
  const totalStatus = serviceStatusDistribution.reduce((acc, s) => acc + s.count, 0);
  const totalPlan = Math.max(1, financialComposition.totalPlanned);

  return (
    <div className={`grid gap-4 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}>
      {/* 1. Avanço Físico por Pavimento (Previsto Linha de Balanço % vs Realizado Canteiro %) */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mb-2">
          <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
            Avanço Físico por Pavimento (%)
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Previsto Linha de Balanço versus Realizado no Canteiro
          </p>
        </div>
        {floorComparison.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-400">
            Sem pavimentos medidos neste período.
          </p>
        ) : (
          <div className={compact ? "h-52 w-full" : "h-60 w-full"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={floorComparison}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 6, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="floorName"
                  width={122}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip formatter={(val) => `${Number(val ?? 0).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  dataKey="plannedPct"
                  name="Previsto Linha de Balanço"
                  fill="#94A3B8"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="realizedPct"
                  name="Realizado no Canteiro"
                  fill="#059669"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 2. Composição Financeira da Obra (Acumulado Anterior + Medido neste Boletim + Saldo a Executar) */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mb-2">
          <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
            Composição Financeira da Obra
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Acumulado Anterior, Medido neste Boletim e Saldo a Executar
          </p>
        </div>

        {/* Barra empilhada */}
        <div className="mb-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            {financialComposition.slices.map((sl) => (
              <div
                key={sl.key}
                style={{
                  width: `${Math.max(0, Math.min(100, (sl.value / totalPlan) * 100))}%`,
                  backgroundColor: sl.colorHex,
                }}
                title={`${sl.label}: ${fmtBRL(sl.value)}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialComposition.slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={34}
                  outerRadius={54}
                  paddingAngle={2}
                >
                  {financialComposition.slices.map((sl) => (
                    <Cell key={sl.key} fill={sl.colorHex} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => fmtBRL(Number(val ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-[11px]">
            {financialComposition.slices.map((sl) => (
              <div key={sl.key} className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sl.colorHex }}
                  />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {sl.label}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-zinc-950 dark:text-zinc-100">
                    {fmtBRL(sl.value)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {sl.percent.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. Status dos Serviços em Campo */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mb-2">
          <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
            Status dos Serviços em Campo
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Distribuição de {totalStatus} frente(s) de serviço medidas
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          {serviceStatusDistribution.map((st) => {
            const pct = totalStatus > 0 ? (st.count / totalStatus) * 100 : 0;
            return (
              <div key={st.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {st.label}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    {st.count} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    style={{
                      width: `${Math.max(st.count > 0 ? 4 : 0, Math.min(100, pct))}%`,
                      backgroundColor: st.colorHex,
                    }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
