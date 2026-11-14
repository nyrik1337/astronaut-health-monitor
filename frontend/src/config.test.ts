import { describe, expect, test } from 'vitest';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  test('defaults to http://localhost:8000 when VITE_API_BASE_URL is unset or blank', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl('   ')).toBe('http://localhost:8000');
  });

  test('trims whitespace and trailing slashes so paths join cleanly', () => {
    expect(resolveApiBaseUrl(' https://api.example.test/v1// ')).toBe('https://api.example.test/v1');
  });
});
