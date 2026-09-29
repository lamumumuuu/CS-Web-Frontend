/**
 * @file 任务管理子面板 — 管理端待审核任务（旧项目「审核中」）
 *
 * 旧项目无「草稿 / 发布 / 关闭」概念：官网管理端只负责建单后的审核
 * （通过 → 等待中；驳回 → 已驳回），其余流转在旧项目自有后台完成。
 * 数据源：官网后端 BFF 代理 `/api/admin/tools/task`（GET 待审核 / POST approve·reject·delete）。
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components';
import { Check, X } from 'lucide-react';
import { formatDate } from './tool-types';
import { difficultyLabel, statusBadge, type TaskData } from './task-shared';
import { apiRequest } from '@/shared/hooks/use-api-request';

/** 任务管理子面板 — 待审核任务列表 + 审核通过 / 驳回 / 删除 */
export function TaskManagePanel() {
  const t = useTranslations('toolsAdmin');
  const tt = useTranslations('toolsTask');
  const tc = useTranslations('common');
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setTaskLoading(true);
    setTaskError(null);
    try {
      const r = await apiRequest<{ tasks?: TaskData[] }>('/api/admin/tools/task');
      if (r.ok) {
        setTasks(r.data?.tasks || []);
      } else {
        setTaskError(r.error ?? t('loadFailed'));
      }
    } catch {
      setTaskError(t('networkError'));
    } finally {
      setTaskLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /** 审核动作统一入口：成功即从待审核列表移除 */
  const act = useCallback(
    async (taskId: string, body: Record<string, unknown>, fallback: string) => {
      setActingId(taskId);
      try {
        const r = await apiRequest('/api/admin/tools/task', { method: 'POST', body });
        if (!r.ok) {
          alert(r.error ?? fallback);
        } else {
          setTasks((prev) => prev.filter((x) => x.id !== taskId));
        }
      } catch {
        alert(t('networkError'));
      } finally {
        setActingId(null);
      }
    },
    [t],
  );

  const handleApprove = (taskId: string) => act(taskId, { action: 'approve', taskId }, t('taskApproveFailed'));

  const handleReject = (taskId: string) => {
    const reason = window.prompt(tt('rejectReasonPrompt')) ?? '';
    act(taskId, { action: 'reject', taskId, reason }, t('taskRejectFailed'));
  };

  const handleDelete = (taskId: string) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    act(taskId, { action: 'delete', taskId }, t('taskDeleteFailed'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="meta-mono text-[11px] text-[var(--muted-foreground)]">
          {t('pendingTasksTitle', { count: tasks.length })}
        </span>
        <button
          type="button"
          onClick={() => fetchTasks()}
          disabled={taskLoading}
          className="focus-amber meta-mono text-[11px] text-[var(--muted-foreground)] hover:text-[var(--primary)] underline-grow disabled:opacity-30"
        >
          {taskLoading ? tc('loading') : tc('refresh')}
        </button>
      </div>

      {taskError && (
        <div className="p-4 border-l-2 border-[var(--destructive)] bg-[var(--destructive)]/[0.04] text-[12px] font-mono text-[var(--destructive)] mb-4">
          [ Error ] {taskError}
        </div>
      )}

      {taskLoading && tasks.length === 0 && (
        <div className="py-20 text-center meta-mono text-[var(--muted-foreground)]">{t('loading')}</div>
      )}

      {!taskLoading && !taskError && tasks.length === 0 && (
        <div className="py-20 text-center">
          <div className="meta-mono text-[var(--muted-foreground)] mb-4">{t('noTasks')}</div>
          <p className="text-[14px] text-[var(--muted-foreground)]">{t('noTasksDesc')}</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="hidden md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left meta-mono py-3 pr-4">{t('colTask')}</th>
                <th className="text-left meta-mono py-3 pr-4">{t('colDifficulty')}</th>
                <th className="text-left meta-mono py-3 pr-4">{t('colStatus')}</th>
                <th className="text-left meta-mono py-3 pr-4">{t('colReward')}</th>
                <th className="text-left meta-mono py-3 pr-4">{t('colCreated')}</th>
                <th className="text-left meta-mono py-3">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const badge = statusBadge(task.status, tt, task.statusLabel);
                return (
                  <tr key={task.id} className="border-b border-[var(--border)]">
                    <td className="py-3 pr-4">
                      <span className="text-[14px] text-[var(--foreground)]">{task.title}</span>
                    </td>
                    <td className="py-3 pr-4 meta-mono text-[11px] text-[var(--muted-foreground)]">
                      {difficultyLabel(tt, task.difficulty)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1 meta-mono text-[10px] px-2 py-0.5 border ${badge.cls}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 meta-mono text-[11px] text-[var(--primary)]">
                      {t('rewardUnit', { count: task.reward })}
                    </td>
                    <td className="py-3 pr-4 meta-mono text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary-outline"
                          size="sm"
                          type="button"
                          onClick={() => handleApprove(task.id)}
                          disabled={actingId === task.id}
                        >
                          {t('approve')}
                        </Button>
                        <Button
                          variant="amber"
                          size="sm"
                          type="button"
                          onClick={() => handleReject(task.id)}
                          disabled={actingId === task.id}
                        >
                          {t('reject')}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          disabled={actingId === task.id}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 移动端卡片列表 */}
      {tasks.length > 0 && (
        <div className="md:hidden space-y-3">
          {tasks.map((task) => {
            const badge = statusBadge(task.status, tt, task.statusLabel);
            return (
              <div key={task.id} className="border border-[var(--border)] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold text-[var(--foreground)]">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="meta-mono text-[10px] px-2 py-0.5 border border-[var(--border)] text-[var(--muted-foreground)]">
                        {difficultyLabel(tt, task.difficulty)}
                      </span>
                      <span className={`inline-flex items-center gap-1 meta-mono text-[10px] px-2 py-0.5 border ${badge.cls}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 meta-mono text-[11px] text-[var(--primary)]">
                    {t('rewardUnit', { count: task.reward })}
                  </span>
                </div>
                <div className="meta-mono text-[10px] text-[var(--muted-foreground)] mb-3">
                  {formatDate(task.createdAt)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary-outline"
                    size="sm"
                    type="button"
                    onClick={() => handleApprove(task.id)}
                    disabled={actingId === task.id}
                  >
                    <Check className="w-3.5 h-3.5" /> {t('approve')}
                  </Button>
                  <Button
                    variant="amber"
                    size="sm"
                    type="button"
                    onClick={() => handleReject(task.id)}
                    disabled={actingId === task.id}
                  >
                    <X className="w-3.5 h-3.5" /> {t('reject')}
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    disabled={actingId === task.id}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}