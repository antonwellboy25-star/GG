# 📱 Руководство по Safe Area для Telegram WebApp

## 🎯 Проблема
При запуске в Telegram WebApp на мобильных устройствах контент может перекрываться:
- **Камерой** (iPhone с notch/Dynamic Island)
- **Системными кнопками** Telegram
- **Индикатором Home** (жест навигации)
- **Скругленными углами** экрана

## ✅ Решение

### 1. CSS переменные для Safe Area
```css
:root {
  /* Получаем значения от Telegram WebApp */
  --app-safe-area-top: var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px));
  --app-safe-area-bottom: var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  --app-safe-area-left: var(--tg-safe-area-inset-left, env(safe-area-inset-left, 0px));
  --app-safe-area-right: var(--tg-safe-area-inset-right, env(safe-area-inset-right, 0px));
  
  /* Применяем минимальные отступы */
  --app-safe-top: max(var(--app-safe-area-top), 16px);    /* Для камеры */
  --app-safe-bottom: max(var(--app-safe-area-bottom), 12px); /* Для home indicator */
  --app-safe-left: max(var(--app-safe-area-left), 12px);
  --app-safe-right: max(var(--app-safe-area-right), 12px);
}
```

### 2. Рекомендуемые отступы по устройствам

| Устройство | Верх (top) | Низ (bottom) |
|-----------|-----------|-------------|
| iPhone с Dynamic Island | ~59px | ~34px |
| iPhone с Notch | ~44px | ~34px |
| iPhone без выреза | ~20px | ~20px |
| Android (современный) | ~24-32px | ~16-24px |
| Android (старый) | ~16px | ~16px |

### 3. Применение в компонентах

#### Top Bar (верхняя панель)
```css
.top-bar {
  /* Базовый отступ + дополнительный для красоты */
  padding-top: calc(var(--app-safe-top) + 12px);
  padding-left: calc(var(--app-safe-left) + 12px);
  padding-right: calc(var(--app-safe-right) + 12px);
}
```

#### Settings FAB (кнопка настроек)
```css
.settings-fab {
  /* Позиционируем с учетом камеры */
  top: calc(var(--app-safe-top) + 16px);
  right: calc(var(--app-safe-right) + 14px);
}
```

#### Navigation Bar (нижняя навигация)
```css
.nav-bar {
  /* Учитываем home indicator */
  padding-bottom: calc(var(--app-safe-bottom) + 6px);
  padding-left: var(--app-safe-left);
  padding-right: var(--app-safe-right);
}
```

### 4. JavaScript API для Safe Area

```typescript
// В App.tsx подписываемся на изменения
webApp.onEvent('safeAreaChanged', handleSafeAreaUpdate);
webApp.onEvent('viewportChanged', handleViewportUpdate);

// Запрашиваем актуальные данные
webApp.requestSafeArea?.();
webApp.requestContentSafeArea?.();
```

## 🎨 Оптимальные значения для красоты

### Портретная ориентация
```css
.top-bar {
  padding-top: calc(var(--app-safe-top) + clamp(12px, 2.5vh, 20px));
}

.settings-fab {
  top: calc(var(--app-safe-top) + clamp(16px, 3.5vh, 28px));
}

.screen-stack {
  padding-top: calc(var(--app-safe-top) + clamp(16px, 3.5vh, 28px));
}
```

### Альбомная ориентация (landscape)
```css
@media (orientation: landscape) {
  .top-bar {
    /* Меньше места по вертикали, но камера всё равно учитывается */
    padding-top: calc(var(--app-safe-top) + clamp(10px, 2vh, 14px));
  }
}
```

## 🚀 Fullscreen режим

```typescript
// Включаем fullscreen для максимального использования экрана
if (typeof webApp.requestFullscreen === 'function') {
  webApp.requestFullscreen();
}

// Блокируем вертикальные свайпы (предотвращаем закрытие)
if (typeof webApp.disableVerticalSwipes === 'function') {
  webApp.disableVerticalSwipes();
}
```

## 📐 HTML Meta Tags

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

## 🔍 Отладка

### Проверка safe area в DevTools
```javascript
// В консоли браузера
console.log({
  top: getComputedStyle(document.documentElement).getPropertyValue('--app-safe-area-top'),
  bottom: getComputedStyle(document.documentElement).getPropertyValue('--app-safe-area-bottom'),
  left: getComputedStyle(document.documentElement).getPropertyValue('--app-safe-area-left'),
  right: getComputedStyle(document.documentElement).getPropertyValue('--app-safe-area-right'),
});
```

### Визуальный дебаг
```css
/* Временно добавьте для визуализации safe area */
.debug-safe-area::before {
  content: '';
  position: fixed;
  top: var(--app-safe-top);
  left: var(--app-safe-left);
  right: var(--app-safe-right);
  bottom: var(--app-safe-bottom);
  border: 2px dashed red;
  pointer-events: none;
  z-index: 9999;
}
```

## 📱 Тестирование

### Обязательно протестируйте на:
1. ✅ iPhone 14/15 Pro (Dynamic Island)
2. ✅ iPhone 11/12/13 (Notch)
3. ✅ iPhone SE (без выреза)
4. ✅ Android с жестовой навигацией
5. ✅ Android с кнопками
6. ✅ Портретная ориентация
7. ✅ Альбомная ориентация

## 🎯 Результат

После применения всех изменений:
- ✅ Контент не перекрывается камерой
- ✅ Кнопки не скрываются системными элементами
- ✅ Красивые отступы на всех устройствах
- ✅ Адаптивность для разных ориентаций
- ✅ 100% использование экрана без рамок
