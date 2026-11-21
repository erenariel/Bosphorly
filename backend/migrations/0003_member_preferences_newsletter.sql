-- Member personalization preferences (country, tour interests) and newsletter subscriptions.
PRAGMA foreign_keys = ON;

ALTER TABLE members ADD COLUMN country TEXT CHECK(country IS NULL OR length(country) <= 80);
ALTER TABLE members ADD COLUMN interests TEXT;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
 email TEXT PRIMARY KEY CHECK(email = lower(email) AND length(email) BETWEEN 5 AND 254),
 lang TEXT NOT NULL DEFAULT 'en' CHECK(length(lang) = 2),
 interests TEXT,
 source TEXT NOT NULL DEFAULT 'site',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 unsubscribed_at TEXT
);
