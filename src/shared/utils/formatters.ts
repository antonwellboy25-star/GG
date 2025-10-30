/**
 * Общие утилиты форматирования чисел для приложения GG Mining
 */

/**
 * Форматтер для целых чисел (GRAM, количества сессий и т.д.)
 */
export const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/**
 * Форматтер для дробных чисел с высокой точностью (GOLD)
 */
export const goldFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Форматтер для чисел средней точности (GG)
 */
export const ggFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Форматирование времени в формате MM:SS
 * @param seconds - количество секунд
 * @returns строка в формате "MM:SS"
 */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
