import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Question } from '@quiz/shared';
import { createGameServer, type GameServerHandles } from './app.js';

const pool: Question[] = [
  {
    id: 'q1',
    category: 'General',
    difficulty: 'easy',
    text: 'Question?',
    options: ['A', 'B'],
    correctIndex: 0,
  },
];

describe('createGameServer static client serving', () => {
  let clientDir: string;
  let handles: GameServerHandles;
  let baseUrl: string;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), 'quiz-client-'));
    writeFileSync(
      join(clientDir, 'index.html'),
      '<!doctype html><title>Quiz</title><div id="root"></div>',
    );
    writeFileSync(join(clientDir, 'app.js'), 'console.log("hi");');

    handles = createGameServer(pool, { clientDir });
    await new Promise<void>((resolve) => {
      handles.httpServer.listen(0, resolve);
    });
    const { port } = handles.httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    handles.service.dispose();
    handles.io.close();
    await new Promise<void>((resolve) => handles.httpServer.close(() => resolve()));
    rmSync(clientDir, { recursive: true, force: true });
  });

  it('serves the health check as JSON', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('serves static assets from the client directory', async () => {
    const response = await fetch(`${baseUrl}/app.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('console.log');
  });

  it('falls back to index.html for unknown client routes', async () => {
    const response = await fetch(`${baseUrl}/play`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
  });
});
