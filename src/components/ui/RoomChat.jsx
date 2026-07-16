import { useEffect, useRef, useState } from "react";
import { clearChatNotice, myPlayer, sendChat, useChat, useChatNotice } from "../../multiplayer/party";
import { useIsTouchDevice } from "./useIsTouchDevice";

export const RoomChat = () => {
  const messages = useChat();
  const notice = useChatNotice();
  const me = myPlayer();
  const isTouchDevice = useIsTouchDevice();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.code === "KeyT") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => clearChatNotice(), 2000);
    return () => clearTimeout(timeout);
  }, [notice]);

  if (!me) return null;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    sendChat(text);
    setDraft("");
  };

  return (
    <div
      className="fixed left-4 z-40 flex w-[min(92vw,24rem)] flex-col overflow-hidden rounded-[18px] border border-cyan-300/20 bg-[rgba(6,10,18,0.55)] text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-cyan-300/20 backdrop-blur-sm"
      style={{ bottom: isTouchDevice ? 176 : 16 }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">
        <span>Room Chat <span className="text-cyan-200/40">[T]</span></span>
        <div className="flex items-center gap-2">
          {notice ? <span className="text-amber-300">{notice}</span> : null}
          <button
            type="button"
            className="rounded-full border border-cyan-300/15 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50/80 hover:bg-white/10"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {open && (
        <>
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
                    event.currentTarget.blur();
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
