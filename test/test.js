const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { after, before, test } = require('node:test')
const expressValidator = require('..')
const expressSetup = require('./lib/_expressSetup')
const { brokenValidatorSetup, invalidHTML, validHTML } = expressSetup

const port = 43711
const origin = `http://localhost:${port}`
const fixtures = path.join(__dirname, 'fixtures')
const validationFailed = 'HTML did not pass validator'

let server

before(async () => {
  server = await listen(expressSetup(), port)
})

after(() => {
  server.close()
})

// start an app and wait for it to be ready for requests
function listen (app, port) {
  return new Promise(resolve => {
    const listener = app.listen(port, () => resolve(listener))
  })
}

// make a request against the test app
async function get (route, headers) {
  const res = await fetch(`${origin}${route}`, { headers })
  return { status: res.status, text: await res.text() }
}

// build a validator as though it were running in the given app root
function validatorFromAppRoot (fixture, params) {
  const previousCwd = process.cwd()
  process.chdir(path.join(fixtures, fixture))
  try {
    return expressValidator(params)
  } finally {
    process.chdir(previousCwd)
  }
}

test('standalone validator flags invalid HTML', async () => {
  const validate = expressValidator({})
  const text = await validate(invalidHTML)

  assert.ok(text.includes(validationFailed))
  assert.match(text, /failed to tokenize/) // the markup is malformed, so it must be reported as a parser error
})

test('standalone validator passes valid HTML through untouched', async () => {
  const validate = expressValidator({})
  const text = await validate(validHTML)

  assert.equal(text, validHTML)
})

test('invalid HTML on res.send', async () => {
  const res = await get('/invalid')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
  assert.match(res.text, /failed to tokenize/) // no template engine is involved here, so the malformed markup reaches the validator intact
})

test('invalid HTML on res.sendFile', async () => {
  const res = await get('/invalid-file')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
  assert.match(res.text, /failed to tokenize/) // files are served as they are on disk, so the malformed markup reaches the validator intact
})

test('invalid HTML on res.render with empty model', async () => {
  const res = await get('/render-empty-model')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
})

test('invalid HTML on res.render with model', async () => {
  const res = await get('/render')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
  assert.match(res.text, /element must have/) // templates are rendered before validation, so this fixture is invalid in a way the template engine leaves alone
})

test('invalid HTML on res.render with callback', async () => {
  const res = await get('/render-callback')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
})

test('invalid HTML on res.render with model and callback', async () => {
  const res = await get('/render-model-callback')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
})

test('invalid HTML sent from middleware rather than a route', async () => {
  const res = await get('/middleware')

  assert.equal(res.status, 500)
  assert.ok(res.text.includes(validationFailed))
  assert.match(res.text, /failed to tokenize/)
})

test('reassembles a response written in multiple chunks', async () => {
  const res = await get('/chunked')

  assert.equal(res.status, 200)
  assert.equal(res.text, validHTML)
})

test('valid HTML sent through the raw response API', async () => {
  const res = await get('/raw')

  assert.equal(res.status, 200)
  assert.equal(res.text, validHTML)
})

test('valid HTML sent through the raw response API ending with only a callback', async () => {
  const res = await get('/raw-end-callback')

  assert.equal(res.status, 200)
  assert.equal(res.text, validHTML)
})

test('send the response untouched when the validator itself fails', async () => {
  // this test deliberately trips the validator, so node's warning printer is swapped out for one that collects the warning it emits
  const warnings = []
  const printWarnings = process.listeners('warning')
  process.removeAllListeners('warning')
  process.on('warning', warning => warnings.push(warning))
  const brokenServer = await listen(brokenValidatorSetup(), port + 1)

  try {
    const res = await fetch(`http://localhost:${port + 1}/valid`)

    assert.equal(res.status, 200)
    assert.equal(await res.text(), validHTML) // the response goes out untouched rather than hanging
    assert.match(warnings[0]?.message || '', /Failed to load configuration/) // and the failure is surfaced rather than swallowed
  } finally {
    brokenServer.close()
    process.removeAllListeners('warning')
    for (const listener of printWarnings) process.on('warning', listener)
  }
})

test('skips validation on responses that are not a 200', async () => {
  const res = await get('/not-found')

  assert.equal(res.status, 404)
  assert.equal(res.text, invalidHTML)
})

test('sets the correct content length on a rewritten response', async () => {
  const res = await fetch(`${origin}/invalid`)
  const text = await res.text()

  assert.equal(res.status, 500)
  assert.equal(Number(res.headers.get('content-length')), Buffer.byteLength(text))
})

test('valid HTML on res.send', async () => {
  const res = await get('/valid')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('valid HTML on res.sendFile', async () => {
  const res = await get('/valid-file')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('valid HTML on res.render', async () => {
  const res = await get('/render-valid')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation when hitting the exception route', async () => {
  const res = await get('/render-exception-route')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation when res.render model includes exception', async () => {
  const res = await get('/render-exception-model')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation when res.render model includes exception and a callback', async () => {
  const res = await get('/render-exception-model-callback')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation when request header includes exception', async () => {
  const res = await get('/invalid', { partial: true })

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation when response header includes exception', async () => {
  const res = await get('/exception-header')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('skip validation on res.json', async () => {
  const res = await get('/json')

  assert.equal(res.status, 200)
  assert.ok(!res.text.includes(validationFailed))
})

test('use config file when validatorConfig is undefined', async () => {
  const validate = validatorFromAppRoot('configured', {})
  const text = await validate(validHTML) // the config file demands double quoted attributes, this markup uses single quotes

  assert.ok(text.includes(validationFailed))
})

test('use config file when validatorConfig is an empty object', async () => {
  const validate = validatorFromAppRoot('configured', { validatorConfig: {} })
  const text = await validate(validHTML)

  assert.ok(text.includes(validationFailed))
})

test('use validatorConfig when one is supplied, ignoring the config file', async () => {
  const validate = validatorFromAppRoot('configured', { validatorConfig: { extends: ['html-validate:standard'] } })
  const text = await validate(validHTML)

  assert.equal(text, validHTML)
})

test('use config file from the app root when running from inside node_modules', async () => {
  const nestedDir = path.join(fixtures, 'configured', 'node_modules', 'some-package')
  fs.mkdirSync(nestedDir, { recursive: true })

  try {
    const validate = validatorFromAppRoot(path.join('configured', 'node_modules', 'some-package'), {})
    const text = await validate(validHTML)

    assert.ok(text.includes(validationFailed))
  } finally {
    fs.rmSync(path.join(fixtures, 'configured', 'node_modules'), { recursive: true, force: true })
  }
})

test('use defaults when validatorConfig is an empty object and no config file exists', async () => {
  const validate = validatorFromAppRoot('unconfigured', { validatorConfig: {} })
  const text = await validate(validHTML)

  assert.equal(text, validHTML)
})

test('concurrent requests do not share render models with each other', async () => {
  const requests = []
  for (let i = 0; i < 10; i++) {
    requests.push(get('/render-exception-model'), get('/render'))
  }
  const responses = await Promise.all(requests)

  for (const [index, res] of responses.entries()) {
    const exempt = index % 2 === 0
    assert.equal(res.status, exempt ? 200 : 500)
    assert.equal(res.text.includes(validationFailed), !exempt)
  }
})
