"use client";
import { useEffect, useState } from "react";

interface SlackIntegration {
  id: string;
  type: string;
  enabled: boolean;
  config: { channels: string[] };
  slackConnection: {
    configured: boolean;
    botToken: string | null;
    appToken: string | null;
    webhookPath: string | null;
  };
}

interface TelegramIntegration {
  id: string;
  type: string;
  enabled: boolean;
  config: {
    chatId: string;
    notifications: {
      statusChanges: boolean;
      newComments: boolean;
      agentActivity: boolean;
    };
  };
  telegramConnection: {
    configured: boolean;
    botToken: string | null;
  };
}

export default function SettingsPage() {
  const [slack, setSlack] = useState<SlackIntegration | null>(null);
  const [channels, setChannels] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Telegram state
  const [telegram, setTelegram] = useState<TelegramIntegration | null>(null);
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgChatId, setTgChatId] = useState("");
  const [tgNotifications, setTgNotifications] = useState({
    statusChanges: true,
    newComments: true,
    agentActivity: true,
  });
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((r) => r.json())
      .then((data: SlackIntegration) => {
        setSlack(data);
        setEnabled(data.enabled);
        setChannels((data.config?.channels || []).join(", "));
      });

    fetch("/api/settings/telegram")
      .then((r) => r.json())
      .then((data: TelegramIntegration) => {
        setTelegram(data);
        setTgEnabled(data.enabled);
        setTgChatId(data.config?.chatId || "");
        setTgNotifications(data.config?.notifications || {
          statusChanges: true,
          newComments: true,
          agentActivity: true,
        });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const channelList = channels
      .split(",")
      .map((c) => c.trim().replace(/^#/, ""))
      .filter(Boolean);
    await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, config: { channels: channelList } }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveTelegram = async () => {
    setTgSaving(true);
    await fetch("/api/settings/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: tgEnabled,
        config: { chatId: tgChatId, notifications: tgNotifications },
      }),
    });
    setTgSaving(false);
    setTgSaved(true);
    setTimeout(() => setTgSaved(false), 2000);
  };

  const testTelegram = async () => {
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const res = await fetch("/api/settings/telegram/test", { method: "POST" });
      const data = await res.json();
      setTgTestResult(data);
    } catch {
      setTgTestResult({ ok: false, error: "Request failed" });
    }
    setTgTesting(false);
    setTimeout(() => setTgTestResult(null), 5000);
  };

  if (!slack || !telegram) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="glass p-12 text-center text-gray-500">Loading…</div>
      </div>
    );
  }

  const conn = slack.slackConnection;
  const tgConn = telegram.telegramConnection;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">⚙️ Settings</h1>
        <p className="text-gray-500 mt-1">Integrations and configuration</p>
      </div>

      {/* Slack Integration Card */}
      <div className="glass p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A154B]/30 flex items-center justify-center text-xl">
              💬
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Slack Integration</h2>
              <p className="text-sm text-gray-500">Connect LUMA to your Slack workspace</p>
            </div>
          </div>
          <button
            onClick={() => { setEnabled(!enabled); }}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? "bg-emerald-500" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Connection Status */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Connection Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Bot Token</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${conn.botToken ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {conn.botToken || "Not configured"}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">App Token</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${conn.appToken ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {conn.appToken || "Not configured"}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Webhook Path</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${conn.webhookPath ? "bg-emerald-400" : "bg-gray-600"}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {conn.webhookPath || "—"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${conn.configured ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-sm ${conn.configured ? "text-emerald-400" : "text-red-400"}`}>
              {conn.configured ? "Slack tokens configured" : "Slack not configured"}
            </span>
            {conn.configured && (
              <span className="text-xs text-gray-600 ml-2">
                via ~/.openclaw-lmnry/openclaw.json
              </span>
            )}
          </div>
        </div>

        {/* Channel Configuration */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Monitored Channels</h3>
          <p className="text-xs text-gray-600 mb-3">
            Comma-separated list of Slack channels LUMA should monitor
          </p>
          <input
            type="text"
            placeholder="general, luma, alerts"
            value={channels}
            onChange={(e) => setChannels(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none transition-colors"
          />
          {channels && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {channels.split(",").map((c) => c.trim().replace(/^#/, "")).filter(Boolean).map((ch) => (
                <span
                  key={ch}
                  className="px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 text-xs font-medium"
                >
                  #{ch}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-end gap-3">
          {saved && (
            <span className="text-sm text-emerald-400 animate-fade-in">✓ Saved</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Telegram Integration Card */}
      <div className="glass p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 flex items-center justify-center text-xl">
              ✈️
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Telegram Integration</h2>
              <p className="text-sm text-gray-500">Send LUMA alerts to Telegram</p>
            </div>
          </div>
          <button
            onClick={() => setTgEnabled(!tgEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              tgEnabled ? "bg-emerald-500" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                tgEnabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Connection Status */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Connection Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Bot Token</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tgConn.botToken ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {tgConn.botToken || "Not configured"}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Chat ID</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tgChatId ? "bg-emerald-400" : "bg-yellow-400"}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {tgChatId || "Not set"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${tgConn.configured ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-sm ${tgConn.configured ? "text-emerald-400" : "text-red-400"}`}>
              {tgConn.configured ? "Bot token configured" : "Bot token not found"}
            </span>
            {tgConn.configured && (
              <span className="text-xs text-gray-600 ml-2">
                via ~/.openclaw-lmnry/openclaw.json
              </span>
            )}
          </div>
        </div>

        {/* Chat ID Configuration */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Chat ID</h3>
          <p className="text-xs text-gray-600 mb-3">
            The Telegram chat or group ID where alerts will be sent
          </p>
          <input
            type="text"
            placeholder="-1001234567890"
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#0088cc]/50 focus:outline-none transition-colors font-mono"
          />
        </div>

        {/* Notification Preferences */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Notification Preferences</h3>
          <div className="space-y-3">
            {([
              { key: "statusChanges" as const, label: "Issue Status Changes", desc: "When issues move between statuses" },
              { key: "newComments" as const, label: "New Comments", desc: "When comments are added to issues" },
              { key: "agentActivity" as const, label: "Agent Activity", desc: "When agents start or complete work" },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3">
                <div>
                  <div className="text-sm text-gray-300">{label}</div>
                  <div className="text-xs text-gray-600">{desc}</div>
                </div>
                <button
                  onClick={() => setTgNotifications((n) => ({ ...n, [key]: !n[key] }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    tgNotifications[key] ? "bg-[#0088cc]" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      tgNotifications[key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Test & Save */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={testTelegram}
              disabled={tgTesting || !tgChatId}
              className="px-4 py-2 rounded-xl bg-[#0088cc]/20 text-[#0088cc] text-sm font-medium hover:bg-[#0088cc]/30 transition-colors disabled:opacity-50 border border-[#0088cc]/20"
            >
              {tgTesting ? "Sending…" : "🔔 Send Test Message"}
            </button>
            {tgTestResult && (
              <span className={`text-sm animate-fade-in ${tgTestResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                {tgTestResult.ok ? "✓ Message sent!" : `✗ ${tgTestResult.error}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {tgSaved && (
              <span className="text-sm text-emerald-400 animate-fade-in">✓ Saved</span>
            )}
            <button
              onClick={saveTelegram}
              disabled={tgSaving}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
            >
              {tgSaving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
