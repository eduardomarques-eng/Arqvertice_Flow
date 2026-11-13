"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
  getTeamContactsAction,
  getConversationMessagesAction,
  sendInternalMessageAction,
  getUnreadMessagesCountAction,
  type MessengerContact,
  type ChatMessage,
} from "@/server/actions/messenger";

const QUICK_EMOJIS = ["👍", "🏗️", "📐", "🏛️", "⚡", "💧", "✅", "⚠️", "🚀", "😀"];

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamInternalMessenger({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<MessengerContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MessengerContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [isPending, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (selectedContact) {
      scrollToBottom();
    }
  }, [messages, selectedContact]);

  // Carrega contatos e total não lidas
  const refreshContacts = async () => {
    try {
      const list = await getTeamContactsAction();
      setContacts(list);
      const total = await getUnreadMessagesCountAction();
      setUnreadTotal(total);
    } catch {
      // Ignora erro temporário
    }
  };

  // Carrega mensagens do contato selecionado
  const loadMessages = async (contactId: string) => {
    try {
      const list = await getConversationMessagesAction(contactId);
      setMessages(list);
    } catch {
      // Ignora erro temporário
    }
  };

  // Polling para contatos e novas mensagens
  useEffect(() => {
    refreshContacts();
    const interval = setInterval(() => {
      refreshContacts();
      if (selectedContact) {
        loadMessages(selectedContact.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContact]);

  const handleSelectContact = (contact: MessengerContact) => {
    setSelectedContact(contact);
    loadMessages(contact.id);
  };

  const handleSendMessage = () => {
    if (!selectedContact || !inputText.trim()) return;

    const content = inputText.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: currentUserId,
      receiverId: selectedContact.id,
      content,
      isRead: false,
      createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isMine: true,
    };

    // Optimistic UI imediato
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");

    startTransition(async () => {
      try {
        const res = await sendInternalMessageAction(selectedContact.id, content);
        if (res.success && res.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
        }
      } catch {
        // Remove otimista se falhar
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    });
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => `${prev} ${emoji} `.trim());
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none font-sans">
      {/* Botão Flutuante quando Minimizado */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            refreshContacts();
          }}
          className="group relative flex min-h-[48px] items-center gap-2.5 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-slate-800 active:scale-95 transition-all duration-150 border border-slate-700/60"
          aria-label="Abrir Mensageiro da Equipe"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm shadow-xs">
            💬
          </span>
          <span className="hidden sm:inline">Chat da Equipe</span>

          {unreadTotal > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-sm animate-pulse">
              {unreadTotal}
            </span>
          )}
        </button>
      )}

      {/* Caixa do Mensageiro Expandida */}
      {isOpen && (
        <div className="flex h-[520px] w-[360px] sm:w-[420px] flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header Superior */}
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💬</span>
              <div>
                <h3 className="text-xs font-bold tracking-tight">Mensageiro Interno da Equipe</h3>
                <p className="text-[10px] text-slate-400">Canal exclusivo entre profissionais técnicos</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {selectedContact && (
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  title="Voltar aos contatos"
                >
                  ← Contatos
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
                title="Minimizar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modo 1: Lista de Contatos da Equipe */}
          {!selectedContact && (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Profissionais Conectados ({contacts.length})
              </p>

              {contacts.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-400">
                  Nenhum outro profissional cadastrado na equipe.
                </p>
              ) : (
                contacts.map((contact) => {
                  const presenceColor =
                    contact.status === "Online"
                      ? "bg-emerald-500"
                      : contact.status === "Ausente"
                      ? "bg-amber-500"
                      : "bg-slate-300";

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center justify-between rounded-2xl p-2.5 text-left hover:bg-slate-50 border border-transparent hover:border-slate-200 transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar com Dot de Presença */}
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-xs">
                          {getInitials(contact.name)}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${presenceColor}`}
                            title={`Status: ${contact.status}`}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{contact.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {contact.specialty || contact.role} · <span className="font-semibold">{contact.status}</span>
                          </p>
                        </div>
                      </div>

                      {contact.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                          {contact.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Modo 2: Janela de Conversa Ativa com Contato */}
          {selectedContact && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Barra do Contato Selecionado */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      selectedContact.status === "Online"
                        ? "bg-emerald-500"
                        : selectedContact.status === "Ausente"
                        ? "bg-amber-500"
                        : "bg-slate-300"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{selectedContact.name}</p>
                    <p className="text-[10px] text-slate-500">{selectedContact.status}</p>
                  </div>
                </div>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-[#f8fafc]/50">
                {messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-400">
                    Inicie uma conversa técnica com {selectedContact.name}.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.isMine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                          m.isMine
                            ? "bg-blue-600 text-white rounded-br-xs"
                            : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      <span className="mt-0.5 px-1 text-[9px] text-slate-400">{m.createdAt}</span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra Rápida de Emojis */}
              <div className="flex items-center gap-1 border-t border-slate-100 bg-white px-3 py-1.5 overflow-x-auto scrollbar-none">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm hover:bg-slate-100 active:scale-95 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Input e Botão de Envio */}
              <div className="flex items-center gap-2 border-t border-slate-200/80 bg-white p-2.5">
                <input
                  type="text"
                  placeholder={`Mensagem para ${selectedContact.name.split(" ")[0]}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  disabled={!inputText.trim() || isPending}
                  onClick={handleSendMessage}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition disabled:opacity-40"
                  title="Enviar mensagem"
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

