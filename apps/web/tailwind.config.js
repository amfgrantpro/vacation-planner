/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // All mapped to CSS custom properties for single-source-of-truth
                'cream':       'var(--cream)',
                'sand':        'var(--sand)',
                'sand-deep':   'var(--sand-deep)',
                'sun':         'var(--sun)',
                'ocean':       'var(--ocean)',
                'ocean-deep':  'var(--ocean-deep)',
                'teal':        'var(--teal)',
                'teal-soft':   'var(--teal-soft)',
                'sage':        'var(--sage)',
                'coral':       'var(--coral)',
                'ink':         'var(--ink)',
                'card':        'var(--card)',
                'border':      'var(--border)',
                'muted':       'var(--muted)',
                'background':  'var(--background)',
            },
            boxShadow: {
                'card': 'var(--shadow-card)',
                'soft': 'var(--shadow-soft)',
            },
            fontFamily: {
                'serif':   ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
                'display': ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
                'sans':    ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
            },
            borderRadius: {
                '3xl': '1.5rem',
                '4xl': '2rem',
            },
        },
    },
    plugins: [],
}
