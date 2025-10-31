"use client";

import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryDetail,
  MemoryDetailDto,
  MemorySummary,
  MemorySummaryDto,
} from "./memory-types";
import { toDetail, toSummary } from "./memory-utils";

export async function listMemories(): Promise<MemorySummary[]> {
  const dto = await invoke<MemorySummaryDto[]>("list_memories");
  return dto.map(toSummary);
}

export async function loadMemory(id: string): Promise<MemoryDetail> {
  const dto = await invoke<MemoryDetailDto>("load_memory", { id });
  return toDetail(dto);
}

export async function saveMemory(payload: {
  id?: string;
  title: string;
  body: string;
}): Promise<MemoryDetail> {
  const dto = await invoke<MemoryDetailDto>("save_memory", { payload });
  return toDetail(dto);
}
