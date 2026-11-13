<div align="center">

# 🧠 Brainwave
### *The World's Thoughts, Visualized as Neural Intelligence*

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.181-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge)](LICENSE)

An interactive, full-stack 3D news intelligence platform that ingests global news in real-time, extracts events using semantic vector clustering, and visualizes them as glowing, interconnected neurons inside an anatomical 3D brain.

[Features](#-key-features) • [Visual Architecture](#-visual-system--3d-brain-rendering) • [System Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [API & AI Setup](#-environment--api-configuration) • [Verification & Testing](#-testing--quality-assurance)

---

</div>

## 🌟 Key Features

### 🌐 Multi-Source Real-Time Ingestion
- **Concurrent Ingestion Pipeline**: Ingests breaking news concurrently from **NewsData.io**, **Hacker News (Firebase API)**, **GDELT DOC 2.0**, and **RSS/Atom feeds** (BBC, The Guardian, Al Jazeera).
- **Sanitized HTML Stripping**: Dedicated `cleanText()` pipeline strips raw HTML tags (`<p>`, `<ul>`, `<a>`), decodes named/numeric entities (`&amp;`, `&#39;`, `&quot;`), removes trailing publication markers, and normalizes whitespace at ingestion time.
- **Hacker News Native Intelligence**: Extracts Ask HN/Show HN self-text directly, and routes external link posts to an honest, robots.txt-compliant content extractor.
- **Deduplication & Recency Filters**: Enforces a strict 24-hour maximum age window and deduplicates stories across sources by normalized URLs.

### 🧬 Semantic Clustering & 3D Neural Projection
- **Dual Vector Representation**: Generates 768-dimensional L2-normalized embeddings via Google Gemini (`models/gemini-embedding-001`), with automatic fallback to a zero-dependency **TF-IDF Vectorizer** during offline or quota conditions.
- **Agglomerative Hierarchical Clustering**: Groups related articles across disjoint media outlets into unified, cohesive news events with average-linkage distance gating.
- **Strict 6-Category Prototype Matching**: Eliminates vague "other" labels by argmax zero-shot classification against enriched domain prototypes:
  - 🔵 **Tech** (`#3b82f6`) • 🔴 **Sports** (`#ef4444`) • 🟣 **Politics** (`#a855f7`)
  - 🟢 **Business** (`#22c55e`) • 🔷 **Science** (`#22d3ee`) • 🌸 **Entertainment** (`#ec4899`)
- **PCA Dimensionality Reduction**: Custom power-iteration PCA with Gram-Schmidt deflation projects 768D semantic centroids into 3D Cartesian coordinates constrained to dual anatomical brain hemispheres with physics-based anti-overlap relaxation.

### 💡 High-Fidelity 3D Neural Visualization
- **Selective Post-Processing Bloom**: Powered by `@react-three/postprocessing` with fine-tuned `mipmapBlur`, `luminanceThreshold: 1.0`, `luminanceSmoothing: 0.2`, `intensity: 1.4`, and `radius: 0.75`.
- **Colored Glass Lantern Unread Nodes**:
  - **Outer Lantern Shell**: Category-colored sphere (`MeshStandardMaterial`, opacity 0.45, emissive 0.15, toneMapped true) preserving saturated hues.
  - **Glow Core**: Internal sphere with saturated HDR gold basic material (`#ffc83d` with scalar boost $> 1.0$, `toneMapped={false}`) that selectively blooms through the translucent glass and bleeds gently into the surrounding space with phase-offset pulsating embers.
- **Read State Tracking**: User click interactions transition nodes from luminous lanterns to solid category spheres (`opacity: 1.0`, emissive 0.20, no bloom), automatically persisted in `localStorage`.
- **Dark Silhouette Brain Mesh**: Anatomical GLB boundary rendered using unlit `MeshBasicMaterial` (`#0e0820`, opacity 0.22) with a faint silhouette edge outline (`#3b2a6b`, opacity 0.18, 1.01x scale, `BackSide`), with `renderOrder: 0` ensuring neurons are never tinted or obscured.

### 🛡️ Grounded AI Briefing Agent
- **Anti-Hallucination Claim Verification**: Evaluates multi-source events with Gemini (`gemini-2.5-flash`), demanding synthesized intelligence summaries, key timeline checkpoints, and framing differences across publishers.
- **Strict Body-Text Grounding**: Citations are verified strictly against full fetched article bodies, never headlines or snippets. Quotes shorter than 40 characters or identical to claims are rejected.
- **Briefability Gating**: Requires $\ge 2$ distinct sources OR at least one article with 500+ characters of fetched body text. If unbriefable or unavailable, the UI cleanly surfaces the specific reason without fabricating placeholder text.

### 🔍 "Ask the Brain" Semantic Q&A
- Natural language questions over current events grounded in top-5 semantic similarity contexts.
- Cites referenced news events using `[E1]`..`[E5]` tags.
- Activating a citation visually spotlights the cited neurons with a radiant, pulsing golden aura while dimming non-cited neurons to 30% opacity.

---

## 🎨 Visual System & 3D Brain Rendering

```
                                  +-----------------------------+
                                  |   Three.js Black Canvas     |
                                  |   <color args={['#000000']}>|
                                  +--------------+--------------+
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                       |                                       |
         v                                       v                                       v
+------------------+                   +--------------------+                  +--------------------+
|  Brain Boundary  |                   |   Unread Neuron    |                  |  Ask-the-Brain     |
|  (renderOrder 0) |                   |   (renderOrder 2)  |                  |  Highlight Ring    |
|                  |                   |                    |                  |                    |
| - Unlit #0e0820  |                   | - Outer Glass Orb  |                  | - Gold Halo Ring   |
|   opacity: 0.22  |                   |   (category color) |                  |   (#ffd700 * 2.5)  |
| - Outline 1.01x  |                   | - HDR Gold Core    |                  | - Non-cited nodes  |
|   BackSide #3b2a6b                   |   (#ffc83d * >1.0) |                  |   dimmed to 30%    |
+------------------+                   +---------+----------+                  +--------------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               |    @react-three/postprocessing    |
                               |    <Bloom mipmapBlur              |
                               |           luminanceThreshold={1.0}|
                               |           intensity={1.4}         |
                               |           radius={0.75} />        |
                               +-----------------------------------+
```

### Visual State Matrix

| State | Shell Material | Core Light | Bloom Behavior | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Unread** | Category Color (`opacity: 0.45`, `emissive: 0.15`) | HDR Gold (`#ffc83d` $\times 2.8$–$3.8$) | **Selective Core Bloom** | Glass lantern with a glowing amber heart bleeding softly into dark space. |
| **Read** | Category Color (`opacity: 1.0`, `emissive: 0.20`) | *None* | **No Bloom** | Clean, solid sphere in its saturated category hue. |
| **Hover** | Category Color ($1.1\times$ scale) | HDR Gold ($+1.0$ multiplier boost) | **Brightened Bloom** | Expanded orb with intensified core glow. |
| **Cited** | Category Color (Standard) | Standard Core | **Radiant Gold Ring** | Prominent blooming gold halo around node; un-cited nodes dimmed to 0.3. |

---

## 🏗️ System Architecture

```
[News Sources: NewsData.io | Hacker News | GDELT 2.0 | RSS Feeds]
                              │
                              ▼
                 [cleanText() HTML Sanitizer]
                              │
                              ▼
            [24-Hour Recency & Deduplication Filter]
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
[Gemini Vector Embeddings]               [TF-IDF Offline Fallback]
 (gemini-embedding-001)                    (768D Sparse Vectorizer)
         └────────────────────┬────────────────────┘
                              │
                              ▼
          [Average-Linkage Agglomerative Clustering]
                              │
                              ▼
             [6-Category Prototype Classification]
                              │
                              ▼
           [PCA Projection (Power Iteration + Deflation)]
                              │
                              ▼
        [Hemispheric Brain Placement & Force Relaxation]
                              │
                              ▼
     [Interactive 3D Brain View (R3F + Selective Bloom)]
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `20.x` or `22.x`
- **Package Manager**: `npm` (v10+)

### 1. Clone & Install
```bash
git clone https://github.com/Neelanshdosi/Brainwave.git
cd Brainwave
npm install
```

> **Note**: An `.npmrc` is included with `legacy-peer-deps=true` to guarantee deterministic builds across local development and Vercel environments.

### 2. Environment Configuration
Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Populate the keys in `.env.local`:

```env
# ==========================================
# BRAINWAVE ENVIRONMENT VARIABLES
# ==========================================

# 1. Google Gemini API Key (Server-Side Only)
# Used for embeddings, Grounded Briefing Agent, and "Ask the Brain" Q&A.
# Obtain a free key at: https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here

# 2. NewsData.io API Key (Server-Side Only)
# Used for fetching global trending news headlines.
# Obtain a free key at: https://newsdata.io/
NEWSDATA_API_KEY=your_newsdata_api_key_here

# 3. Optional: Hugging Face API Key
# Fallback for BART summarization if needed.
HUGGINGFACE_API_KEY=your_huggingface_token_here

# 4. Optional: Global Daily AI Quota Cap (default: 200)
AI_DAILY_CAP=200
```

### 3. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
npm run start
```

---

## 🔑 Environment & API Configuration

| Environment Variable | Required | Description | Fallback Behavior |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | Recommended | Powers vector embeddings, grounding agent, and Q&A. | Falls back to internal **TF-IDF Vectorizer** for clustering/positioning; briefings indicate unavailable. |
| `NEWSDATA_API_KEY` | Optional | NewsData.io global news provider. | Pipeline continues seamlessly using Hacker News, GDELT, and RSS feeds. |
| `HUGGINGFACE_API_KEY` | Optional | Hugging Face summarization fallback. | Uses local extraction and Gemini summaries. |
| `AI_DAILY_CAP` | Optional | Daily request ceiling to prevent API wallet exhaustion. | Defaults to `200` calls per 24 hours. |

---

## 🧪 Testing & Quality Assurance

Brainwave includes a comprehensive test suite executed with Vitest:

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npx vitest
```

### Tested Modules
- ✅ **HTML Sanitization**: Verifies stripping of nested HTML tags, entities, and whitespace collapses.
- ✅ **Citation & Verification Engine**: Tests verbatim quote matching against body text, rejecting headline-only citations, quotes $<40$ chars, or missing body texts.
- ✅ **Briefing Gating & Availability**: Validates single-source gating and error handling for missing/depleted API keys.
- ✅ **Trend & Velocity Scoring**: Enforces the 24-hour max age filter and confirms unrated states for single-source or low-volume stories.
- ✅ **Category Classification**: Validates strict zero-shot argmax classification against the 6 core categories without "other" leakage.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (Turbopack, App Router)
- **UI & Animation**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **3D Graphics & Shaders**: [Three.js](https://threejs.org/), [React Three Fiber](https://r3f.docs.pmnd.rs/), [@react-three/drei](https://github.com/pmndrs/drei)
- **Post-Processing**: [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing), [postprocessing](https://github.com/pmndrs/postprocessing)
- **AI & NLP**: [Google Gemini 2.5 Flash & Embeddings](https://ai.google.dev/), Custom TF-IDF Engine
- **Test Framework**: [Vitest](https://vitest.dev/)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Crafted with precision by Neelansh D.</sub>
</div>
