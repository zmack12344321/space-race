import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearChatNotice, myPlayer, sendChat, useChat, useChatNotice } from "../../multiplayer/party";
import { useIsTouchDevice } from "./useIsTouchDevice";

export const RoomChat = ({ blocked = false }) => {
  const messages = useChat();
  const notice = useChatNotice();
  const me = myPlayer();
  const isTouchDevice = useIsTouchDevice();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const prevCountRef = useRef(messages.length);
  const latest = messages[messages.length - 1];
  const selfId = me?.id;
  const latestText = latest
    ? `${latest.playerId === selfId ? "You" : latest.name || "Rider"}: ${latest.text}`
    : "No chat yet";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === "Escape") {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
        return;
      }

      if (!open && event.code === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !blocked) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (blocked) return;
      if (event.code === "Enter") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (blocked) {
      setOpen(false);
      setDraft("");
      inputRef.current?.blur();
    }
  }, [blocked]);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    const nextCount = messages.length;
    if (nextCount > prevCount) {
      const fresh = messages.slice(prevCount);
      fresh.forEach((msg) => {
        const toast = {
          id: msg.id,
          mine: msg.playerId === selfId,
          name: msg.playerId === selfId ? "You" : msg.name || "Rider",
          text: msg.text,
        };
        setToasts((current) => [...current, { ...toast, visible: true }].slice(-3));
        window.setTimeout(() => {
          setToasts((current) => current.map((item) => (item.id === msg.id ? { ...item, visible: false } : item)));
        }, 2200);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== msg.id));
        }, 2900);
      });
    }
    prevCountRef.current = nextCount;
  }, [messages, selfId]);

  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => clearChatNotice(), 2000);
    return () => clearTimeout(timeout);
  }, [notice]);

  if (!me) return null;
  if (blocked) return null;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    sendChat(text);
    setDraft("");
    setOpen(false);
  };

  return (
    <div
      className={`fixed left-4 z-40 flex flex-col overflow-visible rounded-[18px] border border-cyan-300/20 bg-[rgba(6,10,18,0.55)] text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-cyan-300/20 backdrop-blur-sm ${open ? "w-[min(92vw,24rem)]" : "w-[17rem]"}`}
      style={{ bottom: isTouchDevice ? 176 : 16 }}
    >
      {!open && toasts.length > 0 && (
        <div className="pointer-events-none absolute bottom-full left-0 mb-2 flex w-full flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`w-full rounded-[18px] border border-cyan-300/15 bg-slate-950/90 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-cyan-300/10 transition-all duration-700 ${toast.visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-100/40">
                <span className={toast.mine ? "text-cyan-200" : "text-cyan-50/70"}>{toast.name}</span>
                <span>chat</span>
              </div>
              <div className="mt-1 break-words text-[12px] leading-4 text-cyan-50">{toast.text}</div>
            </div>
          ))}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/15 bg-white/5 text-cyan-200">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]">
              <path d="M4 5h16v10H7l-3 3V5Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] leading-4 text-cyan-50/80">{latestText}</div>
          </div>
        </button>
      )}
      {open && (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-cyan-300/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100/45">
            <span>Chat</span>
            <button
              type="button"
              aria-label="Close chat"
              className="rounded-full border border-cyan-300/15 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50/80 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div ref={logRef} className="game-menu-scroll max-h-[min(32vh,18rem)] overflow-y-auto px-3 py-2 text-sm leading-5">
            {messages.length ? (
              <div className="space-y-2 controls-font">
                {messages.map((msg) => {
                  const mine = msg.playerId === me.id;
                  return (
                    <div key={msg.id} className={`rounded-xl px-3 py-2 ${mine ? "bg-cyan-400/12" : "bg-white/5"}`}>
                      <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-cyan-100/40">
                        <span className={mine ? "text-cyan-200" : "text-cyan-50/70"}>{mine ? "You" : msg.name || "Rider"}</span>
                        <span>{new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="mt-1 break-words text-[13px] text-cyan-50">{msg.text}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-cyan-50/45">No chat yet.</div>
            )}
          </div>
          <form
            className="border-t border-cyan-300/10 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                maxLength={200}
                placeholder="Type message"
                className="controls-font min-w-0 flex-1 rounded-xl border border-cyan-300/10 bg-black/35 px-3 py-2 text-[14px] text-cyan-50 outline-none placeholder:text-cyan-50/30 focus:border-cyan-300/50"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.currentTarget.blur();
                    setOpen(false);
                  }
                }}
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-cyan-200 px-3 py-2 text-[12px] font-black uppercase tracking-[0.14em] text-slate-950"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
