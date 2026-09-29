'use client';

/**
 * @file useTasks — 协会任务页共享状态与逻辑 Hook
 *
 * 从 `app/tools/task/page.tsx` 拆出，遵循 GENERAL 2.2「展示与容器分离」、
 * 2.4「逻辑 > 150 行提为 Hook / 组件 > 500 行拆分」。各 tab 子组件复用本 Hook 的返回值。
 *
 * 任务数据源为旧项目（经官网后端 BFF 代理）：单接取人模型，无多名额、无取消接取。
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiRequest } from '@/shared/hooks/use-api-request';
import type { TaskData, ClaimData, PointsProfile, LeaderboardEntry } from '../task-shared';

/** 管理员创建表单初值（旧项目难度枚举，默认黑铁） */
const EMPTY_NEW_TASK = {
  title: '',
  description: '',
  difficulty: '黑铁',
  reward: 10,
  deadline: '',
  techRequirements: '',
};

export function useTasks() {
  const t = useTranslations('toolsTask');
  // 任务列表
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 我的任务
  const [myClaims, setMyClaims] = useState<ClaimData[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);

  // 积分
  const [pointsProfile, setPointsProfile] = useState<PointsProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);

  // 管理员创建表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ ...EMPTY_NEW_TASK });
  const [creating, setCreating] = useState(false);

  // 管理员待审核任务（旧项目「审核中」）
  const [pendingTasks, setPendingTasks] = useState<TaskData[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'root' || user?.role === 'task_publisher';

  /** 拉取任务大厅（已发布 / 旧项目「等待中」） */
  const loadTasks = useCallback(() => {
    setTasksLoading(true);
    apiRequest<{ tasks?: TaskData[] }>('/api/tools/task?status=published&pageSize=50')
      .then((r) => {
        if (!r.ok) throw new Error(r.error ?? t('loadFailed'));
        setTasks(r.data?.tasks || []);
        setTasksError(null);
      })
      .catch((err) => {
        setTasksError(err.message);
      })
      .finally(() => setTasksLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初始化：获取用户信息 + 任务列表
  useEffect(() => {
    apiRequest<{ user: { id: string; role: string } }>('/api/auth/me')
      .then((r) => r.data)
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
    loadTasks();
  }, [loadTasks]);

  // 获取我的任务
  const loadMyClaims = useCallback(() => {
    if (!user) return;
    setClaimsLoading(true);
    apiRequest<{ claims?: ClaimData[] }>('/api/tools/task/claims')
      .then((r) => {
        if (!r.ok) throw new Error(r.error ?? t('loadFailed'));
        setMyClaims(r.data?.claims || []);
      })
      .catch(() => {})
      .finally(() => setClaimsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 获取积分
  const loadPoints = useCallback(() => {
    if (!user) return;
    setPointsLoading(true);
    Promise.all([
      apiRequest<{ profile?: PointsProfile }>('/api/tools/points'),
      apiRequest<{ leaderboard?: LeaderboardEntry[] }>('/api/tools/points/leaderboard'),
    ])
      .then(([pResult, lResult]) => {
        if (pResult.ok && pResult.data?.profile) setPointsProfile(pResult.data.profile);
        if (lResult.ok && lResult.data?.leaderboard) setLeaderboard(lResult.data.leaderboard);
      })
      .catch(() => {})
      .finally(() => setPointsLoading(false));
  }, [user]);

  // 管理员获取待审核任务
  const loadPendingTasks = useCallback(() => {
    if (!isAdmin) return;
    apiRequest<{ tasks?: TaskData[] }>('/api/admin/tools/task')
      .then((r) => {
        if (r.ok && r.data?.tasks) setPendingTasks(r.data.tasks);
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    loadPendingTasks();
  }, [loadPendingTasks, tasks]);

  /** 接取任务（旧项目「等待中 → 讨伐中」）：单接取人，接取后本人即为接取人 */
  const handleClaim = useCallback(async (taskId: string) => {
    setClaimingId(taskId);
    try {
      const r = await apiRequest(`/api/tools/task/${taskId}/claim`, { method: 'POST' });
      if (!r.ok) throw new Error(r.error ?? t('actionFailed'));
      loadTasks();
      loadMyClaims();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setClaimingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTasks, loadMyClaims]);

  /** 提交成果（描述 + 附件链接），对应旧项目「讨伐中 → 已提交」 */
  const handleSubmitResult = useCallback(async (taskId: string, description: string, attachmentUrl: string) => {
    setSubmittingId(taskId);
    try {
      const r = await apiRequest(`/api/tools/task/claims/${taskId}/submit`, {
        method: 'POST',
        body: { description, attachmentUrl },
      });
      if (!r.ok) throw new Error(r.error ?? t('submitFailed'));
      loadMyClaims();
      return true;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSubmittingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMyClaims]);

  /** 管理员建单：旧项目落库后进入「审核中」 */
  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await apiRequest('/api/admin/tools/task', {
        method: 'POST',
        body: {
          action: 'create',
          task: {
            title: newTask.title,
            description: newTask.description,
            difficulty: newTask.difficulty,
            reward: newTask.reward,
            deadline: newTask.deadline || null,
            techRequirements: newTask.techRequirements
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          },
        },
      });
      if (!r.ok) throw new Error(r.error ?? t('createFailed'));
      setShowCreateForm(false);
      setNewTask({ ...EMPTY_NEW_TASK });
      loadTasks();
      loadPendingTasks();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [newTask, loadTasks, loadPendingTasks]);

  /** 管理员审核通过：旧项目「审核中 → 等待中」 */
  const handleApprove = useCallback(async (taskId: string) => {
    setReviewingId(taskId);
    try {
      const r = await apiRequest('/api/admin/tools/task', {
        method: 'POST',
        body: { action: 'approve', taskId },
      });
      if (!r.ok) throw new Error(r.error ?? t('actionFailed'));
      setPendingTasks((prev) => prev.filter((x) => x.id !== taskId));
      loadTasks();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewingId(null);
    }
  }, [loadTasks]);

  /** 管理员审核驳回：旧项目「审核中 → 已驳回」，原因透传 */
  const handleReject = useCallback(async (taskId: string) => {
    const reason = window.prompt(t('rejectReasonPrompt')) ?? '';
    setReviewingId(taskId);
    try {
      const r = await apiRequest('/api/admin/tools/task', {
        method: 'POST',
        body: { action: 'reject', taskId, reason },
      });
      if (!r.ok) throw new Error(r.error ?? t('actionFailed'));
      setPendingTasks((prev) => prev.filter((x) => x.id !== taskId));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewingId(null);
    }
  }, [t]);

  return {
    // 任务列表
    tasks,
    tasksLoading,
    tasksError,
    difficultyFilter,
    setDifficultyFilter,
    claimingId,
    expandedId,
    setExpandedId,
    filteredTasks: difficultyFilter ? tasks.filter((x) => x.difficulty === difficultyFilter) : tasks,
    loadTasks,
    // 我的任务
    myClaims,
    claimsLoading,
    submittingId,
    user,
    loadMyClaims,
    handleSubmitResult,
    // 积分
    pointsProfile,
    leaderboard,
    pointsLoading,
    loadPoints,
    // 管理员
    isAdmin,
    showCreateForm,
    setShowCreateForm,
    newTask,
    setNewTask,
    creating,
    pendingTasks,
    reviewingId,
    handleClaim,
    handleCreate,
    handleApprove,
    handleReject,
  };
}