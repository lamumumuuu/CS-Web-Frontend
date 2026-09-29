/**
 * @file 任务接取人 API — GET /api/tools/task/[id]/claims（BFF 薄转发）
 *
 * 旧项目为「单接取人」模型：不存在独立认领记录，此端点收敛为唯一接取人（completer）。
 * 保留端点形状（claims 数组）以免前端消费方 404。
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
    return NextResponse.json({ claims: [] });
  }

  const task = toTask(proxy.body);
  const completer = task.completer as { id: string; name: string | null } | null;
  return okJson(
    {
      claims: completer
        ? [
            {
              id: String(task.id),
              taskId: String(task.id),
              userId: completer.id,
              status: task.status,
              statusLabel: task.statusLabel,
              createdAt: task.updatedAt,
              displayName: completer.name,
            },
          ]
        : [],
    },
    proxy,
  );
}