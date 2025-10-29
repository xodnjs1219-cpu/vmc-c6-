
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { AnalysisCard } from './AnalysisCard';

describe('AnalysisCard', () => {
  it('이름, 날짜, 모델 타입(Pro/Flash)을 정확히 렌더링한다', () => {
    const analysis = {
      id: 'test-id',
      name: '테스트 분석',
      birth_date: '2025-10-28',
      birth_time: '12:34',
      is_lunar: false,
      model_type: 'pro' as const,
      created_at: new Date().toISOString(),
    };
    render(<AnalysisCard analysis={analysis} />);
    expect(screen.getByText('테스트 분석')).toBeInTheDocument();
    expect(screen.getByText('2025-10-28')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });
});
