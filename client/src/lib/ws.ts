type MessageHandler = (data: any) => void;

let ws: WebSocket | null = null;
let handlers: Set<MessageHandler> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentSessionId: number | null = null;

function getWsUrl(sessionId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  // Check for port proxy pattern used in deployment
  const portMatch = window.location.pathname.match(/\/port\/(\d+)/);
  if (portMatch) {
    return `${protocol}//${window.location.hostname}/port/${portMatch[1]}/ws?sessionId=${sessionId}`;
  }
  return `${protocol}//${host}/ws?sessionId=${sessionId}`;
}

export function connectWs(sessionId: number) {
  if (ws && currentSessionId === sessionId && ws.readyState === WebSocket.OPEN) return;
  if (ws) ws.close();
  currentSessionId = sessionId;

  const url = getWsUrl(sessionId);
  ws = new WebSocket(url);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.forEach((h) => h(data));
    } catch {}
  };

  ws.onclose = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (currentSessionId === sessionId) connectWs(sessionId);
    }, 2000);
  };

  ws.onerror = () => ws?.close();
}

export function onWsMessage(handler: MessageHandler) {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export function disconnectWs() {
  currentSessionId = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
  ws = null;
}
