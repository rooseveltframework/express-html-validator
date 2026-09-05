const fs = require('fs')
const path = require('path')
const Prism = require('prismjs')
const { HtmlValidate } = require('html-validate')
const prismStyleSheet = fs.readFileSync(require.resolve('prismjs/themes/prism.css'), 'utf8')
const validatorErrorPage = fs.readFileSync(path.join(__dirname, 'templates/errorPage.html'), 'utf8')
const defaultRules = { extends: ['html-validate:standard'] } // default html-validate rules to use when none are passed
const modelReference = Symbol('expressHtmlValidatorModel') // where the model from a res.render is stashed on the response object

function templateLiteralRenderer (templateString, dataModel) {
  const templateFunction = new Function(...Object.keys(dataModel), `return \`${templateString}\`;`) // eslint-disable-line
  return templateFunction(...Object.values(dataModel))
}

function escapeHtml (string) {
  return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&#34;').replace(/'/g, '&#39;')
}

function wildcardMatch (str, matchList) {
  for (const rule of matchList) {
    if (path.matchesGlob(str, path.normalize(rule).replace(/\\/g, '/'))) return true // normalize windows; including normalizing the slashes
  }
  return false
}

// locate the root directory of the app consuming this module
function getAppDir () {
  const nodeModules = `${path.sep}node_modules${path.sep}`
  const cwd = process.cwd()
  const cwdPos = cwd.indexOf(nodeModules)
  if (cwdPos !== -1) return cwd.substring(0, cwdPos) // cwd is somewhere inside of a node_modules folder
  if (fs.existsSync(path.join(cwd, 'package.json'))) return cwd // cwd is the app root
  const dirPos = __dirname.indexOf(nodeModules) // fall back to this module's own location
  if (dirPos === -1) return path.normalize(path.join(__dirname, '..'))
  return __dirname.substring(0, dirPos)
}

// determine which html-validate rules to use: the ones passed in, the ones in the app's config file, or the defaults
function resolveRules (validatorConfig) {
  if (validatorConfig && typeof validatorConfig === 'object' && Object.keys(validatorConfig).length > 0) return validatorConfig
  const ruleFile = path.join(getAppDir(), '.htmlValidate.json') // when no config is passed check for a config file
  if (fs.existsSync(ruleFile)) return JSON.parse(fs.readFileSync(ruleFile, 'utf8'))
  return defaultRules
}

// buffers the response body so it can be rewritten before it is sent
// derived from the tamper module: https://github.com/fgnass/tamper (MIT, Copyright (c) 2019 Felix Gnass)
// the accept callback is handed the request and response once the headers are known. returning a function from it captures the body and hands it to that function to rewrite, returning anything falsy lets the response proceed untouched
function captureResponseBody (accept) {
  return function (req, res, next) {
    const original = { write: res.write, end: res.end, writeHead: res.writeHead }
    const chunks = []
    let rewrite = null
    let headersSet = false
    let statusMessage

    function restore () {
      res.write = original.write
      res.end = original.end
      res.writeHead = original.writeHead
    }

    // the accept callback needs final headers to make its decision, so force them to be set before any body is written
    function mustCapture () {
      if (!headersSet) res.writeHead(res.statusCode)
      return !!rewrite
    }

    function toBuffer (chunk, encoding) {
      return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8')
    }

    res.writeHead = function (statusCode, message, headers) {
      if (message !== null && typeof message === 'object') { // the status message is optional
        headers = message
        message = undefined
      }
      this.statusCode = statusCode
      statusMessage = message
      if (Array.isArray(headers)) for (let i = 0; i < headers.length; i += 2) this.setHeader(headers[i], headers[i + 1]) // headers can be a flat array of key value pairs
      else for (const name in headers) this.setHeader(name, headers[name])
      headersSet = true
      this.writeHead = original.writeHead
      rewrite = accept(req, this)
      if (rewrite) return this // hold the headers back until the body has been rewritten and its length is known
      this.write = original.write // nothing to rewrite, so un-patch the response and let it proceed as usual
      this.end = original.end
      return this.writeHead(statusCode, statusMessage)
    }

    res.write = function (chunk, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding
        encoding = undefined
      }
      if (!mustCapture()) return this.write(chunk, encoding, callback)
      if (chunk) chunks.push(toBuffer(chunk, encoding))
      if (callback) process.nextTick(callback)
      return true
    }

    res.end = function (chunk, encoding, callback) {
      if (typeof chunk === 'function') {
        callback = chunk
        chunk = undefined
      } else if (typeof encoding === 'function') {
        callback = encoding
        encoding = undefined
      }
      if (!mustCapture()) return this.end(chunk, encoding, callback)
      if (chunk) chunks.push(toBuffer(chunk, encoding))
      const body = Buffer.concat(chunks).toString()
      const send = (finalBody) => {
        restore()
        this.setHeader('Content-Length', Buffer.byteLength(finalBody))
        this.writeHead(this.statusCode, statusMessage)
        this.end(finalBody, callback)
      }
      Promise.resolve(rewrite(body)).then(send, error => { // send the body untouched rather than hanging the response if the rewrite fails
        process.emitWarning(error)
        send(body)
      })
      return this
    }

    next()
  }
}

module.exports = (app, params) => {
  if (typeof app?.listen === 'function') params = params || {} // two arguments
  else {
    params = app // one argument
    app = null
  }
  const render = app ? app.response.render : null
  const routeException = params?.exceptions?.routes || []
  const headerException = (params?.exceptions?.header || 'Partial').toLowerCase()
  const modelException = params?.exceptions?.modelValue || '_disableValidator'
  const htmlValidate = new HtmlValidate(resolveRules(params?.validatorConfig))

  function reqExemptFromValidation (req, res) {
    // check for route exemptions
    if (req.route?.path && wildcardMatch(req.route.path, routeException)) return true

    // check for model exemptions
    if (res[modelReference]?.[modelException]) return true

    // check for head exemptions
    if (headerException) {
      if (req.headers[headerException]) return true // check the request header
      if (res.getHeader(headerException)) return true // check the response header
    }

    return false
  }

  async function validate (body, res) {
    const report = await htmlValidate.validateString(body) // run the validator against the response body
    if (!report.valid) {
      // the html failed validation
      const errorMap = new Map()
      let parsedErrors = ''
      for (const error of report.results[0].messages) {
        const message = escapeHtml(error.message)
        parsedErrors += `${message}\n` // first line is error message
        parsedErrors += `At line ${error.line}, column ${error.column}\n\n` // next line is line and column numbers
        errorMap.set(error.line, message) // add error message and line number to map
      }
      const errorList = `<h2>Errors:</h2>\n<code class="validatorErrors">${parsedErrors}</code>`

      // start building out stylized markup block
      let formattedHTML = '<pre class=\'markup\'>\n<code class="language-html">\n'
      const markupArray = body.split('\n')

      // add line number highlighting for detected errors
      for (const [index, markupLine] of markupArray.entries()) {
        const error = errorMap.get(index + 1)
        if (error) formattedHTML += `<span title='${error}' class='line-numbers error'>`
        else formattedHTML += '<span class=\'line-numbers\'>'
        formattedHTML += Prism.highlight(markupLine, Prism.languages.markup)
        formattedHTML += '</span>'
      }

      // cap off the stylized markup blocks
      formattedHTML += '</code>\n</pre>'
      formattedHTML = `<h2>Markup used:</h2>\n${formattedHTML}`

      // use 500 status for the validation error
      if (res) res.status(500)

      // build a model that includes error data, markup, and styling
      const model = {
        prismStyle: prismStyleSheet,
        preWidth: markupArray.length.toString().length * 8,
        errors: errorList,
        markup: formattedHTML,
        rawMarkup: body
      }

      // parse error page template and replace response body with it
      body = templateLiteralRenderer(validatorErrorPage, model)
    }

    return body
  }

  if (app) {
    // use some method overload trickery to store a usable model reference
    app.response.render = function (...args) {
      const [, model] = args
      if (model && typeof model === 'object') this[modelReference] = model // store a reference to the model on the response itself so concurrent requests can't clobber each other
      return render.apply(this, args)
    }

    // validate responses under the right conditions
    app.use(captureResponseBody((req, res) => {
      if (res.statusCode === 200 && res.getHeader?.('Content-Type')?.includes('text/html') && !reqExemptFromValidation(req, res)) return async (body) => await validate(body, res)
    }))
  }

  return validate // export validate function for general use
}
