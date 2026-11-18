"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";

interface SlotItem {
  time: string;
  available: boolean;
}

export default function AgendarPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayIso);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [topic, setTopic] = useState("Apresentação de Projeto & Briefing");
  const [meetingType, setMeetingType] = useState<"ONLINE" | "PRESENCIAL">("ONLINE");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    time: string;
    meetingType: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    setSelectedTime("");
    fetch(`/api/booking?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data: { slots?: SlotItem[] }) => {
        if (!active) return;
        setSlots(data.slots || []);
      })
      .catch(() => {
        if (active) setSlots([]);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      setErrorMsg("Selecione um horário disponível.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientPhone,
          topic,
          meetingType,
          date,
          time: selectedTime,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "Não foi possível confirmar o agendamento.");
      } else {
        setConfirmed({ date, time: selectedTime, meetingType });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F5F5F7] dark:bg-[#09090B] text-slate-900 dark:text-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Brand />
          <span className="inline-flex w-fit items-center rounded-full bg-[#EDE5D8] dark:bg-white/10 px-3 py-1 text-[11px] font-bold text-[#18181B] dark:text-[#EDE5D8]">
            Agenda Executiva • 45 min
          </span>
        </div>

        <Card className="p-5 sm:p-7 rounded-2xl border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#18181B] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          {confirmed ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
                ✓
              </div>
              <h1 className="text-xl font-bold">Reunião Confirmada</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Seu horário foi reservado para{" "}
                <strong>{confirmed.date}</strong> às{" "}
                <strong className="tabular-nums">{confirmed.time}</strong> (
                {confirmed.meetingType === "ONLINE"
                  ? "Videochamada"
                  : "Presencial no Estúdio"}
                ).
              </p>
              <button
                type="button"
                onClick={() => {
                  setConfirmed(null);
                  setSelectedTime("");
                }}
                className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-5 py-2 text-xs font-bold text-white dark:text-[#18181B]"
              >
                Agendar outro horário
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Agendar Reunião com o ArqVértice Studio
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Escolha a data, o melhor horário livre e informe os detalhes do seu projeto.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      Data da Reunião
                    </label>
                    <input
                      type="date"
                      min={todayIso}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#09090B] px-3 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5">
                      Horários Disponíveis
                    </label>
                    {loadingSlots ? (
                      <p className="text-xs text-slate-400">Carregando horários...</p>
                    ) : slots.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                        Sem atendimento disponível nesta data. Selecione um dia útil (segunda a sexta).
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            disabled={!s.available}
                            onClick={() => setSelectedTime(s.time)}
                            className={`min-h-[40px] rounded-xl text-xs font-semibold tabular-nums transition ${
                              !s.available
                                ? "bg-slate-100 dark:bg-white/5 text-slate-400 line-through cursor-not-allowed"
                                : selectedTime === s.time
                                  ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                                  : "border border-slate-200 dark:border-white/15 hover:bg-[#EDE5D8]/50 dark:hover:bg-white/10"
                            }`}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Nome Completo *</label>
                    <input
                      required
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">E-mail *</label>
                    <input
                      required
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold mb-1">WhatsApp</label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(85) 99999-9999"
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Formato</label>
                      <select
                        value={meetingType}
                        onChange={(e) =>
                          setMeetingType(e.target.value as "ONLINE" | "PRESENCIAL")
                        }
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                      >
                        <option value="ONLINE">Online (Meet)</option>
                        <option value="PRESENCIAL">Presencial</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Assunto *</label>
                    <input
                      required
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Breve resumo do projeto ou endereço..."
                      className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#09090B] p-2.5 text-xs"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] rounded-xl bg-[#18181B] dark:bg-[#EDE5D8] px-6 py-2 text-xs font-bold text-white dark:text-[#18181B] hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? "Confirmando..." : "Confirmar Agendamento"}
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
