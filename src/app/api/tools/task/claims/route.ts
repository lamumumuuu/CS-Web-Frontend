/**
 * @file 我的任务 API — GET /api/tools/task/claims（BFF 薄转发）
 *
 * 对接旧项目 /tasks/accepted 语义：返回当前用户接取的任务（单接取人模型，任务即认领）。
 */
import { NextResponse } from 'next/server';
import { arrayFrom, bodyOrEmpty, okJson, proxyBackend, toTask } from '@/shared/backend-client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const proxy = await proxyBackend(req, { path: '/tools/task/claims' });
  if (proxy.status !== 200) {
    return NextResponse.json({ claims: [] });
  }

  const body = bodyOrEmpty(proxy);
  const claims = arrayFrom(body, 'items').map((raw) => {
    const task = toTask(raw);
    return {
      id: task.id,
      taskId: task.id,
      status: task.status,
      statusLabel: task.statusLabel,
      createdAt: task.updatedAt,
      task,
    };
  });
  return okJson({ claims, total: Number(body.total ?? claims.length) }, proxy);
}