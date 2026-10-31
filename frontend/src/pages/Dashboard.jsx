import { useEffect, useRef, useState } from "react";
import axiosInstance from "../axiosInstance";
import WorkspaceLayout from "../layouts/WorkspaceLayout";

function getErrorMessage(err) {
  if (!err.response) return "Cannot reach the server.";
  const detail = err.response.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(". ");

  if (detail && typeof detail === "object") {
    if (detail.error) {
      const types = detail.detected_pii?.length ? ` (${detail.detected_pii.join(", ")})` : "";
      const inj = detail.injection_detected ? " (possible prompt injection)" : "";
      return `${detail.error}${types}${inj}. Please remove sensitive content and try again.`;
    }
    if (detail.message) {
      return detail.limit
        ? `${detail.message} (${detail.used}/${detail.limit} used today)`
        : detail.message;
    }
  }
  return "Something went wrong. Please try again.";
}

function Dashboard() {
  const bottomRef = useRef(null);
  const skipNextLoad = useRef(false);

  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    axiosInstance.get("/auth/me").then((res) => setUser(res.data)).catch((err) => setError(getErrorMessage(err)));
    loadConversations();
  }, []);

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    if (!activeId) return;

    const controller = new AbortController();
    loadMessages(activeId, controller.signal);
    return () => controller.abort();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function loadConversations() {
    try {
      const res = await axiosInstance.get("/conversations");
      setConversations(
        Array.isArray(res.data)
          ? res.data.map((conversation) => ({
              ...conversation,
              id: conversation.id ?? conversation.conversation_id,
            }))
          : [],
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadMessages(id, signal) {
    setLoadingMessages(true);
    try {
      const res = await axiosInstance.get(`/conversations/${id}/messages`, { signal });
      setMessages(
        Array.isArray(res.data)
          ? res.data.map((message) => ({ ...message, id: message.id ?? message.message_id }))
          : [],
      );
    } catch (err) {
      if (!signal?.aborted) setError(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoadingMessages(false);
    }
  }

  // Title is null on purpose: the backend sets it only after the message passes the security check
  async function createConversation() {
    const res = await axiosInstance.post("/conversations", { title: null });
    return res.data?.id ?? res.data?.conversation_id;
  }

  function handleNewChat() {
    setError("");
    setActiveId(null);
    setMessages([]);
    setLoadingMessages(false);
    setSidebarOpen(false);
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError("");
    setSending(true);
    setInput("");
    const tmpId = `tmp-${Date.now()}`;

    try {
      let id = activeId;
      if (!id) {
        id = await createConversation();
        if (!id) throw new Error("no id");
        skipNextLoad.current = true; // we manage messages ourselves for a brand new chat
        setActiveId(id);
      }

      setMessages((prev) => [...prev, { id: tmpId, role: "user", content: text }]);

      const res = await axiosInstance.post("/chat", { conversation_id: id, message: text });
      setUsage(res.data.usage);
      await loadMessages(id);
      await loadConversations(); // sidebar now shows the real title
    } catch (err) {
      // Remove the bubble so a blocked secret is not shown back
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      setError(err.response ? getErrorMessage(err) : "Failed to send the message.");
      // Policy blocks (400) are not restored; other errors let the user retry
      if (err.response && err.response.status !== 400) setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <WorkspaceLayout user={user} className="workspace-layout-chat">
    <div className={`dashboard-shell flex min-h-0 flex-1 overflow-hidden bg-gray-100 ${sidebarExpanded ? "" : "sidebar-collapsed"}`}>
      {sidebarOpen && (
        <button
          aria-label="Close conversation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/40 md:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-gray-200 bg-white shadow-xl transition-transform md:static md:z-auto md:w-64 md:translate-x-0 md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-gray-900">Conversations</h2>
            <p className="mt-1 text-xs text-gray-500">Private AI workspace</p>
          </div>
          <button
            type="button"
            className="sidebar-collapse-button hidden rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 md:block"
            onClick={() => setSidebarExpanded(false)}
            aria-label="Collapse conversation sidebar"
            title="Collapse sidebar"
          >
            ←
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New chat
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {conversations.length === 0 && (
            <p className="px-2 text-sm text-gray-400">No conversations yet</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setError("");
                setActiveId(c.id);
                setSidebarOpen(false);
              }}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                c.id === activeId
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {c.title || `Conversation ${c.id}`}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-sm font-medium text-gray-900">{user?.name || "..."}</p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
          {user?.organization_name && (
            <p className="truncate text-xs text-gray-400">{user.organization_name}</p>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          {!sidebarExpanded && (
            <button
              type="button"
              className="sidebar-expand-button hidden rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 md:block"
              onClick={() => setSidebarExpanded(true)}
              aria-label="Expand conversation sidebar"
            >
              ☰
            </button>
          )}
          <button
            type="button"
            aria-label="Open conversation menu"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 md:hidden"
          >
            Menu
          </button>
          <p className="truncate text-sm font-semibold text-gray-900">
            {conversations.find((conversation) => conversation.id === activeId)?.title || "New conversation"}
          </p>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && !loadingMessages && (
              <div className="mx-auto mt-16 max-w-lg text-center sm:mt-24">
                <div className="brand-mark mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold text-white">G</div>
                <h2 className="text-xl font-semibold text-gray-900">A safer space to work with AI</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">Start a conversation below. Messages are checked for sensitive information before they are sent.</p>
              </div>
            )}
            {loadingMessages && <p className="text-center text-gray-400">Loading...</p>}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 shadow"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-400 shadow">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-auto mb-2 w-full max-w-3xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-center text-xs text-gray-500">
          Conversations are monitored by your organization. Do not share passwords, keys or personal data.
          {usage && ` · ${usage.requests_today}/${usage.daily_limit} requests used today`}
        </div>

        <form onSubmit={handleSend} className="border-t border-gray-200 bg-white p-4">
          <div className="mx-auto flex max-w-3xl gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={sending}
              aria-label="Message"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
    </WorkspaceLayout>
  );
}

export default Dashboard;