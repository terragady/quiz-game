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

  it('rate-limits the SPA fallback route but not static assets', async () => {
    const fallback = await fetch(`${baseUrl}/play`);
    await fallback.text();
    expect(fallback.headers.get('ratelimit-policy')).not.toBeNull();

    const asset = await fetch(`${baseUrl}/app.js`);
    await asset.text();
    expect(asset.headers.get('ratelimit-policy')).toBeNull();
  });
});

describe('createGameServer CORS configuration', () => {
  async function handshakeAllowOrigin(
    handles: GameServerHandles,
    origin: string,
  ): Promise<string | null> {
    const { port } = handles.httpServer.address() as AddressInfo;
    const response = await fetch(
      `http://localhost:${port}/socket.io/?EIO=4&transport=polling`,
      { headers: { Origin: origin } },
    );
    await response.text();
    return response.headers.get('access-control-allow-origin');
  }

  async function withServer(
    options: Parameters<typeof createGameServer>[1],
    run: (handles: GameServerHandles) => Promise<void>,
  ): Promise<void> {
    const handles = createGameServer(pool, options);
    await new Promise<void>((resolve) => handles.httpServer.listen(0, resolve));
    try {
      await run(handles);
    } finally {
      handles.service.dispose();
      handles.io.close();
      await new Promise<void>((resolve) =>
        handles.httpServer.close(() => resolve()),
      );
    }
  }

  it('reflects any origin by default', async () => {
    await withServer({}, async (handles) => {
      expect(await handshakeAllowOrigin(handles, 'https://anywhere.example')).toBe(
        'https://anywhere.example',
      );
    });
  });

  it('allows a configured origin but not others', async () => {
    await withServer(
      { corsOrigin: ['https://quiz.example.com'] },
      async (handles) => {
        expect(
          await handshakeAllowOrigin(handles, 'https://quiz.example.com'),
        ).toBe('https://quiz.example.com');
        expect(
          await handshakeAllowOrigin(handles, 'https://evil.example'),
        ).toBeNull();
      },
    );
  });
});
