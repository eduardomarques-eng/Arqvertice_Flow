"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface DisciplineChartPoint {
  discipline: string;
  bomParaObra: number;
  emAndamento: number;
}

export function AcervoDisciplineChart({ data }: { data: DisciplineChartPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
        Nenhuma prancha cadastrada para exibir no gráfico por disciplina.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="discipline"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.08)",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="bomParaObra"
            name="Bom para Obra"
            stackId="a"
            fill="#18181B"
            radius={[0, 0, 6, 6]}
          />
          <Bar
            dataKey="emAndamento"
            name="Em Análise / Elaboração"
            stackId="a"
            fill="#EDE5D8"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
