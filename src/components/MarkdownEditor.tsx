"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write a description... (Markdown supported)",
  rows = 6,
  className = "",
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = useCallback(
    (before: string, after: string = "") => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end);
      const newValue =
        value.slice(0, start) + before + selected + after + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        const cursor = start + before.length + selected.length + after.length;
        ta.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange]
  );

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + prefix.length, start + prefix.length);
      });
    },
    [value, onChange]
  );

  const toolbarButtons = [
    { label: "B", title: "Bold", action: () => insertMarkdown("**", "**") },
    { label: "I", title: "Italic", action: () => insertMarkdown("_", "_") },
    { label: "H", title: "Heading", action: () => insertLinePrefix("## ") },
    { label: "`", title: "Inline code", action: () => insertMarkdown("`", "`") },
    {
      label: "```",
      title: "Code block",
      action: () => insertMarkdown("```\n", "\n```"),
    },
    {
      label: "•",
      title: "Bullet list",
      action: () => insertLinePrefix("- "),
    },
    {
      label: "🔗",
      title: "Link",
      action: () => insertMarkdown("[", "](url)"),
    },
  ];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Tabs + Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              tab === "edit"
                ? "bg-white/10 text-gray-200"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              tab === "preview"
                ? "bg-white/10 text-gray-200"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Preview
          </button>
        </div>
        {tab === "edit" && (
          <div className="flex gap-1">
            {toolbarButtons.map((btn) => (
              <button
                key={btn.title}
                type="button"
                title={btn.title}
                onClick={btn.action}
                className="text-xs px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 font-mono transition-colors"
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor / Preview */}
      {tab === "edit" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
        />
      ) : (
        <div
          className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <span className="text-gray-600 italic">Nothing to preview</span>
          )}
        </div>
      )}
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-gray-100 mt-2 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-gray-100 mt-2 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-200 mt-1.5 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-gray-400 leading-relaxed mb-1.5">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="text-gray-200 font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-gray-300 italic">{children}</em>
        ),
        code: ({ children, className: cls }) => {
          const isBlock = cls?.includes("language-");
          return isBlock ? (
            <code className="block bg-black/30 rounded px-3 py-2 text-xs font-mono text-green-300 whitespace-pre-wrap my-1.5 overflow-x-auto">
              {children}
            </code>
          ) : (
            <code className="bg-black/30 rounded px-1 py-0.5 text-xs font-mono text-green-300">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-black/30 rounded my-1.5 overflow-x-auto">{children}</pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-gray-400 space-y-0.5 my-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-gray-400 space-y-0.5 my-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-gray-400">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-600 pl-3 text-gray-500 italic my-1.5">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-white/10 my-2" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
