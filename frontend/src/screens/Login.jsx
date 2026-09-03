import { useEffect, useState } from 'react'
import { loginUser, registerUser } from '../api'
import { MY_ACCOUNT } from '../myAccount'
import { AppIcon } from '../components/AppIcon'

export default function Login({ apiOk, online, preferredRol = 'productor', onSuccess, onBack }) {
  const account = preferredRol === 'empresa' ? MY_ACCOUNT.empresa : MY_ACCOUNT.productor
  const [email, setEmail] = useState(account.email)
  const [password, setPassword] = useState(MY_ACCOUNT.password)
  const [mode, setMode] = useState('login')
  const [rol, setRol] = useState(preferredRol === 'empresa' ? 'empresa' : 'productor')
  const [nombre, setNombre] = useState(account.nombre)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const next = preferredRol === 'empresa' ? MY_ACCOUNT.empresa : MY_ACCOUNT.productor
    setRol(next.rol)
    setEmail(next.email)
    setPassword(MY_ACCOUNT.password)
    setNombre(next.nombre)
  }, [preferredRol])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const auth = mode === 'login'
        ? await loginUser({ email, password })
        : await registerUser({ email, password, rol, nombre: nombre || undefined })
      onSuccess(auth)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const portalLabel = rol === 'empresa' ? 'Dashboard Empresa' : 'Portal Agricultor'

  return (
    <div className="app-shell login-shell light-login">
      <header className="header">
        <button type="button" className="link-back" onClick={onBack}>← Inicio</button>
        <h1 className="login-brand">
          <AppIcon name="logo" alt="" className="login-logo" />
          PencoLab
        </h1>
        <p>Acceso a {portalLabel}</p>
        <div className="status-bar">
          <span className={`badge ${online ? 'online' : 'offline'}`}>{online ? '● Online' : '● Offline'}</span>
          <span className={`badge ${apiOk ? 'online' : 'offline'}`}>API {apiOk ? 'OK' : 'Local'}</span>
          <span className="badge pending">{rol}</span>
        </div>
      </header>
      <main className="content">
        <form className="card" onSubmit={submit}>
          <h3>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
          <p style={{ marginBottom: 14 }}>
            El JWT redirige automáticamente según el rol. Este acceso está preparado para <strong>{portalLabel}</strong>.
          </p>
          {error && <div className="alert warn">{error}</div>}
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>Nombre</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select value={rol} onChange={(e) => setRol(e.target.value)}>
                  <option value="productor">Agricultor / productor</option>
                  <option value="empresa">Empresa Pencos del Norte</option>
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Validando...' : mode === 'login' ? 'Entrar' : 'Registrarme y entrar'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
          </button>
        </form>
      </main>
    </div>
  )
}
