/**
 * @file 管理端任务 API — /api/admin/tools/task（BFF 薄转发）
 *
 * GET  待审核任务列表（旧项目「审核中」）。
 * POST 动作：create 建单 / approve 审核通过 / reject 驳回 / forceClose 强制结项 / delete 删除。
 * 旧项目无「草稿 / 发布 / 关闭」概念，审核通过即进入「等待中」（对官网即 published）。
 */
import { NextResponse } from 'next/server';
import { assertAllowedOrigin } from '@/shared/security/security';
import {
  arrayFrom,
  bodyOrEmpty,
  errJson,
  okJson,
  proxyBackend,
  readJsonBody,
  toTask,
} from '@/shared/backend-client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const proxy = await proxyBackend(req, { path: '/tools/admin/task' });
  if (proxy.status !== 200) {
    return NextResponse.json({ tasks: [], total: 0 });
  }
  const body = bodyOrEmpty(proxy);
  const tasks = arrayFrom(body, 'items').map(toTask);
  return okJson({ tasks, total: Number(body.total ?? tasks.length) }, proxy);
}

export async function POST(req: Request) {
  const originErr = assertAllowedOrigin(req);
  if (originErr) return originErr;

  const body = await readJsonBody(req);
  const action = body.action;

  if (action === 'create') {
    const task = body.task as Record<string, unknown> | undefined;
    if (!task) {
      return NextResponse.json({ error: '缺少任务数据', code: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const proxy = await proxyBackend(req, {
      path: '/tools/admin/task',
      method: 'POST',
      jsonBody: {
        title: task.title,
        description: task.description,
        difficulty: task.difficulty ?? null,
        reward: task.reward ?? null,
        deadline: task.deadline ?? null,
        tech_requirements: Array.isArray(task.techRequirements) ? task.techRequirements : null,
      },
    });
    if (proxy.status !== 200 && proxy.status !== 201) {
      return errJson(proxy, '创建失败');
    }
    return okJson({ task: toTask(proxy.body) }, proxy, { status: 201 });
  }

  const taskId = body.taskId as string | undefined;
  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId', code: 'VALIDATION_FAILED' }, { status: 400 });
  }

  if (action === 'delete') {
    const proxy = await proxyBackend(req, {
      path: `/tools/admin/task/${encodeURIComponent(taskId)}`,
      method: 'DELETE',
    });
    if (proxy.status !== 200) return errJson(proxy, '删除失败');
    return okJson({ ok: true }, proxy);
  }

  const actionPath: Record<string, string> = {
    approve: 'approve',
    reject: 'reject',
    forceClose: 'force-close',
  };
  const suffix = actionPath[action as string];
  if (!suffix) {
    return NextResponse.json({ error: '未知操作', code: 'VALIDATION_FAILED' }, { status: 400 });
  }

  const proxy = await proxyBackend(req, {
    path: `/tools/admin/task/${encodeURIComponent(taskId)}/${suffix}`,
    method: 'POST',
    jsonBody: { reason: body.reason ?? null },
  });
  if (proxy.status !== 200) return errJson(proxy, '操作失败');
  return okJson({ task: toTask(proxy.body) }, proxy);
}