# 🌌 AI Prompts Explorer

[![Maximus Ecosystem](https://img.shields.io/badge/Maximus-Ecosystem-001C64?style=for-the-badge)](https://maximuslabs.ai)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://www.maximuslabs.ai/tools/chatgpt-prompts-database)
[![Revenue Engine](https://img.shields.io/badge/Revenue-Engine-449AFB?style=for-the-badge)](#)

A high-performance, SEO-centric search engine for real user prompts harvested from public AI conversation datasets (WildChat-1M). Designed for researchers, prompt engineers, and SEO specialists to analyze human-AI interaction patterns.

---

## 💎 Premium Features

- **Semantic Search**: Powered by Cloudflare D1 and FTS5 for lightning-fast full-text search.
- **Maximus Design System (MDS)**: A sleek, authority-driven UI built with React, Satoshi typography, and pill-shaped aesthetics.
- **AEO Research Tool**: Specifically tuned for AI Engine Optimization research and semantic variance analysis.
- **Multi-Platform Insight**: Filter prompts by ChatGPT, Gemini, Claude, and more.

---

## 🏗️ Technical Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | CSR application utilizing MDS components and high-authority layout patterns. |
| **API** | Hono + Cloudflare Workers | Serverless backend optimized for low-latency edge performance. |
| **Database** | Cloudflare D1 | Distributed SQLite database with FTS5 search indexing. |
| **Pipeline** | Node.js Scripts | Custom data processing pipeline for WildChat dataset ingestion. |

---

## 🚀 Quick Start (Revenue Deployment)

### 1. Database Initialization
Deploy the semantic engine locally:
```bash
cd api
# Initialize schema
npx wrangler d1 execute prompts-db --local --file=schema.sql
# Populate authority data
npx wrangler d1 execute prompts-db --local --file=seed.sql
```

### 2. Start Services
Launch the ecosystem:
```bash
# API Terminal
cd api
npm run dev

# Frontend Terminal
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`. (Ensure the API is running on `http://localhost:8787` for proxying).

---

## 🎨 Design System & Branding

The AI Prompts Explorer adheres to the **Maximus Design Authority**:
- **Typography**: Satoshi (Sans-Serif) for a modern, technical feel.
- **Palette**: Deep Navy (`#1E3251`) for authority and Accent Blue (`#449AFB`) for action.
- **Componentry**: Pill-shaped buttons (radius `48px`), generous padding, and subtle micro-animations.

Read more in our [Branding Guidelines](./branding.md).

---

## 📊 Marketing & AEO Strategy
*Humanized outputs, human-grade revenue.*

This tool is part of the Maximus suite, focused on transforming AI outputs into human-grade revenue engines. By understanding *how* users prompt, we can better optimize content for the next generation of AI search (GEO).

---

© 2024 AI Prompts Explorer | Built for the MaximusLabs Ecosystem.
