/**
 * @file 提交成果 API — POST /api/tools/task/claims/[id]/submit（BFF 薄转发）
 *
 * 请求体承载「描述 + 附件链接」，映射到旧项目 submit 的 description / attachmentUrl。
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

  const body = (await req.json().catch(() => ({}))) as {
    description?: string;
    attachmentUrl?: string;
  };
  const { id } = await params;

  const proxy = await proxyBackend(req, {
    path: `/tools/task/claims/${encodeURIComponent(id)}/submit`,
    method: 'POST',
    jsonBody: {
      description: body.description ?? '',
      attachment_url: body.attachmentUrl ?? '',
    },
  });

  if (proxy.status !== 200) {
    return errJson(proxy, '提交失败');
  }
  return okJson({ claim: toClaim(proxy.body) }, proxy);
}