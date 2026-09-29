// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Hooks under test use translations for user-facing fallback messages; keep unit tests independent of NextIntlClientProvider.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
import { useTasks } from './use-tasks';

/**
 * useTasks 单测（GENERAL 3.8「tests 覆盖拆分后组件」、2.4「拆分即补测」）
 * mock fetch，聚焦挂载加载、难度筛选、接取与建单。
 * 任务数据源为旧项目（BFF 代理）：单接取人模型，无多名额 / 取消接取。
 */

const mockUser = { id: 'u1', role: 'member' };

const mockTasks = [
  {
    id: 't1', title: '任务A', description: 'd', difficulty: '黑铁', techRequirements: [],
    reward: 10, deadline: null, status: 'published', statusLabel: '等待中',
    publisherId: null, publisherName: null, publisherAvatar: null, completer: null,
    submissionDescription: null, attachmentUrl: null, rejectReason: null,
    reviewedBy: null, reviewedAt: null, createdAt: '2024-01-01', updatedAt: '2024-01-01',
  },
];

/** 构造最小 fetch Response 桩（apiRequest 优先调用 text()） */
function res(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** 安装按 URL 分发的 fetch mock；overrides 可按 URL 覆盖响应 */
function installFetch(overrides: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (overrides[url]) return overrides[url]();
    if (url === '/api/auth/me') return res({ user: mockUser });
    if (url.startsWith('/api/tools/task?')) return res({ tasks: mockTasks });
    if (url === '/api/tools/task/claims') return res({ claims: [] });
    if (url === '/api/admin/tools/task') return res({ tasks: [] });
    if (url.startsWith('/api/tools/task/')) return res({ claim: {} });
    return res({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('挂载时拉取用户与任务列表并填充', async () => {
    const fetchMock = installFetch();

    const { result } = renderHook(() => useTasks());

    expect(result.current.tasksLoading).toBe(true);
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('/api/tools/task?status=published&pageSize=50', expect.anything());
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.user?.id).toBe('u1');
    expect(result.current.filteredTasks).toHaveLength(1);
  });

  it('难度筛选：设置 difficultyFilter 后 filteredTasks 仅含该难度', async () => {
    installFetch();

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));

    act(() => {
      result.current.setDifficultyFilter('黑铁');
    });
    expect(result.current.filteredTasks).toHaveLength(1);

    act(() => {
      result.current.setDifficultyFilter('黄金');
    });
    expect(result.current.filteredTasks).toHaveLength(0);
  });

  it('handleClaim 成功：调用接取接口并重新拉取列表', async () => {
    const fetchMock = installFetch();

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));

    await act(async () => {
      await result.current.handleClaim('t1');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tools/task/t1/claim',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.claimingId).toBeNull();
  });

  it('handleClaim 失败：alert 且 claimingId 归零', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    installFetch({
      '/api/tools/task/t1/claim': () => res({ error: '已被接取' }, 400),
    });

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));

    await act(async () => {
      await result.current.handleClaim('t1');
    });

    expect(alertSpy).toHaveBeenCalledWith('已被接取');
    expect(result.current.claimingId).toBeNull();
  });

  it('handleCreate 成功：关闭表单并重置 newTask', async () => {
    const fetchMock = installFetch();

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));

    act(() => {
      result.current.setShowCreateForm(true);
      result.current.setNewTask((f) => ({ ...f, title: '新任务', description: 'desc' }));
    });

    await act(async () => {
      await result.current.handleCreate(new Event('submit') as unknown as React.FormEvent);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/tools/task',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.showCreateForm).toBe(false);
    expect(result.current.newTask.title).toBe('');
  });
});