# Brainwave 🧠🌊

Brainwave is an interactive 3D news intelligence web application built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **React Three Fiber (Three.js)**. It renders global trending news stories as interconnected, pulsing neurons positioned inside an anatomical 3D brain volume.

---

## What It Does

- **Real-Time 3D News Visualization**: Renders trending topics and news events as neurons clustered within a 3D brain mesh.
- **Multi-Source News Pipeline**: Aggregates stories concurrently from NewsData.io, Hacker News, GDELT DOC 2.0, and RSS/Atom feeds (BBC, The Guardian, Al Jazeera).
- **Semantic Clustering & Projection**: Uses vector embeddings and average-linkage agglomerative clustering to group related articles into events, projected into 3D brain space using PCA and relaxation.
- **Trend & Velocity Scoring**: Evaluates story momentum, source diversity, and engagement. *(Note: story velocity is calculated within the active fetched time window, rather than against a permanent historical baseline).*
- **Grounded Briefing Agent**: Generates verified event intelligence briefings with citation validation and claims checking using Gemini.
- **Semantic Search ("Ask the Brain")**: Natural language queries over current events with visual neural highlighting.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm, pnpm, or yarn

### Installation

```bash
git clone <repository-url>
cd Brainwave-main
npm install --legacy-peer-deps
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# NewsData.io API Key (https://newsdata.io/) - Server-side only
NEWSDATA_API_KEY=your_newsdata_api_key

# Google Gemini API Key for Embeddings, Briefing Agent, and Ask the Brain
GEMINI_API_KEY=your_gemini_api_key

# Optional: Hugging Face API Key for fallback summarization
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Optional: Global daily cap for AI operations (default: 200)
AI_DAILY_CAP=200
```

> **Security Note:** Never expose `GEMINI_API_KEY` or `NEWSDATA_API_KEY` with `NEXT_PUBLIC_`. All AI and data ingestion logic runs strictly server-side in `lib/server/*` and `app/api/*`.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Running Tests

```bash
npm test
```

---

## Architecture

### 1. Ingestion Pipeline (`lib/server/sources/`)
- Multi-source parallel fetchers with `Promise.allSettled` and 6-second timeouts.
- Ingests from NewsData.io, Hacker News API, GDELT DOC 2.0, and RSS/Atom feeds (BBC, The Guardian, Al Jazeera).
- Deduplicates stories by normalized URL and caps total pool at ~150 items.

### 2. Trend & Velocity Engine (`lib/server/trend.ts`)
- Pure module computing velocity, source diversity, and engagement.
- Velocity measures item publication distribution between the newest third and oldest third of the fetched time window.
- Produces normalized 0–1 trend scores and trend status labels (`emerging`, `rising`, `steady`, `fading`).

### 3. Embeddings & Semantic Clustering (`lib/server/embeddings.ts`, `lib/server/cluster.ts`)
- Batch embeddings via Gemini embedding API (`gemini-embedding-001`, batch size 100, task type `CLUSTERING`, dimension 768, L2-normalized).
- Dependency-free TF-IDF fallback when API key is missing or offline.
- Average-linkage agglomerative clustering grouping articles into distinct events.
- Zero-shot classification matching centroids to category prototypes.

### 4. 3D Brain Projection (`lib/server/projection.ts`)
- Pure PCA projection (power iteration + deflation) reducing 768D centroids to 3D.
- Deterministic sign fixing and scaling into the two-ellipsoid brain boundary.
- Physics relaxation passes preserving minimum distance between neurons.
- Cosine-similarity neural connection graph.

### 5. Grounded Briefing Agent (`lib/server/briefingAgent.ts`, `lib/server/verifyCitations.ts`)
- Server-side tool-calling agent using plain `fetch` to Gemini.
- Tools: `fetch_article(index)` (whitelisted, SSRF-protected, 8KB cap) and `list_related_events()`.
- Untrusted data boundary markers preventing prompt injection.
- Deterministic citation verification ensuring quoted excerpts exist verbatim in source articles.

### 6. "Ask the Brain" Semantic Search (`app/api/ask/route.ts`)
- Natural language query answering grounded strictly on top-5 semantic event contexts.
- Returns answer, verified event citations `[E#]`, and triggers 3D neural glow highlighting.

---

## License

MIT
