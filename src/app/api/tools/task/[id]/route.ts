/**
 * @file 任务详情 API — GET /api/tools/task/[id]（BFF 薄转发）
 */
import { NextResponse } from 'next/server';
import { okJson, proxyBackend, toTask } from '@/shared/backend-client';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const proxy = await proxyBackend(req, { path: `/tools/task/${encodeURIComponent(id)}` });

  if (proxy.status !== 200) {
    return NextResponse.json({ task: null });
  }
  return okJson({ task: toTask(proxy.body) }, proxy);
}