// Rows created before the branch feature shipped have branch_id = null.
// Treat those as belonging to the store's original ("main") branch rather
// than making them vanish from every branch view once filtering is on.
export function matchesBranch(rowBranchId: string | null | undefined, targetBranchId: string, mainBranchId: string | null | undefined): boolean {
	if (rowBranchId) return rowBranchId === targetBranchId
	return !!mainBranchId && targetBranchId === mainBranchId
}
