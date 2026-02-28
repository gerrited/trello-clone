# Dark Mode Design

**Date:** 2026-02-28
**Status:** Approved

## Summary

Add dark mode support to the web app using Tailwind CSS v4 class-based dark mode. Users can choose between System (default), Dark, and Light via the user menu. The preference is persisted to `localStorage`.

## Approach

Tailwind v4 class-based dark mode with a Zustand persist store. A `ThemeProvider` component manages the `dark` class on `<html>` and reacts to OS-level media query changes when "System" is selected.

## Architecture

### 1. CSS (`apps/web/src/main.css`)

Add a single line to enable class-based dark mode:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

### 2. Theme Store (`apps/web/src/stores/themeStore.ts`)

New Zustand store with `persist` middleware:

- State: `preference: 'system' | 'dark' | 'light'`
- Action: `setPreference(p: ThemePreference) => void`
- Persisted to `localStorage` under key `'theme-store'`

### 3. ThemeProvider (`apps/web/src/components/layout/ThemeProvider.tsx`)

A side-effect-only component (renders `<>{children}</>`):

- Subscribes to the theme store
- When `preference === 'system'`: listens to `window.matchMedia('(prefers-color-scheme: dark)')` and syncs the `dark` class on `document.documentElement`
- When `preference === 'dark'`: adds `dark` class unconditionally
- When `preference === 'light'`: removes `dark` class unconditionally
- Cleans up media query listener on unmount / preference change

### 4. App.tsx

Wrap `<BrowserRouter>` with `<ThemeProvider>`.

### 5. UserMenu (`apps/web/src/features/auth/UserMenu.tsx`)

Add an "Appearance" section above the logout divider with a segmented control showing three options (Sun / Monitor / Moon icons with labels "Hell" / "System" / "Dunkel"). The active option is visually highlighted. Clicking an option calls `themeStore.setPreference(...)`.

### 6. Component Theming (35 files)

Add `dark:` variants to all hardcoded light-mode Tailwind classes across all components:

| Light class | Dark variant |
|---|---|
| `bg-white` | `dark:bg-gray-800` |
| `bg-gray-50` | `dark:bg-gray-900` |
| `bg-gray-100` | `dark:bg-gray-700` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-100` | `dark:border-gray-700` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-800` | `dark:text-gray-200` |
| `text-gray-700` | `dark:text-gray-300` |
| `text-gray-600` | `dark:text-gray-400` |
| `text-gray-500` | `dark:text-gray-400` |
| `shadow-lg` | `dark:shadow-gray-900` (where needed) |

Files to update include: `AppLayout.tsx`, `AuthLayout.tsx`, `UserMenu.tsx`, `NotificationBell.tsx`, `Modal.tsx`, `Input.tsx`, `Button.tsx`, `ConnectionStatus.tsx`, and all board/auth/team feature components.

## Testing

- No unit tests needed for `ThemeProvider` (DOM side-effect only) or `themeStore` (trivial Zustand store)
- Visual verification via dev server: toggle each mode and confirm correct class application

## Out of Scope

- Per-user server-side theme preference storage (client-only localStorage is sufficient)
- Custom color palette / theming beyond standard Tailwind dark variants
