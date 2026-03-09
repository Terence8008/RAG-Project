-- Enable pgvector
create extension if not exists vector;

-- Documents metadata
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size_kb float not null,
  created_at timestamptz default now()
);

-- Chunks with embeddings
create table chunks (
  id bigserial primary key,
  document_id uuid references documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(384)
);

-- HNSW index for fast cosine similarity search
create index on chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Similarity search function
create or replace function match_chunks(
  query_embedding vector(384),
  match_document_id uuid,
  match_count int default 4,
  match_threshold float default 0.3
)
returns table (
  id bigint,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.chunk_index,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.document_id = match_document_id
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;