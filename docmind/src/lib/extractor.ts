"use client";

/**
 * Client-only file — uses browser File API and pdfjs (browser APIs).
 * Never import this in API routes or server components.
 */

export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (["txt", "md", "csv", "json"].includes(ext ?? "")) {
    return await file.text();
  }

  if (ext === "pdf") {
    return await extractPdfText(file);
  }

  throw new Error(
    `Unsupported file type. Upload .txt, .md, .pdf, .csv, or .json`
  );
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items.filter((item) => "str" in item) as {
      str: string;
      transform: number[];
      width: number;
    }[];

    const rows = new Map<number, string[]>();

    for (const item of items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(item.str);
    }

    const sortedRows = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, spans]) => {
        const line = spans.join("");
        const isCharSpread = /^(\S\s){3,}/.test(line.trim());
        if (isCharSpread) return line.replace(/ /g, "");
        return line;
      });

    pageTexts.push(sortedRows.join(" "));
  }

  const fullText = pageTexts.join(" ").replace(/\s+/g, " ").trim();

  if (fullText.length < 50) {
    throw new Error(
      "Could not extract text from this PDF. It may be scanned or image-based."
    );
  }

  return fullText;
}