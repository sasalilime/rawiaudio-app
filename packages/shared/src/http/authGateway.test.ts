import { test } from 'node:test'
import assert from 'node:assert/strict'
import { InvalidCodeError, InvalidEmailError, TooManyRequestsError, UnavailableError } from '../core/domain/errors.ts'
import { createApi } from './apiClient.ts'
import { createHttpAuthGateway, type TokenStore } from './authGateway.ts'

const TOKEN = 'A'.repeat(43)

// Faux fetch : rejoue les réponses données dans l'ordre et note chaque requête.
function fakeFetch(...responses: Response[]) {
  const requests: { url: string; init: RequestInit | undefined }[] = []
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init })
    const response = responses.shift()
    if (!response) throw new Error('requête inattendue')
    return response
  }
  return { fn: fn as typeof fetch, requests }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

function memoryTokens(initial: string | null = null): TokenStore & { value: string | null } {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (token: string) => {
      store.value = token
    },
    clear: async () => {
      store.value = null
    },
  }
  return store
}

test("PWA : envoie le cookie, ne reçoit ni ne garde de jeton", async () => {
  const { fn, requests } = fakeFetch(json(200, { account: { email: 'a@example.com' } }))
  const gateway = createHttpAuthGateway(createApi('/api', fn, { credentials: 'include' }), 'web')

  assert.deepEqual(await gateway.verifyCode('a@example.com', '042917'), { email: 'a@example.com' })
  const { url, init } = requests[0]!
  assert.equal(url, '/api/auth/code')
  assert.equal(init?.method, 'POST')
  assert.equal(init?.credentials, 'include')
  assert.deepEqual(JSON.parse(String(init?.body)), { email: 'a@example.com', code: '042917', client: 'web' })
})

test('app : garde le jeton reçu, puis l’envoie dans Authorization', async () => {
  const tokens = memoryTokens()
  const { fn, requests } = fakeFetch(
    json(200, { account: { email: 'a@example.com' }, token: TOKEN }),
    json(200, { email: 'a@example.com' }),
  )
  const gateway = createHttpAuthGateway(createApi('https://api.rawiaudio.com', fn, { token: tokens.get }), 'app', tokens)

  await gateway.verifyLink('B'.repeat(43))
  assert.equal(tokens.value, TOKEN)
  assert.deepEqual(await gateway.currentAccount(), { email: 'a@example.com' })
  assert.equal((requests[1]!.init?.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`)
})

test("app sans jeton : pas de session, sans appeler le réseau", async () => {
  const { fn, requests } = fakeFetch()
  const tokens = memoryTokens()
  const gateway = createHttpAuthGateway(createApi('/api', fn, { token: tokens.get }), 'app', tokens)
  assert.equal(await gateway.currentAccount(), null)
  assert.equal(requests.length, 0)
})

test('session expirée : null, et l’app oublie son jeton', async () => {
  const tokens = memoryTokens(TOKEN)
  const { fn } = fakeFetch(json(401, { error: 'unauthorized' }))
  const gateway = createHttpAuthGateway(createApi('/api', fn, { token: tokens.get }), 'app', tokens)
  assert.equal(await gateway.currentAccount(), null)
  assert.equal(tokens.value, null)
})

test('les erreurs du serveur deviennent celles du cœur', async () => {
  const cases: [Response, new (...args: never[]) => Error][] = [
    [json(400, { error: 'invalid_email' }), InvalidEmailError],
    [json(400, { error: 'invalid_code' }), InvalidCodeError],
    [json(429, { error: 'too_many_requests' }, { 'Retry-After': '3600' }), TooManyRequestsError],
    [json(503, { error: 'unavailable' }), UnavailableError],
  ]
  for (const [response, expected] of cases) {
    const gateway = createHttpAuthGateway(createApi('/api', fakeFetch(response).fn), 'web')
    await assert.rejects(gateway.verifyCode('a@example.com', '042917'), (error: unknown) => {
      assert.ok(error instanceof expected, `${response.status} → ${String(error)}`)
      if (error instanceof TooManyRequestsError) assert.equal(error.retryAfterSeconds, 3600)
      return true
    })
  }
})

test("app hors ligne : la déconnexion oublie quand même le jeton ; la PWA, elle, signale l'échec", async () => {
  const offline = (async () => {
    throw new TypeError('Failed to fetch')
  }) as typeof fetch
  const tokens = memoryTokens(TOKEN)
  await createHttpAuthGateway(createApi('/api', offline, { token: tokens.get }), 'app', tokens).logout()
  assert.equal(tokens.value, null)

  await assert.rejects(createHttpAuthGateway(createApi('/api', offline), 'web').logout(), UnavailableError)
})

test('suppression du compte : DELETE /account, puis le jeton est oublié', async () => {
  const tokens = memoryTokens(TOKEN)
  const { fn, requests } = fakeFetch(new Response(null, { status: 204 }))
  await createHttpAuthGateway(createApi('/api', fn, { token: tokens.get }), 'app', tokens).deleteAccount()
  assert.equal(requests[0]!.init?.method, 'DELETE')
  assert.equal(requests[0]!.url, '/api/account')
  assert.equal(tokens.value, null)
})

test("la demande de code dit d'où elle vient : web pour la PWA, app pour l'app mobile", async () => {
  for (const client of ['web', 'app'] as const) {
    const { fn, requests } = fakeFetch(new Response(null, { status: 202 }))
    const tokens = memoryTokens()
    await createHttpAuthGateway(createApi('/api', fn), client, tokens).requestLogin('a@example.com')
    assert.deepEqual(JSON.parse(String(requests[0]!.init?.body)), { email: 'a@example.com', client })
  }
})
