import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../axiosInstance";

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
  const navigate = useNavigate();
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

  useEffect(() => {
    axiosInstance.get("/auth/me").then((res) => setUser(res.data)).catch(() => {});
    loadConversations();
  }, []);

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function loadConversations() {
    try {
      const res = await axiosInstance.get("/conversations");
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadMessages(id) {
    setLoadingMessages(true);
    try {
      const res = await axiosInstance.get(`/conversations/${id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMessages(false);
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

  function handleLogout() {
    ["access_token", "role", "must_change_password"].forEach((k) => localStorage.removeItem(k));
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h1 className="text-xl font-bold text-gray-900">GuardTraceAI</h1>
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
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && !loadingMessages && (
              <p className="mt-20 text-center text-gray-400">
                Start a conversation by typing a message below.
              </p>
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
  );
}

export default Dashboard;