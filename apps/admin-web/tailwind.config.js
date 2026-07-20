/** @type {import('tailwindcss').Config} */
// Design tokens live as CSS variables in globals.css (Section 5.2) and are
// mapped here so Tailwind utilities speak the same language.
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-deep': 'var(--brand-deep)',
        'brand-fill': 'var(--brand-fill)',
        'brand-tint': 'var(--brand-tint)',
        'brand-tint2': 'var(--brand-tint2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        'muted-2': 'var(--muted-2)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        paper: 'var(--paper)',
        wash: 'var(--wash)',
        'wash-2': 'var(--wash-2)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        info: 'var(--info)',
        'info-soft': 'var(--info-soft)',
        ok: 'var(--ok)',
        'ok-soft': 'var(--ok-soft)',
        lime: 'var(--lime)',
        accent: 'var(--accent)',
      },
      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      fontFamily: {
        sans: 'var(--sans)',
        mono: 'var(--mono)',
        display: 'var(--display)',
        serif: 'var(--serif)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
};
