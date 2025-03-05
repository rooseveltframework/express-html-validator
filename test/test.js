const path = require('path')
const proxyquire = require('proxyquire')
const request = require('supertest')
const test = require('ava')
const expressSetup = require('./lib/_expressSetup')

test.before(t => {
  const app = expressSetup()

  t.context.app = app
  t.context.server = app.listen('43711')
})

test.after(t => {
  t.context.server.close()
})

test('standalone validator', async t => {
  const standaloneValidator = require('..')({})
  const text = await standaloneValidator(`
    <!DOCTYPE html>
    <html lang='en'>
      <head>
        <meta charset='utf-8'>
      </head>
      <body
        <h1>hello</h1>
      </body>
    </html>`)
  t.true(text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.send', async t => {
  const res = await request(t.context.app)
    .get('/invalid')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.sendFile', async t => {
  const res = await request(t.context.app)
    .get('/invalid-file')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.render with empty model', async t => {
  const res = await request(t.context.app)
    .get('/render-empty-model')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.render with model', async t => {
  const res = await request(t.context.app)
    .get('/render')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.render with callback', async t => {
  const res = await request(t.context.app)
    .get('/render-callback')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('invalid HTML on res.render with model and callback', async t => {
  const res = await request(t.context.app)
    .get('/render-model-callback')

  t.is(res.status, 500)
  t.true(res.text.includes('HTML did not pass validator'))
})

test('valid HTML on res.send', async t => {
  const res = await request(t.context.app)
    .get('/valid')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('valid HTML on res.sendFile', async t => {
  const res = await request(t.context.app)
    .get('/valid-file')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('valid HTML on res.render', async t => {
  const res = await request(t.context.app)
    .get('/render-valid')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation when hitting the exception route', async t => {
  const res = await request(t.context.app)
    .get('/render-exception-route')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation when res.render model includes exception', async t => {
  const res = await request(t.context.app)
    .get('/render-exception-model')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation when res.render model includes exception and a callback', async t => {
  const res = await request(t.context.app)
    .get('/render-exception-model-callback')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation when request header includes exception', async t => {
  const res = await request(t.context.app)
    .get('/invalid')
    .set('partial', true)

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation when response header includes exception', async t => {
  const res = await request(t.context.app)
    .get('/exception-header')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('skip validation on res.json', async t => {
  const res = await request(t.context.app)
    .get('/json')

  t.is(res.status, 200)
  t.false(res.text.includes('HTML did not pass validator'))
})

test('use config file when validatorConfig is undefined', t => {
  let config
  const htmlValidateStub = {
    HtmlValidate: class {
      constructor (rules) {
        config = rules
      }
    }
  }
  const appDirStub = {
    get: () => path.join(__dirname, 'lib')
  }
  const expressValidator = proxyquire('..', { 'html-validate': htmlValidateStub, 'app-root-dir': appDirStub })

  expressValidator(t.context.app, { exceptions: {} })

  t.deepEqual(config, { hello: 'world' })
})

test('use config file when validatorConfig is an empty object', t => {
  let config
  const htmlValidateStub = {
    HtmlValidate: class {
      constructor (rules) {
        config = rules
      }
    }
  }
  const appDirStub = {
    get: () => path.join(__dirname, 'lib')
  }
  const expressValidator = proxyquire('..', { 'html-validate': htmlValidateStub, 'app-root-dir': appDirStub })

  expressValidator(t.context.app, { validatorConfig: {} })

  t.deepEqual(config, { hello: 'world' })
})

test('use defaults when validatorConfig is an empty object and no config file exists', t => {
  let config
  const htmlValidateStub = {
    HtmlValidate: class {
      constructor (rules) {
        config = rules
      }
    }
  }
  const expressValidator = proxyquire('..', { 'html-validate': htmlValidateStub })

  expressValidator(t.context.app, { rules: {} })

  t.deepEqual(config, {
    extends: ['html-validate:standard']
  })
})
