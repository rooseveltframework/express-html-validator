/**
 * Setup an Express app to test against
 */

const express = require('express')
const path = require('path')
const teddy = require('teddy')
const expressValidator = require('../..')

// invalid html to test against: the body tag is never terminated
const invalidHTML = `
    <!DOCTYPE html>
    <html lang='en'>
      <head>
        <meta charset='utf-8'>
      </head>
      <body
        <h1>hello</h1>
      </body>
    </html>`

// valid html to test against
const validHTML = `
    <!DOCTYPE html>
    <html lang='en'>
      <head>
        <meta charset='utf-8'>
        <title>Valid</title>
      </head>
      <body>
        <h1>hello</h1>
      </body>
    </html>`

function expressSetup () {
  // init express app
  const app = express()

  // setup teddy templating engine
  app.set('views', path.join(__dirname, 'templates'))
  app.set('view engine', 'html')
  app.engine('html', teddy.__express)

  // setup the express validator
  expressValidator(app, {
    exceptions: {
      routes: ['/render-exception-route'],
      header: 'Partial',
      modelValue: '_disableValidator'
    }
  })

  // exercise the code path where the validator is set up without any params
  expressValidator(express())

  // invalid html res.send
  app.get('/invalid', (req, res) => {
    res.send(invalidHTML)
  })

  // invalid html res.sendFile
  app.get('/invalid-file', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/invalidPlain.html'))
  })

  // invalid html res.send with exception header value
  app.get('/exception-header', (req, res) => {
    res.set('partial', true)

    res.send(invalidHTML)
  })

  // invalid html res.render with model
  app.get('/render', (req, res) => {
    res.render('invalidTemplate', { hello: 'world' })
  })

  // invalid html res.render without model
  app.get('/render-empty-model', (req, res) => {
    res.render('invalidTemplate')
  })

  // invalid html res.render with callback
  app.get('/render-callback', (req, res) => {
    res.render('invalidTemplate', (e, html) => {
      res.send(html)
    })
  })

  // invalid html res.render with model and callback
  app.get('/render-model-callback', (req, res) => {
    res.render('invalidTemplate', { hello: 'world' }, (e, html) => {
      res.send(html)
    })
  })

  // invalid html res.render with model exception route
  app.get('/render-exception-route', (req, res) => {
    res.render('invalidTemplate', {})
  })

  // invalid html res.render with model exception value
  app.get('/render-exception-model', (req, res) => {
    res.render('invalidTemplate', { _disableValidator: true })
  })

  // invalid html res.render with model exception value and callback
  app.get('/render-exception-model-callback', (req, res) => {
    res.render('invalidTemplate', { _disableValidator: true }, (e, html) => {
      res.send(html)
    })
  })

  // valid html res.send
  app.get('/valid', (req, res) => {
    res.send(validHTML)
  })

  // valid html res.sendFile
  app.get('/valid-file', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/validPlain.html'))
  })

  // valid html res.render
  app.get('/render-valid', (req, res) => {
    res.render('validTemplate')
  })

  // no html on res.json
  app.get('/json', (req, res) => {
    res.json({ hello: 'world' })
  })

  // valid html written to the response in several chunks rather than all at once
  app.get('/chunked', (req, res) => {
    res.type('html')
    for (const chunk of validHTML.match(/[\s\S]{1,20}/g)) res.write(chunk)
    res.end()
  })

  // invalid html sent with a status other than 200, which the validator ignores
  app.get('/not-found', (req, res) => {
    res.status(404).send(invalidHTML)
  })

  // valid html sent through the raw node.js response api with a headers object and write and end callbacks
  app.get('/raw', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(validHTML.slice(0, 20), () => {})
    res.end(validHTML.slice(20), () => {})
  })

  // valid html sent through the raw node.js response api, ending the response with nothing but a callback
  app.get('/raw-end-callback', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(validHTML)
    res.end(() => {})
  })

  // invalid html sent from middleware rather than a route, meaning req.route will be undefined
  app.use('/middleware', (req, res) => {
    res.send(invalidHTML)
  })

  return app
}

// an app configured with a validator that will fail when it runs
function brokenValidatorSetup () {
  const app = express()

  expressValidator(app, { validatorConfig: { extends: ['html-validate:does-not-exist'] } })

  app.get('/valid', (req, res) => {
    res.send(validHTML)
  })

  return app
}

module.exports = expressSetup
module.exports.brokenValidatorSetup = brokenValidatorSetup
module.exports.invalidHTML = invalidHTML
module.exports.validHTML = validHTML
