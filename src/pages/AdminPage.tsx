import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../supabase'
import { auth } from '../firebase'
import { sendPasswordResetEmail } from 'firebase/auth'
import {
  FiPlus, FiTrash2, FiEdit2, FiUsers, FiImage, FiShield,
  FiLogOut, FiUpload, FiCheck, FiX, FiEye, FiEyeOff,
  FiToggleLeft, FiToggleRight, FiSearch, FiHome, FiRefreshCw,
  FiMail, FiSlash, FiUserCheck,
} from 'react-icons/fi'

const MASTER_ADMIN = 'nativeedgestudio.space@gmail.com'
const ADMIN_EMAILS = [MASTER_ADMIN, 'nativeedge.studio@gmail.com']

type Announcement = {
  id: string
  title: string
  content: string
  image_url: string
  link_url: string
  whatsapp_number: string
  expires_at: string | null
  type: 'banner' | 'card' | 'popup'
  bg_color: string
  text_color: string
  is_active: boolean
  created_at: string
}

type UserProfile = {
  id: string
  uid: string
  email: string
  display_name: string
  is_suspended: boolean
  created_at: string
  last_seen: string
  // joined from store_info
  store_name?: string
  phone?: string
  address?: string
  website?: string
  currency?: string
}

type AdminRecord = {
  id: string
  email: string
  added_at: string
}

const emptyAd = {
  title: '', content: '', image_url: '', link_url: '',
  whatsapp_number: '', expires_at: '',
  type: 'popup' as const, bg_color: '#0d1521', text_color: '#ffffff', is_active: true,
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'ads' | 'users' | 'admins'>('ads')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [admins, setAdmins] = useState<AdminRecord[]>([])

  const [showAdForm, setShowAdForm] = useState(false)
  const [editAd, setEditAd] = useState<Announcement | null>(null)
  const [adForm, setAdForm] = useState(emptyAd)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [userSearch, setUserSearch] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [apiUnavailable, setApiUnavailable] = useState(false)

  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? '')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!isAdmin) {
      // check db admins too
      checkDbAdmin()
      return
    }
    loadAll()
  }, [user])

  async function checkDbAdmin() {
    const { data } = await supabase.from('managify_admins').select('email').eq('email', user?.email ?? '')
    if (data && data.length > 0) {
      loadAll()
    } else {
      navigate('/')
    }
  }

  async function getAdminToken() {
    if (!user) throw new Error('Not logged in')
    const { getIdToken } = await import('firebase/auth')
    return getIdToken(user)
  }

  async function callAdminApi(method: string, body?: object) {
    const token = await getAdminToken()
    const res = await fetch('/api/admin-users', {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async function loadAll() {
    setLoading(true)
    setApiUnavailable(false)
    try {
      const [{ data: storeProfiles }, { data: ads }, { data: adminList }] = await Promise.all([
        supabase.from('store_info').select('*').order('store_name'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('managify_admins').select('*').order('added_at', { ascending: false }),
      ])
      setAnnouncements(ads || [])
      setAdmins(adminList || [])

      // Build uid â†’ store_info map
      const storeMap: Record<string, any> = {}
      for (const s of (storeProfiles || [])) storeMap[s.user_id] = s

      // Try to get real Firebase Auth users via the API
      try {
        const firebaseResult = await callAdminApi('GET')
        const merged: UserProfile[] = (firebaseResult.users || []).map((fu: any) => {
          const st = storeMap[fu.uid]
          return {
            id:           fu.uid,
            uid:          fu.uid,
            email:        fu.email,
            display_name: fu.displayName || st?.store_name || '',
            is_suspended: fu.disabled,
            created_at:   fu.createdAt,
            last_seen:    fu.lastSignIn,
            store_name:   st?.store_name || '',
            phone:        st?.phone      || '',
            address:      st?.address    || '',
            website:      st?.website    || '',
            currency:     st?.currency   || 'PKR',
          }
        })
        merged.sort((a, b) => (a.store_name || a.email).localeCompare(b.store_name || b.email))
        setUsers(merged)
      } catch {
        // API not available (local dev with npm run dev) â€” fall back to store_info
        setApiUnavailable(true)
        const fallback: UserProfile[] = (storeProfiles || []).map((s: any) => ({
          id:           s.user_id,
          uid:          s.user_id,
          email:        s.email || 'â€”',
          display_name: s.store_name || '',
          is_suspended: false,
          created_at:   s.created_at || '',
          last_seen:    '',
          store_name:   s.store_name || '',
          phone:        s.phone      || '',
          address:      s.address    || '',
          website:      s.website    || '',
          currency:     s.currency   || 'PKR',
        }))
        setUsers(fallback)
      }
    } catch (e: any) {
      console.error(e)
      showToast('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // â”€â”€ User actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email)
      showToast(`Reset email sent to ${email}`)
    } catch (e: any) {
      showToast(e.message || 'Failed to send reset email')
    }
  }

  async function toggleSuspend(u: UserProfile) {
    const next = !u.is_suspended
    try {
      await callAdminApi('POST', { action: next ? 'disable' : 'enable', uid: u.uid })
      setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, is_suspended: next } : x))
      showToast(next ? `${u.email} suspended` : `${u.email} reinstated`)
    } catch (e: any) {
      showToast('Failed: ' + e.message)
    }
  }

  async function deleteUser(u: UserProfile) {
    if (!confirm(`Permanently delete ${u.email}?\nThis removes their Firebase account and all store data.`)) return
    try {
      await Promise.all([
        callAdminApi('POST', { action: 'delete', uid: u.uid }),
        supabase.from('store_info').delete().eq('user_id', u.uid),
        supabase.from('user_registry').delete().eq('uid', u.uid),
      ])
      setUsers(prev => prev.filter(x => x.uid !== u.uid))
      showToast(`${u.email} deleted`)
    } catch (e: any) {
      showToast('Delete failed: ' + e.message)
    }
  }

  // â”€â”€ Ads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function openNewAd() {
    setEditAd(null)
    setAdForm(emptyAd)
    setShowAdForm(true)
  }

  function openEditAd(ad: Announcement) {
    setEditAd(ad)
    setAdForm({
      title: ad.title, content: ad.content, image_url: ad.image_url,
      link_url: ad.link_url, whatsapp_number: ad.whatsapp_number || '',
      expires_at: ad.expires_at ? ad.expires_at.slice(0, 16) : '',
      type: ad.type || 'popup', bg_color: ad.bg_color,
      text_color: ad.text_color, is_active: ad.is_active,
    })
    setShowAdForm(true)
  }

  async function handleAdImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('ads').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('ads').getPublicUrl(path)
      setAdForm(f => ({ ...f, image_url: publicUrl }))
      showToast('Image uploaded!')
    } catch {
      showToast('Upload failed â€” try a direct URL instead')
    } finally {
      setUploading(false)
    }
  }

  async function saveAd() {
    if (!adForm.title.trim()) { showToast('Title is required'); return }
    setSaving(true)
    try {
      if (editAd) {
        const { error } = await supabase.from('announcements').update(adForm).eq('id', editAd.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('announcements').insert(adForm)
        if (error) throw error
      }
      showToast(editAd ? 'Ad updated!' : 'Ad created!')
      setShowAdForm(false)
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAd(ad: Announcement) {
    await supabase.from('announcements').update({ is_active: !ad.is_active }).eq('id', ad.id)
    loadAll()
  }

  async function deleteAd(id: string) {
    if (!confirm('Delete this advertisement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(a => a.filter(x => x.id !== id))
    showToast('Deleted')
  }

  // â”€â”€ Admins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function addAdmin() {
    if (!newAdminEmail.trim()) return
    const { error } = await supabase.from('managify_admins').insert({ email: newAdminEmail.trim() })
    if (error) { showToast(error.message); return }
    showToast('Admin added!')
    setNewAdminEmail('')
    loadAll()
  }

  async function removeAdmin(id: string, email: string) {
    if (email === MASTER_ADMIN) { showToast('Cannot remove master admin'); return }
    if (!confirm(`Remove ${email} from admins?`)) return
    await supabase.from('managify_admins').delete().eq('id', id)
    setAdmins(a => a.filter(x => x.id !== id))
  }

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.store_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.phone?.includes(userSearch)
  )

  const activeAds = announcements.filter(a => a.is_active).length

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}

      {/* Top nav */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <img src="./logo.png" alt="" width={28} style={{ borderRadius: 7 }} />
          <span style={s.navTitle}>Managify</span>
          <span style={s.adminBadge}>ADMIN</span>
        </div>
        <div style={s.navRight}>
          <Link to="/" style={s.navBtn}><FiHome size={14} /> Dashboard</Link>
          <button style={s.navBtn} onClick={() => loadAll()}><FiRefreshCw size={14} /></button>
          <button style={{ ...s.navBtn, color: '#f87171' }} onClick={() => logout().then(() => navigate('/login'))}>
            <FiLogOut size={14} /> Logout
          </button>
        </div>
      </nav>

      <div style={s.layout}>
        {/* Sidebar tabs */}
        <aside style={s.sidebar}>
          <div style={s.sidebarTitle}>Control Panel</div>
          {([
            { key: 'ads', label: 'Advertisements', icon: <FiImage size={18} />, count: announcements.length },
            { key: 'users', label: 'Users', icon: <FiUsers size={18} />, count: users.length },
            { key: 'admins', label: 'Admins', icon: <FiShield size={18} />, count: admins.length },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}>
              <span style={s.tabIcon}>{t.icon}</span>
              <span style={s.tabLabel}>{t.label}</span>
              <span style={s.tabCount}>{t.count}</span>
            </button>
          ))}

          <div style={s.statCards}>
            <div style={s.statCard}>
              <div style={s.statNum}>{users.length}</div>
              <div style={s.statLbl}>Total Users</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statNum, color: '#4ade80' }}>{activeAds}</div>
              <div style={s.statLbl}>Live Ads</div>
            </div>
            <div style={s.statCard}>
              <div style={{ ...s.statNum, color: '#f59e0b' }}>{admins.length}</div>
              <div style={s.statLbl}>Admins</div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={s.main}>
          {loading ? (
            <div style={s.loader}>Loading...</div>
          ) : (

            <>
              {/* â”€â”€ ADVERTISEMENTS TAB â”€â”€ */}
              {tab === 'ads' && (
                <div>
                  <div style={s.sectionHeader}>
                    <div>
                      <h2 style={s.sectionTitle}>Advertisements</h2>
                      <p style={s.sectionSub}>Manage banners and cards shown across all user dashboards</p>
                    </div>
                    <button style={s.primaryBtn} onClick={openNewAd}>
                      <FiPlus size={16} /> New Ad
                    </button>
                  </div>

                  {announcements.length === 0 ? (
                    <div style={s.emptyState}>
                      <FiImage size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <p>No advertisements yet. Create your first one!</p>
                    </div>
                  ) : (
                    <div style={s.adGrid}>
                      {announcements.map(ad => (
                        <div key={ad.id} style={{ ...s.adCard, borderColor: ad.is_active ? '#2263ff44' : '#1a2333' }}>
                          {ad.image_url && (
                            <div style={{ ...s.adThumb, backgroundImage: `url(${ad.image_url})` }} />
                          )}
                          {!ad.image_url && (
                            <div style={{ ...s.adThumb, background: ad.bg_color || '#0d1521', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FiImage size={24} style={{ opacity: 0.3 }} />
                            </div>
                          )}
                          <div style={s.adCardBody}>
                            <div style={s.adCardTop}>
                              <span style={{ ...s.adType, background: ad.type === 'banner' ? '#2263ff22' : '#7c3aed22', color: ad.type === 'banner' ? '#4d8fff' : '#a78bfa' }}>
                                {ad.type}
                              </span>
                              <span style={{ ...s.adStatus, background: ad.is_active ? '#16a34a22' : '#6b728022', color: ad.is_active ? '#4ade80' : '#9ca3af' }}>
                                {ad.is_active ? 'Live' : 'Hidden'}
                              </span>
                            </div>
                            <div style={s.adTitle}>{ad.title}</div>
                            {ad.content && <div style={s.adContent}>{ad.content}</div>}
                            <div style={s.adActions}>
                              <button style={s.iconBtn} onClick={() => toggleAd(ad)} title={ad.is_active ? 'Hide' : 'Show'}>
                                {ad.is_active ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                              </button>
                              <button style={s.iconBtn} onClick={() => openEditAd(ad)} title="Edit">
                                <FiEdit2 size={15} />
                              </button>
                              <button style={{ ...s.iconBtn, color: '#f87171' }} onClick={() => deleteAd(ad.id)} title="Delete">
                                <FiTrash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* â”€â”€ USERS TAB â”€â”€ */}
              {tab === 'users' && (
                <div>
                  <div style={s.sectionHeader}>
                    <div>
                      <h2 style={s.sectionTitle}>Registered Users</h2>
                      <p style={s.sectionSub}>{users.length} {apiUnavailable ? 'store profiles (fallback)' : 'accounts from Firebase Auth'}</p>
                    </div>
                  </div>

                  {apiUnavailable && (
                    <div style={s.warnBox}>
                      <strong>âš  Running in fallback mode</strong> â€” Firebase Auth users require the API endpoint.<br />
                      <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                        For full user management on localhost, run{' '}
                        <code style={s.code}>npm install -g vercel</code> then{' '}
                        <code style={s.code}>vercel dev</code> instead of <code style={s.code}>npm run dev</code>.
                        Suspend / Delete / Reset will not work in fallback mode.
                      </span>
                    </div>
                  )}

                  <div style={s.searchRow}>
                    <FiSearch size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                    <input
                      style={s.searchInput}
                      placeholder="Search by email, store name or phone..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredUsers.length === 0 && (
                      <div style={s.emptyState}>
                        <FiUsers size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p>No users yet. They appear here after first login.</p>
                      </div>
                    )}
                    {filteredUsers.map(u => (
                      <div key={u.id} style={{ ...s.userCard, borderColor: u.is_suspended ? '#7f1d1d44' : '#1a2333' }}>
                        <div style={s.userAvatar}>
                          {(u.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={s.userEmail}>{u.email}</span>
                            {u.is_suspended && (
                              <span style={s.suspendedBadge}>Suspended</span>
                            )}
                            {!u.is_suspended && (
                              <span style={s.activeBadge}>Active</span>
                            )}
                            {ADMIN_EMAILS.includes(u.email) && (
                              <span style={s.masterBadge}>Admin</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 20, marginTop: 5, flexWrap: 'wrap' }}>
                            {u.store_name && <span style={s.userMeta}>ðŸª {u.store_name}</span>}
                            {u.phone && <span style={s.userMeta}>ðŸ“ž {u.phone}</span>}
                            {u.website && <span style={s.userMeta}>ðŸŒ {u.website}</span>}
                            <span style={{ ...s.userMeta, color: '#374151' }}>
                              Last seen: {u.last_seen ? new Date(u.last_seen).toLocaleDateString() : 'â€”'}
                            </span>
                            <span style={{ ...s.userMeta, color: '#374151' }}>
                              Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'â€”'}
                            </span>
                          </div>
                        </div>
                        <div style={s.userActions}>
                          <button style={s.actionBtn} title="Send password reset email"
                            onClick={() => resetPassword(u.email)}>
                            <FiMail size={14} />
                            <span>Reset Password</span>
                          </button>
                          <button
                            style={{ ...s.actionBtn, ...(u.is_suspended ? s.actionBtnGreen : s.actionBtnAmber), ...(apiUnavailable ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                            title={apiUnavailable ? 'Requires vercel dev' : u.is_suspended ? 'Reinstate user' : 'Suspend user'}
                            onClick={() => !apiUnavailable && toggleSuspend(u)}>
                            {u.is_suspended ? <FiUserCheck size={14} /> : <FiSlash size={14} />}
                            <span>{u.is_suspended ? 'Reinstate' : 'Suspend'}</span>
                          </button>
                          <button
                            style={{ ...s.actionBtn, ...s.actionBtnRed, ...(apiUnavailable ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                            title={apiUnavailable ? 'Requires vercel dev' : 'Delete user'}
                            onClick={() => !apiUnavailable && deleteUser(u)}>
                            <FiTrash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* â”€â”€ ADMINS TAB â”€â”€ */}
              {tab === 'admins' && (
                <div>
                  <div style={s.sectionHeader}>
                    <div>
                      <h2 style={s.sectionTitle}>Admin Access</h2>
                      <p style={s.sectionSub}>Control who can access this admin portal</p>
                    </div>
                  </div>

                  <div style={s.addAdminRow}>
                    <input
                      style={s.addAdminInput}
                      placeholder="Enter email address..."
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addAdmin()}
                    />
                    <button style={s.primaryBtn} onClick={addAdmin}>
                      <FiPlus size={15} /> Add Admin
                    </button>
                  </div>

                  <div style={s.adminList}>
                    {admins.map(a => (
                      <div key={a.id} style={s.adminRow}>
                        <div style={s.adminAvatar}>
                          {(a.email[0] || '?').toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={s.adminEmail}>{a.email}</div>
                          <div style={s.adminDate}>Added {new Date(a.added_at).toLocaleDateString()}</div>
                        </div>
                        {a.email === MASTER_ADMIN ? (
                          <span style={s.masterBadge}>Master Admin</span>
                        ) : (
                          <button style={{ ...s.iconBtn, color: '#f87171' }} onClick={() => removeAdmin(a.id, a.email)}>
                            <FiTrash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    {admins.length === 0 && (
                      <div style={s.emptyState}>No admins configured yet.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* â”€â”€ Ad Form Modal â”€â”€ */}
      {showAdForm && (
        <div style={s.overlay} onClick={() => setShowAdForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{editAd ? 'Edit Advertisement' : 'New Advertisement'}</h3>
              <button style={s.closeBtn} onClick={() => setShowAdForm(false)}><FiX size={18} /></button>
            </div>

             <div style={s.modalBody}>

               {/* Square image upload */}
               <div style={{ marginBottom: 20 }}>
                 <label style={{ ...s.label, marginBottom: 8, display: 'block' }}>
                   Ad Image <span style={{ color: '#4a5568', fontWeight: 400 }}>(recommended 1080 x 1080 px)</span>
                 </label>
                 <div
                   style={{
                     width: '100%', aspectRatio: '1 / 1', maxHeight: 300,
                     background: '#0a111a',
                     border: adForm.image_url ? '2px solid #2263ff44' : '2px dashed #1a2333',
                     borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                     position: 'relative',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                   }}
                   onClick={() => fileRef.current?.click()}
                 >
                   {adForm.image_url ? (
                     <img src={adForm.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                       onError={e => { e.currentTarget.style.display = 'none' }} />
                   ) : (
                     <div style={{ textAlign: 'center', color: '#4a5568', pointerEvents: 'none' }}>
                       <FiUpload size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
                       <div style={{ fontSize: 13, fontWeight: 600 }}>Click to upload image</div>
                       <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>PNG, JPG, WEBP - 1080 x 1080 px</div>
                     </div>
                   )}
                   {uploading && (
                     <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                       Uploading...
                     </div>
                   )}
                 </div>
                 <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleAdImageUpload} />
                 <input style={{ ...s.input, marginTop: 8 }} placeholder="Or paste image URL directly..."
                   value={adForm.image_url} onChange={e => setAdForm(f => ({ ...f, image_url: e.target.value }))} />
                 {adForm.image_url && (
                   <button style={{ ...s.uploadBtn, marginTop: 6, color: '#f87171', borderColor: '#f8717144' }}
                     onClick={() => setAdForm(f => ({ ...f, image_url: '' }))}>
                     <FiX size={13} /> Remove
                   </button>
                 )}
               </div>

               <div style={s.formGrid}>
                 <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
                   <label style={s.label}>Title</label>
                   <input style={s.input} placeholder="Ad headline..." value={adForm.title}
                     onChange={e => setAdForm(f => ({ ...f, title: e.target.value }))} />
                 </div>

                 <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
                   <label style={s.label}>Description</label>
                   <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }} placeholder="Short description or offer..."
                     value={adForm.content} onChange={e => setAdForm(f => ({ ...f, content: e.target.value }))} />
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>Website Link</label>
                   <input style={s.input} placeholder="https://yoursite.com" value={adForm.link_url}
                     onChange={e => setAdForm(f => ({ ...f, link_url: e.target.value }))} />
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>WhatsApp Number</label>
                   <input style={s.input} placeholder="+923001234567" value={adForm.whatsapp_number}
                     onChange={e => setAdForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>Expiry Date &amp; Time</label>
                   <input type="datetime-local" style={s.input} value={adForm.expires_at}
                     onChange={e => setAdForm(f => ({ ...f, expires_at: e.target.value }))} />
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>Status</label>
                   <button style={{ ...s.toggleBtn, background: adForm.is_active ? '#16a34a33' : '#6b728022', color: adForm.is_active ? '#4ade80' : '#9ca3af' }}
                     onClick={() => setAdForm(f => ({ ...f, is_active: !f.is_active }))}>
                     {adForm.is_active ? <><FiToggleRight size={16} /> Live</> : <><FiToggleLeft size={16} /> Hidden</>}
                   </button>
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>Background Color</label>
                   <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                     <input type="color" value={adForm.bg_color}
                       onChange={e => setAdForm(f => ({ ...f, bg_color: e.target.value }))}
                       style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                     <input style={{ ...s.input, flex: 1 }} value={adForm.bg_color}
                       onChange={e => setAdForm(f => ({ ...f, bg_color: e.target.value }))} />
                   </div>
                 </div>

                 <div style={s.formGroup}>
                   <label style={s.label}>Text Color</label>
                   <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                     <input type="color" value={adForm.text_color}
                       onChange={e => setAdForm(f => ({ ...f, text_color: e.target.value }))}
                       style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                     <input style={{ ...s.input, flex: 1 }} value={adForm.text_color}
                       onChange={e => setAdForm(f => ({ ...f, text_color: e.target.value }))} />
                   </div>
                 </div>
               </div>
             </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setShowAdForm(false)}>Cancel</button>
              <button style={s.primaryBtn} onClick={saveAd} disabled={saving}>
                {saving ? 'Savingâ€¦' : <><FiCheck size={15} /> {editAd ? 'Save Changes' : 'Create Ad'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#060a10',
    color: '#c9d5e0',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  },

  toast: {
    position: 'fixed', top: 20, right: 20, zIndex: 9999,
    background: '#1a2940', border: '1px solid #2263ff66',
    color: '#e2e8f0', padding: '10px 18px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    animation: 'fadeIn 0.2s ease',
  },

  nav: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(6,10,16,0.95)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #1a2333',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', height: 60,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  navTitle: { fontSize: 17, fontWeight: 700, color: '#e8eef5' },
  adminBadge: {
    fontSize: 10, fontWeight: 800, color: '#2263ff',
    background: '#2263ff18', border: '1px solid #2263ff44',
    borderRadius: 5, padding: '2px 7px', letterSpacing: '0.8px',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 8 },
  navBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 8, border: '1px solid #1a2333',
    background: 'transparent', color: '#8b949e', fontSize: 13, cursor: 'pointer',
    textDecoration: 'none', fontFamily: 'inherit',
  },

  layout: { display: 'flex', minHeight: 'calc(100vh - 60px)' },

  sidebar: {
    width: 220, flexShrink: 0,
    background: '#080d14', borderRight: '1px solid #1a2333',
    padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  sidebarTitle: {
    fontSize: 10, fontWeight: 700, color: '#4a5568',
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: 12, paddingLeft: 8,
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10, border: 'none',
    background: 'transparent', color: '#6b7280', cursor: 'pointer',
    width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: 14,
    transition: 'all 0.15s',
  },
  tabBtnActive: {
    background: 'rgba(34,99,255,0.12)',
    color: '#4d8fff',
    border: '1px solid rgba(34,99,255,0.2)',
  },
  tabIcon: { flexShrink: 0 },
  tabLabel: { flex: 1 },
  tabCount: {
    fontSize: 11, fontWeight: 700, color: '#4a5568',
    background: '#1a2333', borderRadius: 20, padding: '1px 7px',
  },
  statCards: { marginTop: 'auto', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 8 },
  statCard: {
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 10, padding: '12px 16px',
  },
  statNum: { fontSize: 24, fontWeight: 800, color: '#4d8fff', lineHeight: 1 },
  statLbl: { fontSize: 11, color: '#4a5568', marginTop: 4 },

  main: { flex: 1, padding: '32px 36px', maxWidth: 1100 },
  loader: { textAlign: 'center', padding: 80, color: '#4a5568' },

  sectionHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 28, gap: 16,
  },
  sectionTitle: { fontSize: 22, fontWeight: 700, color: '#e8eef5', margin: 0, letterSpacing: '-0.5px' },
  sectionSub: { fontSize: 13, color: '#4a5568', margin: '6px 0 0' },

  emptyState: {
    textAlign: 'center', padding: '60px 20px', color: '#4a5568',
    background: '#080d14', borderRadius: 16, border: '1px dashed #1a2333',
  },

  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, #2263ff, #1a4fd4)',
    color: 'white', border: 'none', borderRadius: 10,
    padding: '10px 20px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,99,255,0.3)',
    fontFamily: 'inherit', flexShrink: 0,
  },

  adGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
  },
  adCard: {
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s',
  },
  adThumb: {
    height: 130, backgroundSize: 'cover', backgroundPosition: 'center',
    background: '#0a111a',
  },
  adCardBody: { padding: '14px 16px' },
  adCardTop: { display: 'flex', gap: 8, marginBottom: 10 },
  adType: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px',
    borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  adStatus: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  adTitle: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 },
  adContent: {
    fontSize: 12, color: '#6b7280', lineHeight: 1.5,
    overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  adActions: {
    display: 'flex', gap: 6, marginTop: 14,
    borderTop: '1px solid #1a2333', paddingTop: 12,
  },
  iconBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, border: '1px solid #1a2333',
    background: '#0a111a', color: '#8b949e', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },

  searchRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 10, padding: '0 14px', marginBottom: 20,
  },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#e2e8f0', fontSize: 14, padding: '12px 0', fontFamily: 'inherit',
  },

  tableWrap: { borderRadius: 14, border: '1px solid #1a2333', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.6px',
    background: '#080d14', borderBottom: '1px solid #1a2333',
  },
  td: {
    padding: '12px 16px', fontSize: 13, color: '#8b949e',
    borderBottom: '1px solid #0f1825',
  },
  tr: { transition: 'background 0.1s' },
  currencyBadge: {
    fontSize: 11, fontWeight: 700, color: '#4d8fff',
    background: '#2263ff18', padding: '2px 8px', borderRadius: 20,
  },

  addAdminRow: {
    display: 'flex', gap: 12, marginBottom: 24,
  },
  addAdminInput: {
    flex: 1, background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 10, color: '#e2e8f0', fontSize: 14,
    padding: '10px 14px', outline: 'none', fontFamily: 'inherit',
  },
  warnBox: {
    background: '#451a0322', border: '1px solid #f59e0b55',
    borderRadius: 12, padding: '14px 18px', marginBottom: 20,
    fontSize: 13, color: '#fbbf24', lineHeight: 1.6,
  },
  code: {
    background: '#0a111a', border: '1px solid #1a2333',
    borderRadius: 5, padding: '1px 6px', fontFamily: 'monospace',
    fontSize: 12, color: '#e2e8f0',
  },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 14, padding: '16px 20px', transition: 'border-color 0.2s',
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: 'rgba(34,99,255,0.15)', border: '1px solid rgba(34,99,255,0.25)',
    color: '#4d8fff', fontWeight: 700, fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  userEmail: { fontSize: 14, fontWeight: 600, color: '#e2e8f0' },
  userMeta: { fontSize: 12, color: '#6b7280' },
  userActions: { display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8, border: '1px solid #1a2333',
    background: '#0a111a', color: '#8b949e', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  },
  actionBtnAmber: { borderColor: '#f59e0b44', color: '#f59e0b', background: '#f59e0b11' },
  actionBtnGreen: { borderColor: '#4ade8044', color: '#4ade80', background: '#4ade8011' },
  actionBtnRed: { borderColor: '#f8717144', color: '#f87171', background: '#f8717111' },
  activeBadge: {
    fontSize: 10, fontWeight: 700, color: '#4ade80',
    background: '#16a34a22', border: '1px solid #4ade8033',
    padding: '2px 8px', borderRadius: 20,
  },
  suspendedBadge: {
    fontSize: 10, fontWeight: 700, color: '#f87171',
    background: '#ef444422', border: '1px solid #f8717133',
    padding: '2px 8px', borderRadius: 20,
  },

  adminList: { display: 'flex', flexDirection: 'column', gap: 8 },
  adminRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 12, padding: '14px 18px',
  },
  adminAvatar: {
    width: 40, height: 40, borderRadius: 12,
    background: 'rgba(34,99,255,0.15)', border: '1px solid rgba(34,99,255,0.25)',
    color: '#4d8fff', fontWeight: 700, fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  adminEmail: { fontSize: 14, fontWeight: 600, color: '#e2e8f0' },
  adminDate: { fontSize: 12, color: '#4a5568', marginTop: 2 },
  masterBadge: {
    fontSize: 10, fontWeight: 800, color: '#f59e0b',
    background: '#f59e0b18', border: '1px solid #f59e0b44',
    padding: '3px 10px', borderRadius: 20, letterSpacing: '0.5px',
  },

  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    background: '#0d1521', border: '1px solid #1a2333',
    borderRadius: 18, width: '100%', maxWidth: 620,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #1a2333',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#e8eef5', margin: 0 },
  closeBtn: {
    background: '#0a111a', border: '1px solid #1a2333', borderRadius: 8,
    color: '#6b7280', cursor: 'pointer', padding: 6, display: 'flex', fontFamily: 'inherit',
  },
  modalBody: { flex: 1, overflow: 'auto', padding: 24 },
  modalFooter: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    padding: '16px 24px', borderTop: '1px solid #1a2333',
  },

  adPreview: {
    borderRadius: 12, padding: '16px 20px', marginBottom: 20,
    display: 'flex', alignItems: 'center', gap: 16,
    minHeight: 72, border: '1px solid rgba(255,255,255,0.05)',
  },
  previewImg: {
    height: 50, width: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0,
  },
  previewText: { flex: 1 },

  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.3px' },
  input: {
    background: '#0a111a', border: '1px solid #1a2333', borderRadius: 10,
    color: '#e2e8f0', fontSize: 14, padding: '10px 14px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
  },
  uploadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#0a111a', border: '1px solid #1a2333', borderRadius: 10,
    color: '#8b949e', fontSize: 13, padding: '10px 14px',
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  toggleBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: 10, padding: '10px 16px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelBtn: {
    background: '#0a111a', border: '1px solid #1a2333', borderRadius: 10,
    color: '#8b949e', fontSize: 14, padding: '10px 20px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
}
