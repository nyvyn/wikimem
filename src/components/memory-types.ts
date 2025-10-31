export interface MemorySummaryDto {
  id: string;
  title: string;
  updated_at: number;
}

export interface MemoryDetailDto extends MemorySummaryDto {
  body: string;
}

export interface MemorySummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface MemoryDetail extends MemorySummary {
  body: string;
}

export interface MemorySearchResultDto {
  id: string;
  title: string;
  snippet: string;
  updated_at: number;
}

export interface MemorySearchResult extends MemorySummary {
  snippet: string;
}
