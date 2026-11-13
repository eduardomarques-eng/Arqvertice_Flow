"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TeamContact {
  id: string;
  name: string;
  role: string;
  specialty: string | null;
  presence: "ONLINE" | "AUSENTE" | "OFFLINE";
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const QUICK_EMOJIS = [
  "👍", "✅", "📐", "🏗️", "🔥", "👏", "⚠️", "📄",
  "🤝", "🚀", "💡", "🙏", "😊", "👀", "⏳", "🎯",
];

export function InternalMessengerWidget({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<TeamContact | null>(null);
  const [contacts, setContacts] = useState<TeamContact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [inputText, setInputText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchSync = useCallback(async () => {
    try {
      const url = activeContact
        ? `/api/messenger/sync?withUserId=${activeContact.id}`
        : `/api/messenger/sync`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setTotalUnread(data.totalUnread || 0);
        setUnreadByUser(data.unreadByUser || {});
        if (activeContact && data.messages) {
          setMessages(data.messages);
          // Marca como lido se houver não lidas
          if (data.unreadByUser?.[activeContact.id] > 0) {
            fetch("/api/messenger/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fromUserId: activeContact.id }),
            }).catch(() => null);
          }
        }
      }
    } catch {
      // Ignora erro de rede temporário
    }
  }, [activeContact]);

  useEffect(() => {
    fetchSync();
    // 5 segundos aberto / 15 segundos minimizado
    const intervalTime = isOpen ? 5000 : 15000;
    const interval = setInterval(fetchSync, intervalTime);
    return () => clearInterval(interval);
  }, [isOpen, fetchSync]);

  useEffect(() => {
    if (activeContact) {
      scrollToBottom("auto");
    }
  }, [activeContact, messages.length]);

  const handleSelectContact = (contact: TeamContact) => {
    setActiveContact(contact);
    setShowEmojiPicker(false);
    // Marca lidas
    fetch("/api/messenger/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId: contact.id }),
    }).catch(() => null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeContact || isSending) return;

    const content = inputText.trim();
    setInputText("");
    setShowEmojiPicker(false);

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: currentUserId,
      receiverId: activeContact.id,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom("smooth");

    setIsSending(true);
    try {
      const res = await fetch("/api/messenger/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: activeContact.id, content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      }
    } catch {
      // Falha
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* BOTÃO FLUTUANTE MINIMIZADO */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-40 flex h-11 items-center gap-2.5 rounded-full bg-zinc-950/95 px-4 text-xs font-bold text-white shadow-2xl backdrop-blur-xl border border-zinc-800/90 transition-all hover:bg-zinc-900 active:scale-95 cursor-pointer"
          aria-label="Abrir Mensageiro da Equipe"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <svg className="h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden sm:inline">Equipe</span>
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 font-mono text-[11px] font-bold text-zinc-950">
              {totalUnread}
            </span>
          )}
        </button>
      )}

      {/* JANELA EXPANDIDA COMPACTA */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-40 flex flex-col overflow-hidden rounded-2xl bg-zinc-950/95 text-white shadow-2xl backdrop-blur-xl border border-zinc-800/90 w-[calc(100vw-2rem)] max-w-[360px] h-[62vh] max-h-[440px] lg:w-[330px] lg:h-[430px] animate-in fade-in zoom-in-95 duration-200">
          
          {/* CABEÇALHO */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              {activeContact && (
                <button
                  type="button"
                  onClick={() => setActiveContact(null)}
                  className="mr-1 -ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                  title="Voltar para contatos"
                >
                  ←
                </button>
              )}
              <div>
                <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  {activeContact ? activeContact.name : "Chat da Equipe Técnica"}
                </h4>
                <p className="text-[10px] text-zinc-400">
                  {activeContact ? (
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          activeContact.presence === "ONLINE"
                            ? "bg-emerald-500"
                            : activeContact.presence === "AUSENTE"
                            ? "bg-amber-400"
                            : "bg-zinc-600"
                        }`}
                      />
                      {activeContact.presence === "ONLINE"
                        ? "Online"
                        : activeContact.presence === "AUSENTE"
                        ? "Ausente"
                        : "Offline"}
                      {activeContact.specialty ? ` · ${activeContact.specialty}` : ""}
                    </span>
                  ) : (
                    "Comunicação interna direta"
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              title="Minimizar"
            >
              ✕
            </button>
          </div>

          {/* CORPO: TELA 1 (LISTA) OU TELA 2 (CONVERSA) */}
          {!activeContact ? (
            /* TELA 1 — LISTA DA EQUIPE */
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/80 p-2">
              {contacts.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  Nenhum colega ativo no momento.
                </div>
              ) : (
                contacts.map((c) => {
                  const unread = unreadByUser[c.id] || 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectContact(c)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-zinc-900 transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-xs font-bold text-zinc-200">
                          {c.name.slice(0, 2).toUpperCase()}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${
                              c.presence === "ONLINE"
                                ? "bg-emerald-500"
                                : c.presence === "AUSENTE"
                                ? "bg-amber-400"
                                : "bg-zinc-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-zinc-200">{c.name}</p>
                          <p className="truncate text-[10px] text-zinc-500">
                            {c.specialty || c.role}
                          </p>
                        </div>
                      </div>

                      {unread > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[10px] font-bold text-zinc-950">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* TELA 2 — CONVERSA DIRETA */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-smooth">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    Inicie a conversa técnica com {activeContact.name.split(" ")[0]}.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId === currentUserId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            isMine
                              ? "bg-white text-zinc-950 rounded-br-xs font-medium"
                              : "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-bl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p
                            className={`mt-1 text-[9px] text-right ${
                              isMine ? "text-zinc-500" : "text-zinc-500"
                            }`}
                          >
                            {formatMessageTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* SELETOR DE EMOJIS COMPACTO */}
              {showEmojiPicker && (
                <div className="border-t border-zinc-800 bg-zinc-900/90 p-2 grid grid-cols-8 gap-1 animate-in fade-in duration-100">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText((prev) => prev + emoji)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-zinc-800 text-sm transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* INPUT DE ENVIO */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-1.5 border-t border-zinc-800 p-2 bg-zinc-900/60"
              >
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer text-sm"
                  title="Inserir Emoji"
                >
                  😊
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Mensagem..."
                  className="flex-1 min-h-[32px] rounded-lg bg-zinc-950 px-2.5 text-xs text-white placeholder-zinc-500 border border-zinc-800 focus:outline-none focus:border-zinc-600"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition active:scale-95 disabled:opacity-40 cursor-pointer text-xs"
                >
                  ↑
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}

