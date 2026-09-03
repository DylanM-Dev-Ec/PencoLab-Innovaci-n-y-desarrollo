import { useCallback, useEffect, useState } from 'react'
import { checkHealth, loginUser } from './api'
import { applySession, loadStore, resetStore, saveStore } from './store'
import { currentPath, navigate, tokenRol } from './routing'
import { MY_ACCOUNT } from './myAccount'
import { buildProductorDemoSeed } from './demoSeed'
import RootHub from './screens/RootHub'
import Login from './screens/Login'
import ProductorApp from './screens/ProductorApp'
import EmpresaApp from './screens/EmpresaApp'

function homeFor(rol) {
  return rol === 'empresa' ? '/empresa' : '/productor'
}

function preferredPortalFromQuery() {
  const raw = window.location.hash.replace(/^#/, '')
  const query = raw.includes('?') ? raw.split('?')[1] : ''
  return new URLSearchParams(query).get('portal')
}

function enforceRoute(rol, token) {
  const path = currentPath()

  if (path === '/' || path === '') return

  if (!token) {
    if (!path.startsWith('/login')) navigate('/login')
    return
  }

  if (path.startsWith('/login')) {
    navigate(homeFor(rol))
    return
  }

  if (rol === 'productor' && path.startsWith('/empresa')) {
    navigate('/productor')
    return
  }
  if (rol === 'empresa' && path.startsWith('/productor')) {
    navigate('/empresa')
  }
}

export default function App() {
  const [data, setData] = useState(loadStore)
  const [path, setPath] = useState(currentPath)
  const [online, setOnline] = useState(navigator.onLine)
  const [apiOk, setApiOk] = useState(false)
  const [loginPortal, setLoginPortal] = useState(preferredPortalFromQuery)

  const persist = useCallback((next) => {
    setData(next)
    saveStore(next)
  }, [])

  const token = data.session?.access_token
  const rol = data.session?.rol || (token && tokenRol(token))

  useEffect(() => {
    const onHash = () => {
      enforceRoute(rol, token)
      setPath(currentPath())
      setLoginPortal(preferredPortalFromQuery())
    }
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash || window.location.hash === '#') {
      navigate('/')
    } else {
      enforceRoute(rol, token)
      setPath(currentPath())
    }
    return () => window.removeEventListener('hashchange', onHash)
  }, [rol, token])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    checkHealth().then(setApiOk)
    const timer = setInterval(() => checkHealth().then(setApiOk), 5000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const wide = path === '/' || path.startsWith('/empresa') || (path.startsWith('/login') && loginPortal === 'empresa')
    const b2b = path.startsWith('/empresa') && token && rol === 'empresa'
    const agro = Boolean(token && rol === 'productor')
    const light = path === '/' || b2b || agro || path.startsWith('/login')
    document.getElementById('root')?.classList.toggle('wide', wide)
    document.getElementById('root')?.classList.toggle('b2b', b2b)
    document.getElementById('root')?.classList.toggle('agro', agro)
    document.body.classList.toggle('b2b-page', b2b)
    document.body.classList.toggle('agro-page', agro)
    document.body.classList.toggle('light-page', light)
    return () => {
      document.body.classList.remove('b2b-page', 'agro-page', 'light-page')
      document.getElementById('root')?.classList.remove('wide', 'b2b', 'agro')
    }
  }, [path, loginPortal, token, rol])

  function goLogin(portal) {
    setLoginPortal(portal)
    navigate(`/login?portal=${portal}`)
  }

  function onLogin(auth) {
    const base = applySession(resetStore(), auth, {
      nombre: auth.rol === 'empresa' ? MY_ACCOUNT.empresa.nombre : MY_ACCOUNT.productor.nombre,
    })
    // Empresa: solo sesión. Los datos de campo vienen del snapshot del productor (solo lectura).
    if (auth.rol === 'empresa') {
      persist(base)
      navigate(homeFor(auth.rol))
      return
    }
    const seed = buildProductorDemoSeed({
      productor_id: auth.productor_id || base.session.productor_id,
      email: auth.email,
      nombre: MY_ACCOUNT.productor.nombre,
    })
    const next = {
      ...base,
      ...seed,
      session: base.session,
      productor: {
        ...base.productor,
        ...(seed.productor || {}),
        id: auth.productor_id || base.productor.id,
      },
    }
    persist(next)
    navigate(homeFor(auth.rol))
  }

  async function onQuickLogin(portal) {
    const account = portal === 'empresa' ? MY_ACCOUNT.empresa : MY_ACCOUNT.productor
    const auth = await loginUser({
      email: account.email,
      password: MY_ACCOUNT.password,
    })
    onLogin(auth)
  }

  function reloadDemo() {
    const authLike = {
      access_token: data.session.access_token,
      id: data.session.user_id,
      rol: data.session.rol,
      productor_id: data.session.productor_id,
      email: data.session.email,
    }
    onLogin(authLike)
  }

  function onLogout() {
    persist(resetStore())
    navigate('/')
  }

  function goHome() {
    navigate('/')
  }

  if (path === '/' || path === '') {
    return (
      <RootHub
        apiOk={apiOk}
        online={online}
        session={data.session}
        onGoLogin={goLogin}
        onContinue={() => navigate(homeFor(rol))}
        onLogout={onLogout}
        onQuickLogin={onQuickLogin}
        onReloadDemo={reloadDemo}
      />
    )
  }

  if (!token || path.startsWith('/login')) {
    return (
      <Login
        apiOk={apiOk}
        online={online}
        preferredRol={loginPortal || 'productor'}
        onSuccess={onLogin}
        onBack={goHome}
      />
    )
  }

  if (rol === 'empresa') {
    return (
      <EmpresaApp
        token={token}
        email={data.session.email}
        onLogout={onLogout}
        onHome={goHome}
      />
    )
  }

  return (
    <ProductorApp
      data={data}
      persist={persist}
      online={online}
      apiOk={apiOk}
      onLogout={onLogout}
      onHome={goHome}
    />
  )
}
