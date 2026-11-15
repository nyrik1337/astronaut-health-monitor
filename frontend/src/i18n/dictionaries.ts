import { companion } from './dict/companion';
import { dashboard } from './dict/dashboard';
import { fatigue } from './dict/fatigue';
import { mission } from './dict/mission';
import { recovery } from './dict/recovery';
import { shell } from './dict/shell';

/** All interface strings. English defines the keys; Russian must match them exactly. */
export const en = {
  ...shell.en,
  ...dashboard.en,
  ...mission.en,
  ...fatigue.en,
  ...companion.en,
  ...recovery.en,
} as const;

export const ru: Record<keyof typeof en, string> = {
  ...shell.ru,
  ...dashboard.ru,
  ...mission.ru,
  ...fatigue.ru,
  ...companion.ru,
  ...recovery.ru,
};
