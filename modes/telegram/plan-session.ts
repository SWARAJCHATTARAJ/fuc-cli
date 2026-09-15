import { Markup } from 'telegraf';
import type { Plan } from '../plan/types.ts';


export interface PlanSession {
  plan: Plan;
  selected: Set<string>;
}

export const planSessions = new Map<number, PlanSession>();

export function planMessage(session: PlanSession): string {
  const lines = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    const tag = step.complexity ? ` [${step.complexity}]` : '';
    return `${mark} ${i + 1}. *${step.title}*${tag}`;
  });
  return [
    `📋 *Plan for:* ${session.plan.goal}`,
    '',
    ...lines,
    '',
    '_Tap steps to toggle, then hit Proceed._',
  ].join('\n');
}

export function planKeyboard(session: PlanSession) {
  const buttons = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    return Markup.button.callback(`${mark} ${i + 1}`, `plan_toggle:${step.id}`);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(buttons.slice(i, i + 5));
  }

  return Markup.inlineKeyboard([
    ...rows,
    [
      Markup.button.callback('✅ Select All', 'plan_all'),
      Markup.button.callback('⬜ Deselect All', 'plan_none'),
    ],
    [Markup.button.callback('🚀 Proceed', 'plan_proceed')],
  ]);
}

export async function refreshPlanUi(
  ctx: { editMessageText: (t: string, o: object) => Promise<unknown> },
  s: PlanSession,
) {
  await ctx.editMessageText(planMessage(s), {
    parse_mode: 'Markdown',
    reply_markup: planKeyboard(s).reply_markup,
  });
}