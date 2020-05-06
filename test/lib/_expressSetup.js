/**
 * Setup an Express app to test against
 */

const express = require('express')
const path = require('path')
const teddy = require('teddy')
const expressValidator = require('../..')

module.exports = () => {
  // invalid html to test against
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

  // init express app
  const app = express()

  // setup teddy templating engine
  app.set('views', path.join(__dirname, 'templates'))
  app.set('view engine', 'html')
  app.engine('html', teddy.__express)

  // setup the express validator
  expressValidator(app, {
    exceptions: {
      header: 'Partial',
      modelValue: '_disableValidator'
    }
  })

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

  return app
}
