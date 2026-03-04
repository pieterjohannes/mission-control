"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export function useEvents() {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<(evt: SSEEvent) => void>>>(new Map());

  const subscribe = useCallback((type: string, callback: (evt: SSEEvent) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(callback);
    return () => {
      listenersRef.current.get(type)?.delete(callback);
    };
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let es: EventSource;

    function connect() {
      es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("connected", () => {
        setConnected(true);
      });

      const eventTypes = [
        "issue_updated",
        "comment_added",
        "activity_logged",
        "agent_heartbeat",
        "agent_pulse",
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e) => {
          try {
            const data = JSON.parse(e.data) as SSEEvent;
            setLastEvent(data);
            // Notify subscribers
            const subs = listenersRef.current.get(type);
            if (subs) subs.forEach((cb) => cb(data));
            // Also notify wildcard subscribers
            const all = listenersRef.current.get("*");
            if (all) all.forEach((cb) => cb(data));
          } catch {}
        });
      }

      es.onerror = () => {
        setConnected(false);
        es.close();
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      es?.close();
      setConnected(false);
    };
  }, []);

  return { lastEvent, connected, subscribe };
}
