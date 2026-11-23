-- Monthly synthesized character counter for Google Cloud TTS quota cap (no message text or PII stored).
CREATE TABLE IF NOT EXISTS tts_usage (
  month TEXT PRIMARY KEY,
  chars INTEGER NOT NULL DEFAULT 0
);
