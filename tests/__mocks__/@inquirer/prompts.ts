import { vi } from 'vitest';

export const input = vi.fn().mockResolvedValue('test-input');
export const select = vi.fn().mockResolvedValue('option-1');
export const confirm = vi.fn().mockResolvedValue(true);
