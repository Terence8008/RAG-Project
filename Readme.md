## Test project for Rag pipeline using GROQ as base
### Indexing (happens once per document)
1. **Extract** — raw file bytes → plain text (client-side, doc never hits server)
2. **Chunk** — plain text → overlapping 800-char chunks with 150-char overlap
3. **Embed** — each chunk → 384-dimension vector via `all-MiniLM-L6-v2`
4. **Store** — vectors + text inserted into Supabase pgvector table

### Retrieval (happens on every question)
1. **Embed query** — question → 384-dimension vector (same model as indexing)
2. **HNSW search** — cosine similarity search against all chunks for this document
3. **Rank** — top 4 chunks above 0.3 similarity threshold returned
4. **Generate** — chunks injected into Groq prompt as labeled context blocks

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components + API routes in one project |
| LLM | Groq / Llama 3.3 70B | Fastest inference, generous free tier |
| Embeddings | HF all-MiniLM-L6-v2 | Free, 384 dims, trained for semantic similarity |
| Vector DB | Supabase pgvector | Postgres-native, free tier, no new infra |
| Styling | Tailwind CSS | Utility-first, no CSS files |

### Prerequisites
- Node.js 18+
- Supabase project with pgvector enabled
- Groq API key (free at console.groq.com)
- Hugging Face token (free at huggingface.co)

### Setup
```bash
git clone https://github.com/yourusername/docmind
cd docmind
npm install
```

Create `.env.local`:
```
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
HF_API_KEY=
NEXT_PUBLIC_HF_API_KEY=
```

Run the database schema in Supabase SQL editor:
```bash
# Schema is in supabase/schema.sql
```

Start the dev server:
```bash
npm run dev
```

### Database Schema
```bash
cp supabase/schema.sql # run contents in Supabase SQL editor
```

### Vercel Deployment 
https://docmind-six.vercel.app