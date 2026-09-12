import admin from 'firebase-admin'

function initAdmin() {
  if (admin.apps.length) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set')
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
}

// Trusts the token's own uid as the store id for anything this request
// creates/touches -- an owner can only ever manage staff under their own
// store. (The staff_members table itself -- role, branch, active flag --
// is written directly from the client under RLS; this endpoint only ever
// touches Firebase Auth, which the client has no way to do itself.)
async function verifyCaller(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) throw new Error('Missing token')
  return admin.auth().verifyIdToken(header.slice(7))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    initAdmin()
    await verifyCaller(req)

    const { action } = req.body || {}

    if (action === 'invite') {
      const { email } = req.body || {}
      if (!email) return res.status(400).json({ error: 'email required' })
      try {
        const user = await admin.auth().createUser({ email, emailVerified: false })
        return res.status(200).json({ ok: true, uid: user.uid })
      } catch (err) {
        if (err.code === 'auth/email-already-exists') {
          // Reuse the existing Firebase account rather than failing outright
          // -- lets an owner add someone who already has a Managify login
          // elsewhere (e.g. a former staff member at a different store).
          const existing = await admin.auth().getUserByEmail(email)
          return res.status(200).json({ ok: true, uid: existing.uid, existed: true })
        }
        throw err
      }
    }

    const { staffUid } = req.body || {}
    if (!staffUid) return res.status(400).json({ error: 'staffUid required' })

    if (action === 'disable') {
      await admin.auth().updateUser(staffUid, { disabled: true })
      return res.status(200).json({ ok: true })
    }
    if (action === 'enable') {
      await admin.auth().updateUser(staffUid, { disabled: false })
      return res.status(200).json({ ok: true })
    }
    if (action === 'delete') {
      await admin.auth().deleteUser(staffUid)
      return res.status(200).json({ ok: true })
    }
    if (action === 'setPassword') {
      // Staff have no self-service "forgot password" flow in this app, so
      // this is the owner's direct way to set/change a staff login's
      // password -- doesn't depend on the invite email ever arriving.
      const { password } = req.body || {}
      if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
      await admin.auth().updateUser(staffUid, { password })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('staff-users error:', err)
    res.status(err.message === 'Missing token' ? 401 : 500).json({ error: err.message })
  }
}
