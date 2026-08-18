import { Markup } from 'telegraf';
import type { ActionTracker } from '../agent/action.tracker.ts';
import type { ToolExecutor } from '../agent/tool.executor.ts';
import type { ActionLog } from '../agent/types.ts';
import { composeBeforeAfter, formatPatch } from '../agent/diff-view.ts';
import { clip } from './text.ts';

export interface ApprovalSession {
  tracker: ActionTracker;
  executor: ToolExecutor;
  pending: ActionLog[];
  messageId?: number;
  timeout?: ReturnType<typeof setTimeout>;
}

export const approvalSessions = new Map<number, ApprovalSession>();

export function clearApprovalSession(chatId: number) {
  const s = approvalSessions.get(chatId);
  if (s) {
    if (s.timeout) clearTimeout(s.timeout);
    approvalSessions.delete(chatId);
  }
}

function groupPending(pending: ActionLog[]) {
  const files = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];
  for (const a of pending) {
    if (a.type === 'tool_execute') shells.push(a);
    else {
      if (!files.has(a.path)) files.set(a.path, []);
      files.get(a.path)!.push(a);
    }
  }
  return { files, shells };
}

export function approvalSummary(pending: ActionLog[]): string {
  const { files, shells } = groupPending(pending);
  const fileLines = [...files].map(([path, actions]) => {
    const types = [...new Set(actions.map((a) => a.type.replace(/_/g, ' ')))].join(', ');
    return `📄 ${path} (${types})`;
  });
  const shellLines = shells.map((s) => `🖥 Shell: ${s.details.command}`);
  return ['Staged changes — review before applying', '', ...fileLines, ...shellLines, '', `Total: ${pending.length} change(s)`].join('\n');
}

export function approvalDiff(pending: ActionLog[]): string {
  const { files, shells } = groupPending(pending);
  const parts: string[] = [];
  for (const [filePath, actions] of files) {
    const sorted = [...actions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const { before, after } = composeBeforeAfter(sorted);
    parts.push(clip(formatPatch(filePath, before, after), 1500));
  }
  for (const s of shells) parts.push(`🖥 Shell: ${s.details.command}`);
  return parts.join('\n\n').trim();
}

async function promptApproval(
  ctx: any,
  chatId: number,
  session: ApprovalSession,
) {
  clearApprovalSession(chatId);
  const msg = await ctx.reply(approvalSummary(session.pending), {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 Show Diff', 'approval_diff')],
      [
        Markup.button.callback('✅ Accept All', 'approval_accept'),
        Markup.button.callback('❌ Reject All', 'approval_reject'),
      ],
    ]),
  });

  session.messageId = msg.message_id;
  session.timeout = setTimeout(() => {
    clearApprovalSession(chatId);
    for (const a of session.pending) session.tracker.updateStatus(a.id, 'rejected', false);
    session.executor.clearStaging();
    if (ctx.telegram && session.messageId) {
      ctx.telegram.editMessageText(chatId, session.messageId, undefined, '❌ Session expired due to inactivity. Nothing was applied.').catch(() => {});
    }
  }, 15 * 60 * 1000);

  approvalSessions.set(chatId, session);
}

export async function finishOrApprove(
  ctx: any,
  chatId: number,
  tracker: ActionTracker,
  executor: ToolExecutor,
  noChangesMsg: string,
) {
  const pending = tracker.getPendingMutations();
  if (pending.length === 0) {
    await ctx.reply(noChangesMsg);
    return;
  }
  await promptApproval(ctx, chatId, { tracker, executor, pending });
}