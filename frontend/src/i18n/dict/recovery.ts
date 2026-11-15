import { section } from '../section';

/** MindGuard: stress check-in, relaxed breathing and the follow-up card. */
export const recovery = section(
  {
    'mg.title': 'Stress check-in and breathing',
    'mg.intro':
      '**MindGuard** is a voluntary wellbeing exercise, not a medical assessment or a treatment. Your answers stay in this page’s memory only: they are not stored in the browser or sent anywhere, and they are gone when you reload or clear them. If stress feels overwhelming, talk to your crew medical officer or a health professional.',
    'mg.step1': '1. Check in (optional)',
    'mg.step2': '2. Relaxed breathing',
    'mg.step3': '3. Check in again (optional)',
    'mg.before': 'How stressed do you feel right now?',
    'mg.after': 'How stressed do you feel now?',
    'mg.beforeLabel': 'Before (your self-report)',
    'mg.afterLabel': 'After (your self-report)',
    'mg.afterStopped': 'After (your self-report, practice stopped early)',
    'mg.noCausal':
      'These are two answers you gave. A different number afterwards does not show that the breathing practice caused the change — how stressed we feel shifts for many reasons.',
    'mg.clear': 'Clear my check-ins',
    'mg.rating.1': 'Very low',
    'mg.rating.2': 'Low',
    'mg.rating.3': 'Moderate',
    'mg.rating.4': 'High',
    'mg.rating.5': 'Very high',
    'br.safety':
      'Breathe at a pace that feels comfortable. This practice has no breath-holding and no fast breathing. If you feel dizzy or uncomfortable, stop and breathe normally.',
    'br.length': 'Length',
    'br.seconds': '{seconds} seconds',
    'br.start': 'Start breathing practice',
    'br.inhale': 'Breathe in gently through your nose',
    'br.exhale': 'Breathe out slowly and softly',
    'br.done': 'Practice finished — breathe normally',
    'br.paused': 'Paused',
    'br.stopped': 'Practice stopped — breathe normally',
    'br.breaths': '{count} breaths',
    'br.remaining': '{phase} s · {total} s left',
    'br.pause': 'Pause',
    'br.resume': 'Resume',
    'br.stop': 'Stop',
    'br.again': 'Practice again',
    'fu.title': 'How follow-up works in the mission simulation',
    'fu.p1':
      'In the synthetic mission replay, a value outside a crew member’s personal range is checked again later. If a follow-up check finds it back inside the range, the alert is recorded as **Returned to range**. If it is still outside after the follow-up checks, it is recorded as **Flagged for human review**.',
    'fu.p2':
      'Returning to range does not prove that a break, a breathing practice or any other step caused the change. Values also move back on their own, and the simulation does not test what caused it. Decisions stay with people, such as the crew medical officer.',
  },
  {
    'mg.title': 'Оценка стресса и дыхание',
    'mg.intro':
      '**MindGuard** — добровольное упражнение для самочувствия, а не медицинская оценка и не лечение. Ваши ответы хранятся только в памяти этой страницы: они не сохраняются в браузере и никуда не отправляются и исчезают при перезагрузке или очистке. Если стресс кажется непосильным, поговорите с врачом экипажа или медицинским специалистом.',
    'mg.step1': '1. Оцените состояние (необязательно)',
    'mg.step2': '2. Спокойное дыхание',
    'mg.step3': '3. Оцените состояние снова (необязательно)',
    'mg.before': 'Насколько сильный стресс вы ощущаете сейчас?',
    'mg.after': 'Насколько сильный стресс вы ощущаете теперь?',
    'mg.beforeLabel': 'До (ваша самооценка)',
    'mg.afterLabel': 'После (ваша самооценка)',
    'mg.afterStopped': 'После (ваша самооценка, практика остановлена досрочно)',
    'mg.noCausal':
      'Это два ваших ответа. Другое число после практики не доказывает, что изменение вызвано дыхательной практикой — ощущение стресса меняется по многим причинам.',
    'mg.clear': 'Очистить мои ответы',
    'mg.rating.1': 'Очень низкий',
    'mg.rating.2': 'Низкий',
    'mg.rating.3': 'Умеренный',
    'mg.rating.4': 'Высокий',
    'mg.rating.5': 'Очень высокий',
    'br.safety':
      'Дышите в удобном для вас темпе. В этой практике нет задержек дыхания и учащённого дыхания. Если почувствуете головокружение или дискомфорт, остановитесь и дышите как обычно.',
    'br.length': 'Длительность',
    'br.seconds': '{seconds} секунд',
    'br.start': 'Начать дыхательную практику',
    'br.inhale': 'Мягко вдохните через нос',
    'br.exhale': 'Медленно и спокойно выдохните',
    'br.done': 'Практика завершена — дышите как обычно',
    'br.paused': 'Пауза',
    'br.stopped': 'Практика остановлена — дышите как обычно',
    'br.breaths': 'Циклов дыхания: {count}',
    'br.remaining': '{phase} с · осталось {total} с',
    'br.pause': 'Пауза',
    'br.resume': 'Продолжить',
    'br.stop': 'Стоп',
    'br.again': 'Повторить практику',
    'fu.title': 'Как устроена повторная проверка в симуляции миссии',
    'fu.p1':
      'В синтетической записи миссии значение, вышедшее за личный диапазон члена экипажа, позже проверяется снова. Если повторная проверка находит его в пределах диапазона, оповещение записывается как **«Вернулось в диапазон»**. Если после повторных проверок оно всё ещё вне диапазона, записывается **«Передано на проверку человеку»**.',
    'fu.p2':
      'Возврат в диапазон не доказывает, что изменение вызвано перерывом, дыхательной практикой или любым другим шагом. Значения возвращаются и сами по себе, а симуляция не проверяет причину. Решения остаются за людьми, например за врачом экипажа.',
  },
);
