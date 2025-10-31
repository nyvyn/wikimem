import type {
  MemoryDetail,
  MemoryDetailDto,
  MemorySearchResult,
  MemorySearchResultDto,
  MemorySummary,
  MemorySummaryDto,
} from "./memory-types";

export function toSummary(dto: MemorySummaryDto): MemorySummary {
  return {
    id: dto.id,
    title: dto.title,
    updatedAt: dto.updated_at,
  };
}

export function toDetail(dto: MemoryDetailDto): MemoryDetail {
  return {
    id: dto.id,
    title: dto.title,
    updatedAt: dto.updated_at,
    body: dto.body,
  };
}

export function toSearchResult(dto: MemorySearchResultDto): MemorySearchResult {
  return {
    id: dto.id,
    title: dto.title,
    updatedAt: dto.updated_at,
    snippet: dto.snippet,
  };
}

export function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

export function deriveTitleFromMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const heading = trimmed.replace(/^#+\s*/, "").trim();
      if (heading.length > 0) return heading;
    } else {
      return trimmed;
    }
  }
  return "Untitled memory";
}
