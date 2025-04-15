First declare `express-html-validator` as a dependency in your app.

Then require the package into your application and call its constructor, passing along your Express app:

```js
const express = require('express')
const expressValidator = require('express-html-validator')
const app = express()
const config = {}

// generally this would be used in development mode
if (process.env.NODE_ENV === 'development') {
  expressValidator(app, config)
}

// expressValidator should be called before defining routes
app.get('/', (req, res) => {
  // this html response will be validated in real time as it's sent
  res.sendFile(path.join(publicDir, 'index.html'))
})
```

You can also run the validator on arbitrary strings outside of the Express context:

```js
const config = {}
const expressValidator = require('express-html-validator')(config)

const someHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Some HTML that will not validate</title>
</head>
<body>
  <p>hello world</p></p>
</body>
</html>`

const validationResult = expressValidator(someHtml)
```

Since the example HTML is not valid, if you display the contents of `validationResult` in a browser, you will see validation errors.
