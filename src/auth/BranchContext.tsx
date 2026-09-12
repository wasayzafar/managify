// src/auth/BranchContext.tsx
//
// Resolves "which store does this logged-in person act as, and which branch
// are they scoped to" — the owner's Firebase UID *is* the store id (see
// storage.ts's getUserId()); a staff account is a separate Firebase user
// mapped to a store + branch + role via the staff_members table.
//
// getUserId() in storage.ts needs this synchronously, so the resolved store
// id is also mirrored into a module-level variable (same pattern already
// used for the cached currency in utils/currency.ts) — falls back to the
// caller's own uid until resolution finishes, which ProtectedRoute waits on
// before rendering any page.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../supabase'

export type BranchRole = 'owner' | 'manager' | 'staff'

export type Branch = {
	id: string
	name: string
	address: string | null
	phone: string | null
	isActive: boolean
}

interface BranchContextType {
	loading: boolean
	storeId: string | null
	role: BranchRole
	/** Fixed assigned branch for staff/manager; null for an owner (sees all branches). */
	myBranchId: string | null
	branches: Branch[]
	/** The store's original/default branch — legacy rows with no branch_id belong here. */
	mainBranchId: string | null
	/** What's currently being viewed — a specific branch id, or 'all' for the owner's consolidated view. */
	currentBranchId: string | 'all' | null
	setCurrentBranchId: (id: string | 'all') => void
	refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextType | null>(null)

const CURRENT_BRANCH_KEY = 'currentBranchId'

let cachedStoreId: string | null = null
export function getCachedStoreId(): string | null {
	return cachedStoreId
}

function mapBranch(b: any): Branch {
	return { id: b.id, name: b.name, address: b.address, phone: b.phone, isActive: b.is_active }
}

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { user, loading: authLoading } = useAuth()
	const [loading, setLoading] = useState(true)
	const [storeId, setStoreId] = useState<string | null>(null)
	const [role, setRole] = useState<BranchRole>('owner')
	const [myBranchId, setMyBranchId] = useState<string | null>(null)
	const [branches, setBranches] = useState<Branch[]>([])
	const [currentBranchId, setCurrentBranchIdState] = useState<string | 'all' | null>(null)

	const loadBranches = useCallback(async (resolvedStoreId: string): Promise<Branch[]> => {
		const { data, error } = await supabase
			.from('branches')
			.select('*')
			.eq('store_id', resolvedStoreId)
			.order('created_at', { ascending: true })
		if (error) { console.error('Error loading branches:', error); return [] }
		return (data || []).map(mapBranch)
	}, [])

	// First time a store is seen with the branch feature, create a default
	// branch (seeded from its existing store_info) so nothing changes for
	// existing single-location stores — they just get one implicit branch.
	const ensureMainBranch = useCallback(async (resolvedStoreId: string): Promise<Branch[]> => {
		const existing = await loadBranches(resolvedStoreId)
		if (existing.length > 0) return existing
		const { data: info } = await supabase.from('store_info').select('address, phone').eq('user_id', resolvedStoreId).maybeSingle()
		const { data: created, error } = await supabase
			.from('branches')
			.insert({ store_id: resolvedStoreId, name: 'Main Branch', address: info?.address || null, phone: info?.phone || null })
			.select()
			.single()
		if (error || !created) { console.error('Error creating default branch:', error); return [] }
		return [mapBranch(created)]
	}, [loadBranches])

	const resolve = useCallback(async () => {
		if (!user) {
			cachedStoreId = null
			setLoading(false)
			setStoreId(null)
			setRole('owner')
			setMyBranchId(null)
			setBranches([])
			setCurrentBranchIdState(null)
			return
		}
		setLoading(true)
		try {
			const { data: staffRow } = await supabase
				.from('staff_members')
				.select('store_id, branch_id, role, is_active')
				.eq('staff_uid', user.uid)
				.maybeSingle()

			const isActiveStaff = !!staffRow && staffRow.is_active !== false
			const resolvedStoreId: string = isActiveStaff ? staffRow!.store_id : user.uid
			const resolvedRole: BranchRole = isActiveStaff ? ((staffRow!.role as BranchRole) || 'staff') : 'owner'
			const resolvedMyBranchId: string | null = isActiveStaff ? staffRow!.branch_id : null

			const list = await ensureMainBranch(resolvedStoreId)

			cachedStoreId = resolvedStoreId
			setStoreId(resolvedStoreId)
			setRole(resolvedRole)
			setMyBranchId(resolvedMyBranchId)
			setBranches(list)

			if (resolvedMyBranchId) {
				// Staff/managers are pinned to their assigned branch — no switching.
				setCurrentBranchIdState(resolvedMyBranchId)
			} else {
				const saved = localStorage.getItem(CURRENT_BRANCH_KEY)
				const validSaved = saved && (saved === 'all' || list.some(b => b.id === saved)) ? saved : 'all'
				setCurrentBranchIdState(validSaved as string | 'all')
			}
		} catch (err) {
			console.error('Error resolving branch context:', err)
			// Fall back to "owner of your own uid" rather than leaving the app
			// stuck — matches today's behavior for anyone not yet in staff_members.
			cachedStoreId = user.uid
			setStoreId(user.uid)
			setRole('owner')
			setMyBranchId(null)
			setBranches([])
			setCurrentBranchIdState('all')
		} finally {
			setLoading(false)
		}
	}, [user, ensureMainBranch])

	useEffect(() => {
		if (authLoading) return
		resolve()
	}, [authLoading, user, resolve])

	const setCurrentBranchId = (id: string | 'all') => {
		if (myBranchId) return // staff/managers can't switch away from their branch
		setCurrentBranchIdState(id)
		localStorage.setItem(CURRENT_BRANCH_KEY, id)
	}

	const refreshBranches = useCallback(async () => {
		if (!storeId) return
		setBranches(await loadBranches(storeId))
	}, [storeId, loadBranches])

	if (loading) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontFamily: 'system-ui' }}>
				Loading…
			</div>
		)
	}

	const mainBranchId = branches[0]?.id ?? null

	return (
		<BranchContext.Provider value={{ loading, storeId, role, myBranchId, branches, mainBranchId, currentBranchId, setCurrentBranchId, refreshBranches }}>
			{children}
		</BranchContext.Provider>
	)
}

export const useBranch = () => {
	const ctx = useContext(BranchContext)
	if (!ctx) throw new Error('useBranch must be used inside BranchProvider')
	return ctx
}
