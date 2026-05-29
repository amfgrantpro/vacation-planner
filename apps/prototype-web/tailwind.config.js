/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Travel magazine aesthetic
                'ocean-deep': '#2c5f7e',      // Primary blue
                'ocean-light': '#5b8fb8',     // Secondary blue
                'teal-soft': '#d4e8f0',       // Light teal background
                'cream': '#faf8f3',           // Warm cream background
                'border': '#d9d6d0',          // Neutral border
                'card': '#ffffff',            // Card background
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
            },
            fontFamily: {
                'serif': ['Georgia', 'serif'],
                'sans': ['system-ui', '-apple-system', 'sans-serif'],
            },
        },
    },
    plugins: [],
}

