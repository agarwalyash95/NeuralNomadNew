/**
 * chatStream — fetch-based SSE client for the planner chat stream endpoints.
 * (EventSource can't POST, so we read the body stream manually.)
 *
 * Events, in order per turn:
 *   state   → intent/confidence/slots as soon as extraction lands
 *   token   → reply text chunks ({t})
 *   widgets → the turn's widget descriptors (exactly once)
 *   done    → persisted message id, workspace, suggested_replies
 *   error   → stream failed; caller falls back to the classic POST
 */

import { getAccessToken } from '@/lib/getAccessToken';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ChatStreamHandlers {
  onState?: (state: any) => void;
  onToken: (text: string) => void;
  onWidgets?: (widgets: any[]) => void;
  onDone: (done: any) => void;
}

export async function streamChatMessage(
  workspaceId: string | null,
  body: { message: string; structured_value?: any },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const url = workspaceId
    ? `${API_URL}/planner/workspaces/${workspaceId}/chat/stream/`
    : `${API_URL}/planner/chat/stream/`;

  const token = getAccessToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  const dispatch = (rawEvent: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const payload = JSON.parse(dataLines.join('\n'));

    switch (event) {
      case 'state':
        handlers.onState?.(payload);
        break;
      case 'token':
        handlers.onToken(payload.t ?? '');
        break;
      case 'widgets':
        handlers.onWidgets?.(payload);
        break;
      case 'done':
        sawDone = true;
        handlers.onDone(payload);
        break;
      case 'error':
        throw new Error(payload.detail || 'Chat stream reported an error');
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (rawEvent.trim()) dispatch(rawEvent);
      boundary = buffer.indexOf('\n\n');
    }
  }

  if (!sawDone) {
    throw new Error('Chat stream ended before completion');
  }
}
