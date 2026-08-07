import admin from 'firebase-admin'

const ADMIN_EMAILS = ['nativeedgestudio.space@gmail.com', 'nativeedge.studio@gmail.com']

function initAdmin() {
  if (admin.apps.length) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set')
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
}

async function verifyAdmin(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) throw new Error('Missing token')
  const token = await admin.auth().verifyIdToken(header.slice(7))
  if (!ADMIN_EMAILS.includes(token.email)) throw new Error('Forbidden')
  return token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    initAdmin()
    await verifyAdmin(req)

    // ── GET: list all Firebase Auth users ────────────────────────────────────
    if (req.method === 'GET') {
      const users = []
      let pageToken
      do {
        const result = await admin.auth().listUsers(1000, pageToken)
        for (const u of result.users) {
          users.push({
            uid:           u.uid,
            email:         u.email || '',
            displayName:   u.displayName || '',
            disabled:      u.disabled,
            emailVerified: u.emailVerified,
            photoURL:      u.photoURL || '',
            createdAt:     u.metadata.creationTime,
            lastSignIn:    u.metadata.lastSignInTime,
          })
        }
        pageToken = result.pageToken
      } while (pageToken)

      return res.status(200).json({ users })
    }

    // ── POST: perform an action on a user ────────────────────────────────────
    if (req.method === 'POST') {
      const { action, uid } = req.body || {}
      if (!uid) return res.status(400).json({ error: 'uid required' })

      if (action === 'disable') {
        await admin.auth().updateUser(uid, { disabled: true })
        return res.status(200).json({ ok: true })
      }
      if (action === 'enable') {
        await admin.auth().updateUser(uid, { disabled: false })
        return res.status(200).json({ ok: true })
      }
      if (action === 'delete') {
        await admin.auth().deleteUser(uid)
        return res.status(200).json({ ok: true })
      }
      if (action === 'reset') {
        // Returns the reset link; email is sent client-side via sendPasswordResetEmail
        const link = await admin.auth().generatePasswordResetLink(req.body.email || '')
        return res.status(200).json({ ok: true, link })
      }

      return res.status(400).json({ error: 'Unknown action' })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('admin-users error:', err)
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
}
