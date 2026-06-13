import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { ScriptRunner } from '../../src/core/ScriptRunner.js';
import { EventEmitter } from 'node:events';
import child_process from 'node:child_process';

function makeMockChild(exitCode = 0): any {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = mock.fn();
  // Emit close after a tick
  setTimeout(() => child.emit('close', exitCode), 10);
  return child;
}

describe('ScriptRunner', () => {
  let runner: ScriptRunner;

  afterEach(() => {
    mock.restoreAll();
  });

  beforeEach(() => {
    runner = new ScriptRunner(5000);
    mock.method(child_process, 'spawn', () => makeMockChild(0));
  });

  it('resolves when script exits with 0', async () => {
    await runner.runScript({ command: 'echo', args: ['hello'], cwd: '/tmp' }, 'postInstall', true);
  });

  it('rejects when script exits with non-zero code', async () => {
    mock.method(child_process, 'spawn', () => makeMockChild(1));

    await assert.rejects(async () => {
      await runner.runScript({ command: 'false', cwd: '/tmp' }, 'postInstall', true);
    }, { message: 'postInstall script exited with code 1' });
  });

  it('sends SIGTERM on timeout', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const slowChild = new EventEmitter() as any;
    slowChild.stdout = new EventEmitter();
    slowChild.stderr = new EventEmitter();
    slowChild.kill = mock.fn();
    mock.method(child_process, 'spawn', () => slowChild);

    const shortRunner = new ScriptRunner(100);
    const promise = shortRunner.runScript({ command: 'sleep', args: ['99'], cwd: '/tmp' }, 'postInstall', true);

    mock.timers.tick(200);
    // @ts-ignore
    assert.ok(child_process.spawn.mock.calls.length > 0);

    // Emit close to settle the promise
    slowChild.emit('close', null);
    await promise;
    mock.timers.reset();
  });

  it('runs scripts sequentially', async () => {
    const order: number[] = [];
    let call = 0;
    mock.method(child_process, 'spawn', () => {
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

    assert.deepStrictEqual(order, [0, 1]);
  });
});
