#!/usr/bin/env python3
"""
BizTV Transcription + Summarization Pipeline

Usage:
  python3 pipeline.py <audio_or_video_file> [--url SOURCE_URL]
  python3 pipeline.py --text "raw text to process" [--source-id ID]
  
Outputs structured news_items to mission-control.db.
"""

import argparse
import json
import os
import sqlite3
import sys
import uuid
from pathlib import Path

# Resolve paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # /Users/pieter/clawd
DB_PATH = PROJECT_ROOT / "data" / "mission-control.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    return conn

def init_schema(conn):
    """Create BizTV tables if they don't exist."""
    schema_path = SCRIPT_DIR.parent / "src" / "lib" / "biztv-schema.sql"
    if schema_path.exists():
        conn.executescript(schema_path.read_text())
    else:
        # Inline fallback
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS biztv_sources (
              id TEXT PRIMARY KEY, type TEXT NOT NULL, filename TEXT, url TEXT,
              duration_seconds REAL, transcription TEXT, transcription_model TEXT DEFAULT 'whisper-1',
              language TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS biztv_news_items (
              id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES biztv_sources(id),
              headline TEXT NOT NULL, summary TEXT NOT NULL, category TEXT NOT NULL,
              confidence REAL NOT NULL DEFAULT 0.0, source_quote TEXT,
              source_offset_start REAL, source_offset_end REAL,
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS biztv_action_items (
              id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES biztv_sources(id),
              news_item_id TEXT REFERENCES biztv_news_items(id),
              action TEXT NOT NULL, assignee TEXT, priority TEXT DEFAULT 'medium',
              due_date TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS biztv_kpi_deltas (
              id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES biztv_sources(id),
              news_item_id TEXT REFERENCES biztv_news_items(id),
              metric TEXT NOT NULL, value_before TEXT, value_after TEXT,
              delta TEXT, direction TEXT, created_at TEXT DEFAULT (datetime('now'))
            );
        """)
    conn.commit()

def gen_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"

# ─── Step 1: Transcription via Whisper API ───

def transcribe_file(file_path: str) -> dict:
    """Transcribe audio/video using OpenAI Whisper API. Returns {text, language, duration, segments}."""
    import httpx
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Check file size - Whisper has 25MB limit
    size_mb = file_path.stat().st_size / (1024 * 1024)
    if size_mb > 25:
        print(f"⚠️  File is {size_mb:.1f}MB, may need chunking for files > 25MB")
    
    print(f"🎙️  Transcribing: {file_path.name} ({size_mb:.1f}MB)")
    
    with open(file_path, "rb") as f:
        response = httpx.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (file_path.name, f, "audio/mpeg")},
            data={
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "segment",
            },
            timeout=300,
        )
    
    response.raise_for_status()
    result = response.json()
    
    print(f"✅ Transcribed: {len(result.get('text', ''))} chars, language={result.get('language', '?')}")
    return result

# ─── Step 2: Summarization with structured output ───

SUMMARIZE_SYSTEM = """You are a news editor for BizTV, a business news channel. 
Given a transcript, extract structured news items.

RULES (Hallucination Guard):
- ONLY extract claims explicitly stated in the transcript
- Each news item MUST have a source_quote: the exact words from the transcript backing the claim
- Confidence score: 1.0 = verbatim quote, 0.8 = clear paraphrase, 0.5 = implied, <0.5 = don't include
- Do NOT add context, speculation, or external knowledge
- If the transcript is ambiguous, lower the confidence score
- Categories: BREAKING, EARNINGS, MARKETS, CRYPTO, MACRO, TECH, POLICY, BUSINESS

Also extract:
- action_items: things someone should do based on the content
- kpi_deltas: any numeric changes mentioned (metrics going up/down)

Return valid JSON matching this schema exactly:
{
  "news_items": [
    {
      "headline": "short headline",
      "summary": "2-3 sentence summary", 
      "category": "MARKETS",
      "confidence": 0.95,
      "source_quote": "exact quote from transcript"
    }
  ],
  "action_items": [
    {
      "action": "what to do",
      "assignee": "who (or null)",
      "priority": "high|medium|low"
    }
  ],
  "kpi_deltas": [
    {
      "metric": "S&P 500",
      "value_before": "4800",
      "value_after": "4900",
      "delta": "+2.1%",
      "direction": "up"
    }
  ]
}"""

def summarize_transcript(transcript: str, source_id: str) -> dict:
    """Use GPT-4o to extract structured news items from transcript."""
    import httpx
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    
    # Truncate very long transcripts to fit context
    max_chars = 100_000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "\n\n[TRUNCATED]"
    
    print(f"📝 Summarizing transcript ({len(transcript)} chars)...")
    
    response = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SUMMARIZE_SYSTEM},
                {"role": "user", "content": f"Source ID: {source_id}\n\nTranscript:\n{transcript}"},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        },
        timeout=120,
    )
    
    response.raise_for_status()
    result = response.json()
    content = result["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    
    n_news = len(parsed.get("news_items", []))
    n_actions = len(parsed.get("action_items", []))
    n_kpis = len(parsed.get("kpi_deltas", []))
    print(f"✅ Extracted: {n_news} news items, {n_actions} action items, {n_kpis} KPI deltas")
    
    return parsed

# ─── Step 3: Hallucination Guard ───

def hallucination_guard(news_items: list, transcript: str) -> list:
    """Filter out items with low confidence or ungrounded claims."""
    MIN_CONFIDENCE = 0.5
    filtered = []
    
    for item in news_items:
        confidence = item.get("confidence", 0)
        quote = item.get("source_quote", "")
        
        # Check if source_quote actually appears (fuzzy) in transcript
        if quote and len(quote) > 10:
            # Simple fuzzy check: at least some key words from quote in transcript
            quote_words = set(quote.lower().split())
            transcript_lower = transcript.lower()
            matches = sum(1 for w in quote_words if w in transcript_lower)
            quote_grounding = matches / max(len(quote_words), 1)
            
            # Adjust confidence based on grounding
            if quote_grounding < 0.3:
                print(f"⚠️  Low grounding ({quote_grounding:.0%}) for: {item['headline']}")
                confidence = min(confidence, 0.3)
                item["confidence"] = confidence
        
        if confidence >= MIN_CONFIDENCE:
            filtered.append(item)
        else:
            print(f"🚫 Filtered out (confidence={confidence:.2f}): {item.get('headline', '?')}")
    
    print(f"🛡️  Hallucination guard: {len(filtered)}/{len(news_items)} items passed")
    return filtered

# ─── Step 4: Storage ───

def store_results(conn, source_id: str, parsed: dict, transcript: str):
    """Store news items, action items, and KPI deltas in SQLite."""
    
    # Apply hallucination guard
    news_items = hallucination_guard(parsed.get("news_items", []), transcript)
    
    # Store news items
    for item in news_items:
        news_id = gen_id("news-")
        conn.execute(
            """INSERT INTO biztv_news_items 
               (id, source_id, headline, summary, category, confidence, source_quote)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (news_id, source_id, item["headline"], item["summary"],
             item.get("category", "BUSINESS"), item.get("confidence", 0.5),
             item.get("source_quote", ""))
        )
        
        # Store associated KPI deltas
        for kpi in parsed.get("kpi_deltas", []):
            conn.execute(
                """INSERT INTO biztv_kpi_deltas
                   (id, source_id, news_item_id, metric, value_before, value_after, delta, direction)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (gen_id("kpi-"), source_id, news_id,
                 kpi["metric"], kpi.get("value_before"), kpi.get("value_after"),
                 kpi.get("delta"), kpi.get("direction"))
            )
    
    # Store action items
    for action in parsed.get("action_items", []):
        conn.execute(
            """INSERT INTO biztv_action_items
               (id, source_id, action, assignee, priority)
               VALUES (?, ?, ?, ?, ?)""",
            (gen_id("act-"), source_id,
             action["action"], action.get("assignee"), action.get("priority", "medium"))
        )
    
    conn.commit()
    print(f"💾 Stored {len(news_items)} news items, {len(parsed.get('action_items', []))} actions")

# ─── Main Pipeline ───

def run_pipeline(file_path=None, text=None, url=None, source_id=None):
    """Run the full transcription + summarization pipeline."""
    conn = get_db()
    init_schema(conn)
    
    if not source_id:
        source_id = gen_id("src-")
    
    transcript = ""
    source_type = "text"
    filename = None
    duration = None
    language = None
    
    if file_path:
        # Step 1: Transcribe
        source_type = "audio"
        filename = Path(file_path).name
        result = transcribe_file(file_path)
        transcript = result.get("text", "")
        language = result.get("language")
        duration = result.get("duration")
    elif text:
        transcript = text
        source_type = "text"
    else:
        print("❌ Provide either a file path or --text")
        sys.exit(1)
    
    # Store source
    conn.execute(
        """INSERT INTO biztv_sources 
           (id, type, filename, url, duration_seconds, transcription, language)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (source_id, source_type, filename, url, duration, transcript, language)
    )
    conn.commit()
    
    # Step 2+3+4: Summarize, guard, store
    parsed = summarize_transcript(transcript, source_id)
    store_results(conn, source_id, parsed, transcript)
    
    # Print summary
    print(f"\n{'='*50}")
    print(f"✅ Pipeline complete for source: {source_id}")
    
    items = conn.execute(
        "SELECT headline, category, confidence FROM biztv_news_items WHERE source_id=?",
        (source_id,)
    ).fetchall()
    
    for item in items:
        print(f"  [{item['category']}] {item['headline']} (conf: {item['confidence']:.0%})")
    
    conn.close()
    return source_id

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BizTV Transcription + Summarization Pipeline")
    parser.add_argument("file", nargs="?", help="Audio/video file to transcribe")
    parser.add_argument("--text", help="Raw text to process (skip transcription)")
    parser.add_argument("--url", help="Source URL for attribution")
    parser.add_argument("--source-id", help="Custom source ID")
    
    args = parser.parse_args()
    
    if not args.file and not args.text:
        parser.print_help()
        sys.exit(1)
    
    run_pipeline(file_path=args.file, text=args.text, url=args.url, source_id=args.source_id)
