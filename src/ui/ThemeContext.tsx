import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getSystemTheme(): ResolvedTheme {
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(theme: Theme): ResolvedTheme {
	return theme === 'system' ? getSystemTheme() : theme
}

function applyTheme(resolved: ResolvedTheme) {
	document.documentElement.setAttribute('data-theme', resolved)
}

type ThemeContextValue = {
	theme: Theme
	resolvedTheme: ResolvedTheme
	setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(() => {
		const saved = localStorage.getItem(STORAGE_KEY)
		return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
	})
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme))

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next)
		localStorage.setItem(STORAGE_KEY, next)
	}, [])

	useEffect(() => {
		const resolved = resolveTheme(theme)
		setResolvedTheme(resolved)
		applyTheme(resolved)

		if (theme !== 'system') return
		const mql = window.matchMedia('(prefers-color-scheme: light)')
		const onChange = () => {
			const next = getSystemTheme()
			setResolvedTheme(next)
			applyTheme(next)
		}
		mql.addEventListener('change', onChange)
		return () => mql.removeEventListener('change', onChange)
	}, [theme])

	return (
		<ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}

export function useTheme() {
	const ctx = useContext(ThemeContext)
	if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
	return ctx
}
