# express-html-validator

A developer tool that automatically validates the HTML on all your express routes, powered by [html-validate](https://html-validate.org/). This module was built and is maintained by the [Roosevelt web framework](https://github.com/rooseveltframework/roosevelt) [team](https://github.com/orgs/rooseveltframework/people), but it can be used independently of Roosevelt as well.

## Install

First declare `express-html-validator` as a dependency in your app.

## Usage

Require the package into your application and call its constructor, passing along your express app:

```js
const express = require('express')
const expressValidator = require('express-html-validator')
const app = express()
const config = {}

// Generally this would be used in development mode
if (process.env.NODE_ENV === 'development') {
  expressValidator(app, config)
}

// expressValidator should be called before defining routes
app.get('/', (req, res) => {
  // This html response will be validated in real time as it's sent
  res.sendFile(path.join(publicDir, 'index.html'))
})
```

## Configuration

Optionally you can pass this module a set of configs:

- `exceptions`: A set of params that can be used to prevent validation in certain scenarios:

  - `header` *[String]*: A custom header that when set will disable the validator on a per request basis.

    - Default: `'Partial'`.

  - `modelValue` *[String]*: An entry in your data model passed along with a `res.render` that when set will disable validation on the rendered HTML.

    - Default: `'_disableValidator'`

- `validatorConfig` *[Object]*: [html-validate configuration](https://html-validate.org/usage/#configuration) that determines what errors the validator looks for.

  - Note: The full list of available validator rules can be found [here](https://html-validate.org/rules/).

  - Note: This configuration can also be set by a `.htmlValidate.json` file placed in your app root directory.

  - Default:

    ```json
    {
      "extends": ["html-validate:recommended"],
      "rules": {
        "attr-case": "off",
        "attr-quotes": "off"
      }
    }
    ```
