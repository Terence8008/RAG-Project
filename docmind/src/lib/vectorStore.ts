import { createClient } from "@supabase/supabase-js";
import { DocumentRecord } from "./types";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function loadDocuments(): Promise<DocumentRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, size_kb, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load documents: ${error.message}`);

  return (data ?? []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    sizeKb: doc.size_kb,
    chunks: [],
    vocab: [],
    createdAt: new Date(doc.created_at),
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}
