import React from 'react';

const RECENT_SEARCH_KEY = 'myblog_recent_search';
const MAX_RECENT = 10;

/** localStorage에서 최근 검색어 목록 반환 */
export function getRecentSearches(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** 검색 시 최근 검색어에 추가 (앞에 넣고, 중복 제거, 최대 10개) */
export function addRecentSearch(query: string): void {
  if (typeof localStorage === 'undefined') return;
  const trimmed = query.trim();
  if (!trimmed) return;
  const list = getRecentSearches().filter((s) => s !== trimmed);
  list.unshift(trimmed);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

/** 최근 검색어 목록에서 항목 삭제 */
export function removeRecentSearch(term: string): void {
  if (typeof localStorage === 'undefined') return;
  const list = getRecentSearches().filter((s) => s !== term);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
}

/** 검색어 강조: 텍스트에서 query(대소문자 무시)를 노란 형광펜으로 표시한 React 노드 반환 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-500/60 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/** Supabase ilike 패턴용 이스케이프 (% _ \) */
export function escapeForLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
