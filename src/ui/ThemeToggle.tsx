import { useTheme, Theme } from './ThemeContext'

const OPTIONS: { value: Theme; title: string; icon: JSX.Element }[] = [
	{
		value: 'light',
		title: 'Light theme',
		icon: (
			<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
			</svg>
		),
	},
	{
		value: 'system',
		title: 'Match system theme',
		icon: (
			<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="4" width="18" height="12" rx="2" />
				<path d="M8 20h8M12 16v4" />
			</svg>
		),
	},
	{
		value: 'dark',
		title: 'Dark theme',
		icon: (
			<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
				<path d="M12.1 2c-5.5.3-9.6 5-9.3 10.5.3 5.5 5 9.6 10.5 9.3 3.6-.2 6.6-2.3 8.2-5.3-6.1 1-11.5-3.7-11.7-9.9-.1-1.7.2-3.3.9-4.7-.4.4-.9.8-1.6 0z" />
			</svg>
		),
	},
]

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme()

	return (
		<div
			role="radiogroup"
			aria-label="Theme"
			style={{
				display: 'flex',
				alignItems: 'center',
				background: 'var(--bg-sunken)',
				border: '1px solid var(--border)',
				borderRadius: '8px',
				padding: '2px',
				gap: '2px',
				flexShrink: 0,
			}}
		>
			{OPTIONS.map(opt => {
				const active = theme === opt.value
				return (
					<button
						key={opt.value}
						type="button"
						role="radio"
						aria-checked={active}
						title={opt.title}
						onClick={() => setTheme(opt.value)}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '26px',
							height: '26px',
							minWidth: 0,
							minHeight: 0,
							padding: 0,
							borderRadius: '6px',
							border: 'none',
							cursor: 'pointer',
							background: active ? 'var(--accent)' : 'transparent',
							color: active ? 'var(--accent-contrast)' : 'var(--text-muted)',
							transition: 'background 0.15s, color 0.15s',
						}}
					>
						{opt.icon}
					</button>
				)
			})}
		</div>
	)
}
