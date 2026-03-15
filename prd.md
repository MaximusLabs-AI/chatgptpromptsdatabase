Tool 5: AI Prompts Explorer
5.1 Overview
Tool Name: AI Prompts Explorer
Purpose: Let users search and discover real user prompts from public AI conversation datasets. Functions as keyword research for AEO - showing what users actually ask AI chatbots.
Use Case: SEOs researching what real users ask AI chatbots (keyword research for AEO). Content strategists identifying topic gaps. Product teams understanding user intent patterns.
Complexity: MEDIUM - Requires a database, data pipeline, and full-text search functionality.

NOTE: The original tool (ChatGPT Prompts Database) uses a proprietary 4.5M conversation dataset. This alternative uses publicly available datasets with proper licensing.

5.2 Data Source Strategy
5.2.1 Option A: WildChat Dataset (Recommended)
•	WildChat is a public dataset of 1M+ real ChatGPT conversations collected with user consent
•	Available on HuggingFace: https://huggingface.co/datasets/allenai/WildChat-1M
•	Contains: user prompts, model responses, timestamps, language, toxicity labels
•	License: Open for research use (ODC-BY)

5.2.2 Option B: LMSYS-Chat-1M
•	1M conversations from LMSYS Chatbot Arena
•	Contains multi-model conversations with different LLMs
•	Available on HuggingFace under research license

5.2.3 Option C: ShareGPT Dataset
•	Community-shared ChatGPT conversations
•	Various sizes available (52K to 90K conversations)
•	Less structured but freely available

5.2.4 Recommended Approach
Download WildChat-1M, extract just the user prompts (first message of each conversation), filter out toxic/PII content, store in a Cloudflare D1 database, and build full-text search over it.

5.3 UI Specification
5.3.1 Page Layout
•	Page Header: "AI Prompts Explorer"
•	Subtitle: "Search real user prompts from ChatGPT, Gemini & other AI chatbots."
•	Stats Bar: "1M+ Conversations | 100% Real Users | Multiple AI Platforms"

5.3.2 Search Section
•	Search input: Text input with placeholder "eg. marketing email" and "Search Prompts ->" button
•	Filter options (collapsible panel):
◦	  - Platform: All / ChatGPT / Gemini / Claude
◦	  - Language: English / All
◦	  - Category: Auto-detected tags (Writing, Coding, Research, Business, etc.)

5.3.3 Results Section
•	Result count: 'Showing 25 of 1,247 results'
•	List of conversation cards, each showing:
◦	  - User prompt (truncated to ~200 characters)
◦	  - Platform tag (ChatGPT, Gemini, etc.)
◦	  - Timestamp/date
◦	  - Category tag
◦	  - Expand button to see full conversation
•	Pagination: 'Load more' button or infinite scroll

5.4 Complete Backend Logic
5.4.1 Database Schema
Database: Cloudflare D1 (SQLite) or Supabase (PostgreSQL)

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
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
  content=conversations,
  content_rowid=id
);

5.4.2 API Endpoint
Endpoint: GET /api/prompts/search?q=marketing+email&page=1&limit=25

5.4.3 Search Logic
async function searchPrompts(query, page = 1, limit = 25, filters = {}) {
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT c.id, c.user_prompt, c.model_response,
           c.platform, c.language, c.timestamp, c.category
    FROM conversations c
    JOIN prompts_fts ON c.id = prompts_fts.rowid
    WHERE prompts_fts MATCH ?
  `;
  const params = [query];
  
  if (filters.platform) {
    sql += ' AND c.platform = ?';
    params.push(filters.platform);
  }
  if (filters.language) {
    sql += ' AND c.language = ?';
    params.push(filters.language);
  }
  
  sql += ' ORDER BY rank LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const results = await db.prepare(sql).bind(...params).all();
  const countResult = await db
    .prepare('SELECT COUNT(*) as total FROM prompts_fts WHERE prompts_fts MATCH ?')
    .bind(query)
    .first();
  
  return {
    results: results.results,
    total: countResult.total,
    page,
    totalPages: Math.ceil(countResult.total / limit)
  };
}

5.5 Data Pipeline (One-Time Setup)
This is a one-time ETL process to prepare the database:
28.	Download WildChat-1M from HuggingFace (Parquet format, ~2GB)
29.	Extract user prompts: Take only the first message of each conversation (the initial user prompt)
30.	Filter toxic/PII content: Remove conversations with toxicity_score > 0.7 and use regex to strip potential PII (emails, phone numbers)
31.	Categorize prompts: Use GPT-4o-mini to auto-tag categories in bulk batches of 50-100 prompts per API call
32.	Import into D1 database: Use wrangler CLI to import data into Cloudflare D1
33.	Build FTS index: Populate the prompts_fts virtual table

5.5.1 Categorization System Prompt (for data pipeline)
You are a prompt categorizer. Given a user's prompt to an AI chatbot,
classify it into one of these categories:
 
- Writing (emails, essays, creative writing)
- Coding (programming, debugging, code review)
- Research (information lookup, analysis)
- Business (marketing, strategy, finance)
- Education (learning, homework, tutoring)
- Creative (images, stories, brainstorming)
- Personal (advice, health, relationships)
- Technical (IT, troubleshooting, configuration)
- Other
 
Respond with ONLY the category name.

5.6 Infrastructure
•	Database: Cloudflare D1 (free tier: 5M reads/day, 100K writes/day)
•	API: Cloudflare Worker querying D1
•	Rate Limit: 30 searches per IP per hour
•	Caching: Cache popular search queries for 15 minutes in KV
