/**
 * @file 任务大厅列表 API — GET /api/tools/task（BFF 薄转发）
 *
 * 数据源为旧项目（经官网后端 BFF 代理）：内部通道放开峰过滤，返回全量已发布（等待中）任务。
 * 对外契约保持 camelCase 的 TaskData，与官网前端既有消费方一致。
 */
import {
  arrayFrom,
  bodyOrEmpty,
  errJson,
  okJson,
  proxyBackend,
  toTask,
} from '@/shared/backend-client';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const pageSize = Math.min(Number(url.searchParams.get('pageSize')) || 20, 100);
  const difficulty = url.searchParams.get('difficulty') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const keyword = url.searchParams.get('keyword') || undefined;

  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (difficulty) params.set('difficulty', difficulty);
  if (status) params.set('status', status);
  if (keyword) params.set('keyword', keyword);

  const proxy = await proxyBackend(req, { path: `/tools/task?${params.toString()}` });
  if (proxy.status !== 200) return errJson(proxy, '加载失败');

  const body = bodyOrEmpty(proxy);
  return okJson(
    {
      tasks: arrayFrom(body, 'items').map(toTask),
      total: Number(body.total ?? 0),
      page: Number(body.page ?? page),
      pageSize: Number(body.page_size ?? pageSize),
      totalPages: Number(body.total_pages ?? 1),
    },
    proxy,
  );
}