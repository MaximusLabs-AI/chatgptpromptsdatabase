CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_prompt TEXT NOT NULL,
  model_response TEXT,
  platform VARCHAR(50),
  language VARCHAR(10),
  category VARCHAR(100),
  timestamp DATETIME,
  toxicity_score FLOAT
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE prompts_fts USING fts5(
  user_prompt,
  content='conversations',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Optimization: B-tree indexes for fast filtering
CREATE INDEX idx_platform ON conversations(platform);
CREATE INDEX idx_language ON conversations(language);
CREATE INDEX idx_category ON conversations(category);
CREATE INDEX idx_timestamp ON conversations(timestamp DESC);

-- Triggers to keep FTS index in sync
CREATE TRIGGER conversations_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO prompts_fts(rowid, user_prompt) VALUES (new.id, new.user_prompt);
END;

CREATE TRIGGER conversations_ad AFTER DELETE ON conversations BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, user_prompt) VALUES('delete', old.id, old.user_prompt);
END;

CREATE TRIGGER conversations_au AFTER UPDATE ON conversations BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, user_prompt) VALUES('delete', old.id, old.user_prompt);
  INSERT INTO prompts_fts(rowid, user_prompt) VALUES (new.id, new.user_prompt);
END;
