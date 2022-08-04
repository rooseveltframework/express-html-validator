const appDir = require('app-root-dir').get()
const fs = require('fs-extra')
const path = require('path')
const Prism = require('prismjs')
const prismPath = require.resolve('prismjs')
const prismStyleSheet = fs.readFileSync(path.join(prismPath.split('prism.js')[0], 'themes/prism.css'))
const tamper = require('tamper')
const template = require('es6-template-strings')
const { HtmlValidate } = require('html-validate')
const validatorErrorPage = fs.readFileSync(path.join(__dirname, 'templates/errorPage.html'))

module.exports = (app, params) => {
  if (app.hasOwnProperty('listen') || typeof app.listen === 'function') {
    params = params || {} // two arguments
  } else {
    params = app // one argument
    app = null
  }

  let render
  if (app) {
    render = app.response.render
  }
  let resModel

  // sanitize config
  let headerException = params.exceptions && params.exceptions.header ? params.exceptions.header : 'Partial'
  headerException = headerException.toLowerCase()
  const modelException = params.exceptions && params.exceptions.modelValue ? params.exceptions.modelValue : '_disableValidator'
  let rules = params.validatorConfig && typeof params.validatorConfig === 'object' ? params.validatorConfig : {}

  // default html-validate rules to use when none are passed
  const defaultRules = {
    extends: ['html-validate:standard']
  }

  /**
   * Utility function to check if a route has any exceptions
   */
  function validatorExceptions (req, res) {
    // check the model
    if (resModel) {
      if (resModel[modelException]) {
        resModel = undefined
        return true
      } else {
        // clear out the cached model in both scenarios
        resModel = undefined
      }
    }

    // check headers
    if (headerException) {
      // check the request header
      if (req.headers[headerException]) {
        return true
      }

      // check the response header
      if (res.getHeader(headerException)) {
        return true
      }
    }

    return false
  }

  // source validatorConfig
  if (Object.keys(rules).length === 0) {
    // when no config is passed check for a config file
    const ruleFile = path.join(appDir, '.htmlValidate.json')

    if (fileExists(ruleFile)) {
      rules = require(ruleFile)
    } else {
      rules = defaultRules
    }
  }

  // instantiate the validator module
  const htmlValidate = new HtmlValidate(rules)

  function validate (body, res) {
    // run the validator against the response body
    const report = htmlValidate.validateString(body)

    if (!report.valid) {
      const errorMap = new Map()
      let parsedErrors = ''

      for (const error of report.results[0].messages) {
        const message = escapeHtmlEntities(error.message)

        // first line is error message
        parsedErrors += `${message}\n`

        // next line is line and column numbers
        parsedErrors += `At line ${error.line}, column ${error.column}\n\n`

        // add error message and line number to map
        errorMap.set(error.line, error.message)
      }

      const errorList = `<h2>Errors:</h2>\n<code class="validatorErrors">${parsedErrors}</code>`

      // start building out stylized markup block
      let formattedHTML = '<pre class=\'markup\'>\n<code class="language-html">\n'
      const markupArray = body.split('\n')

      // add line number highlighting for detected errors
      for (let i = 0; i < markupArray.length; i++) {
        const markupLine = markupArray[i]
        if (errorMap.has(i + 1)) {
          formattedHTML += `<span title='${errorMap.get(i + 1)}' class='line-numbers error'>`
          formattedHTML += Prism.highlight(`${markupLine}`, Prism.languages.markup)
          formattedHTML += '</span>'
        } else {
          formattedHTML += '<span class=\'line-numbers\'>'
          formattedHTML += Prism.highlight(`${markupLine}`, Prism.languages.markup)
          formattedHTML += '</span>'
        }
      }

      // cap off the stylized markup blocks
      formattedHTML += '</code>\n</pre>'
      formattedHTML = `<h2>Markup used:</h2>\n${formattedHTML}`

      // use 500 status for the validation error
      if (res) {
        res.status(500)
      }

      // build a model that includes error data, markup, and styling
      const model = {
        prismStyle: prismStyleSheet.toString(),
        preWidth: markupArray.length.toString().length * 8,
        errors: errorList,
        markup: formattedHTML,
        rawMarkup: body
      }

      // parse error page template and replace response body with it
      body = template(validatorErrorPage, model)
    }

    return body
  }

  if (app) {
    // use some method overload trickery to store a usable model reference
    app.response.render = function (view, model, callback) {
      // store a reference to the model if exceptions are being used and a model was set
      if (model && typeof model === 'object') {
        resModel = model
      }

      render.apply(this, arguments)
    }

    // validate responses under the right conditions
    app.use(tamper((req, res) => {
      /**
       * Skip validation when:
       * - HTTP status is not 200 (don't validate error pages)
       * - content-type is not text/html (don't validate non-HTML responses)
       * - No exception applies
       */
      if (res.statusCode === 200 && res.getHeader('Content-Type') && res.getHeader('Content-Type').includes('text/html') && !validatorExceptions(req, res)) {
        return (body) => {
          return validate(body, res)
        }
      }
    }))
  }

  return validate // export validate function for general use
}

/*
 * Utility functions
 */

/**
 * Escape special characters from HTML string
 *
 * @param {string} v - HTML string
 * @returns {string} - New string with HTML entities escaped
 */
function escapeHtmlEntities (v) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&#34;').replace(/'/g, '&#39;')
}

/**
 * Check if a file exists
 *
 * @param {string} path - Path to file to check
 * @returns {boolean} - Whether or not that file exists
 */
function fileExists (path) {
  try {
    fs.accessSync(path)
    return true
  } catch {
    return false
  }
}
