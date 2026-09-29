/**
 * @file 任务接取 API — POST /api/tools/task/[id]/claim（BFF 薄转发）
 *
 * 对接旧项目 accept 语义（「等待中 → 讨伐中」）；旧项目为单接取人模型，无取消接取能力。
 */
import { assertAllowedOrigin } from '@/shared/security/security';
import { errJson, okJson, proxyBackend, toClaim } from '@/shared/backend-client';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originErr = assertAllowedOrigin(req);
  if (originErr) return originErr;

  const { id } = await params;
  const proxy = await proxyBackend(req, {
    path: `/tools/task/${encodeURIComponent(id)}/claim`,
    method: 'POST',
  });

  if (proxy.status !== 200 && proxy.status !== 201) {
    return errJson(proxy, '接取失败');
  }
  return okJson({ claim: toClaim(proxy.body) }, proxy);
}