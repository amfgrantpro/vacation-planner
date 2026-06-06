/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
             colors: {
                 // ── Base palette ──────────────────────────────────────────
                 'cream':              'oklch(0.985 0.012 85)',
                 'cream-overlay':      'oklch(0.985 0.012 85 / 0.9)',  // cream/90 — photo badge
                 'cream-soft':         'oklch(0.985 0.012 85 / 0.5)',  // cream/50 — table bg
                 'sand':               'oklch(0.93 0.045 85)',
                 'sand-deep':          'oklch(0.82 0.09 80)',
                 'sun':                'oklch(0.84 0.14 78)',
                 'sun-bg':             'oklch(0.84 0.14 78 / 0.2)',
                 'sun-bg-soft':        'oklch(0.84 0.14 78 / 0.15)',
                 'sun-badge':          'oklch(0.84 0.14 78 / 0.25)',   // sun/25 — badge bg
                 'sun-glow':           'oklch(0.84 0.14 78 / 0.3)',    // sun/30 — gradient from
                 'ocean':              'oklch(0.62 0.12 230)',
                 'ocean-bg':           'oklch(0.62 0.12 230 / 0.1)',
                 'ocean-ring':         'oklch(0.62 0.12 230 / 0.2)',   // ocean/20 — select ring
                 'ocean-deep':         'oklch(0.42 0.11 235)',
                 'ocean-deep-bg':      'oklch(0.42 0.11 235 / 0.1)',   // ocean-deep/10 — decided pill
                 'ocean-deep-border':  'oklch(0.42 0.11 235 / 0.15)',  // ocean-deep/15 — button border
                 'ocean-deep-dim':     'oklch(0.42 0.11 235 / 0.9)',   // ocean-deep/90 — button hover
                 'teal':               'oklch(0.66 0.09 200)',
                 'teal-soft':          'oklch(0.93 0.035 200)',
                 'teal-soft-muted':    'oklch(0.93 0.035 200 / 0.6)', // teal-soft/60 — reconsider box
                 'teal-soft-hover':    'oklch(0.93 0.035 200 / 0.8)', // teal-soft/80 — dropdown hover
                 'sage':               'oklch(0.78 0.06 155)',
                 'sage-bg':            'oklch(0.78 0.06 155 / 0.25)',
                 'coral':              'oklch(0.7 0.16 35)',
                 'coral-bg':           'oklch(0.7 0.16 35 / 0.15)',
                 'coral-glow':         'oklch(0.7 0.16 35 / 0.15)',    // coral/15 — gradient via
                 'ink':                'oklch(0.22 0.025 240)',
                 // ── Semantic ──────────────────────────────────────────────
                 'card':               'oklch(1 0 0)',
                 'card-wash':          'oklch(1 0 0 / 0.6)',            // card/60 — empty state
                 'border':             'oklch(0.9 0.018 80)',
                 'muted':              'oklch(0.96 0.012 80)',
                 'muted-soft':         'oklch(0.96 0.012 80 / 0.4)',   // muted/40 — placeholder slots
                 'muted-foreground':   'oklch(0.5 0.025 240)',
                 'background':         'oklch(0.99 0.006 85)',
                 'destructive':        'oklch(0.6 0.2 25)',             // for remove buttons
                 'destructive-bg':     'oklch(0.6 0.2 25 / 0.1)',      // destructive/10 — hover
             },
            boxShadow: {
                'card': 'var(--shadow-card)',
                'soft': 'var(--shadow-soft)',
            },
            fontFamily: {
                'serif':   ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
                'display': ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
                'sans':    ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
            },
            borderRadius: {
                '3xl': '1.5rem',
                '4xl': '2rem',
            },
        },
    },
    plugins: [],
}
