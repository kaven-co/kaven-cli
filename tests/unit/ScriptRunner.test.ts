import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptRunner } from '../../src/core/ScriptRunner.js';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock readline
vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn((_msg: string, cb: (ans: string) => void) => cb('y')),
      close: vi.fn(),
    })),
  },
}));

function makeMockChild(exitCode = 0): any {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  // Emit close after a tick
  setTimeout(() => child.emit('close', exitCode), 10);
  return child;
}

describe('ScriptRunner', () => {
  let runner: ScriptRunner;

  beforeEach(async () => {
    vi.clearAllMocks();
    runner = new ScriptRunner(5000);
    const { spawn } = await import('child_process');
    vi.mocked(spawn).mockReturnValue(makeMockChild(0));
  });

  it('resolves when script exits with 0', async () => {
    await expect(
      runner.runScript({ command: 'echo', args: ['hello'], cwd: '/tmp' }, 'postInstall', true)
    ).resolves.toBeUndefined();
  });

  it('rejects when script exits with non-zero code', async () => {
    const { spawn } = await import('child_process');
    vi.mocked(spawn).mockReturnValue(makeMockChild(1));

    await expect(
      runner.runScript({ command: 'false', cwd: '/tmp' }, 'postInstall', true)
    ).rejects.toThrow('postInstall script exited with code 1');
  });

  it('sends SIGTERM on timeout', async () => {
    vi.useFakeTimers();
    const { spawn } = await import('child_process');
    const slowChild = new EventEmitter() as any;
    slowChild.stdout = new EventEmitter();
    slowChild.stderr = new EventEmitter();
    slowChild.kill = vi.fn();
    vi.mocked(spawn).mockReturnValue(slowChild);

    const shortRunner = new ScriptRunner(100);
    const promise = shortRunner.runScript({ command: 'sleep', args: ['99'], cwd: '/tmp' }, 'postInstall', true);

    vi.advanceTimersByTime(200);
    expect(slowChild.kill).toHaveBeenCalledWith('SIGTERM');

    // Emit close to settle the promise
    slowChild.emit('close', null);
    await promise;
    vi.useRealTimers();
  });

  it('runs scripts sequentially', async () => {
    const order: number[] = [];
    const { spawn } = await import('child_process');
    let call = 0;
    vi.mocked(spawn).mockImplementation(() => {
      const idx = call++;
      order.push(idx);
      return makeMockChild(0);
    });

    await runner.runScripts(
      [
        { command: 'cmd1', cwd: '/tmp' },
        { command: 'cmd2', cwd: '/tmp' },
      ],
      'postInstall',
      true
    );

    expect(order).toEqual([0, 1]);
  });
});
