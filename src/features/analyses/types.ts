export interface Analysis {
  id: string; // UUID
  name: string; // 분석 대상 이름
  birth_date: string; // 생년월일 (YYYY-MM-DD)
  birth_time: string | null; // 태어난 시간 (HH:MM) 또는 null
  is_lunar: boolean; // 음력 여부
  model_type: 'flash' | 'pro'; // 사용된 모델
  created_at: string; // 분석 수행 시각 (ISO 8601)
}

export interface PaginationInfo {
  total_count: number;
  total_pages: number;
  current_page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface AnalysesListResponse {
  items: Analysis[];
  pagination: PaginationInfo;
}
