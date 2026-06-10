import { describe, it } from 'node:test';
import assert from 'node:assert';
import { main } from './index.js';

describe('CLI Entry Point', () => {
  it('should be defined', () => {
    assert.ok(main !== undefined, 'main should be defined');
  });
});
