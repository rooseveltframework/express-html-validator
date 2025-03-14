const appDir = require('app-root-dir').get()
const fs = require('fs')
const path = require('path')
const Prism = require('prismjs')
const prismPath = require.resolve('prismjs')
const prismStyleSheet = fs.readFileSync(path.join(prismPath.split('prism.js')[0], 'themes/prism.css'))
const tamper = require('tamper')
const { HtmlValidate } = require('html-validate')
const validatorErrorPage = fs.readFileSync(path.join(__dirname, 'templates/errorPage.html'))

function templateLiteralRenderer (templateString, dataModel) {
  const templateFunction = new Function(...Object.keys(dataModel), `return \`${templateString}\`;`) // eslint-disable-line
  return templateFunction(...Object.values(dataModel))
}

const { minimatch } = require('minimatch')
function wildcardMatch (str, matchList) {
  for (let rule of matchList) {
    rule = path.normalize(rule).replace(/\\/g, '/') // normalize windows; including normalizing the slashes
    if (minimatch(str, rule)) return true
  }
  return false
}

module.exports = (app, params) => {
  if (Object.prototype.hasOwnProperty.call(app, 'listen') || typeof app.listen === 'function') params = params || {} // two arguments
  else {
    params = app // one argument
    app = null
  }
  let render
  if (app) render = app.response.render
  let resModel
  const routeException = params?.exceptions?.routes || []
  let headerException = params?.exceptions?.header ? params.exceptions.header : 'Partial'
  headerException = headerException.toLowerCase()
  const modelException = params?.exceptions?.modelValue ? params.exceptions.modelValue : '_disableValidator'
  let rules = typeof params?.validatorConfig === 'object' ? params.validatorConfig : {}
  const defaultRules = { extends: ['html-validate:standard'] } // default html-validate rules to use when none are passed
  if (Object.keys(rules).length === 0) { // when no config is passed check for a config file
    const ruleFile = path.join(appDir, '.htmlValidate.json')
    if (fs.existsSync(ruleFile)) rules = require(ruleFile)
    else rules = defaultRules
  }
  const htmlValidate = new HtmlValidate(rules)

  function reqExemptFromValidation (req, res) {
    // check for route exemptions
    if (wildcardMatch(req.route?.path, routeException)) return true

    // check for model exemptions
    if (resModel) {
      if (resModel[modelException]) {
        resModel = undefined
        return true
      } else resModel = undefined // clear out the cached model in both scenarios
    }

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
        const message = error.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&#34;').replace(/'/g, '&#39;') // escape html entities
        parsedErrors += `${message}\n` // first line is error message
        parsedErrors += `At line ${error.line}, column ${error.column}\n\n` // next line is line and column numbers
        errorMap.set(error.line, error.message) // add error message and line number to map
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
      if (res) res.status(500)

      // build a model that includes error data, markup, and styling
      const model = {
        prismStyle: prismStyleSheet.toString(),
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
    app.response.render = function (view, model, callback) {
      if (model && typeof model === 'object') resModel = model // store a reference to the model if exceptions are being used and a model was set
      render.apply(this, arguments)
    }

    // validate responses under the right conditions
    app.use(tamper((req, res) => {
      if (res.statusCode === 200 && res.getHeader?.('Content-Type')?.includes('text/html') && !reqExemptFromValidation(req, res)) return async (body) => await validate(body, res)
    }))
  }

  return validate // export validate function for general use
}
