Optionally you can pass this module a set of configs:

- `exceptions` *[Object]*: A set of params that can be used to prevent validation in certain scenarios:
  - `routes` *[Array]*: An array of routes to exclude from validation. Supports wildcard `*` syntax. Default: `[]`.
  - `header` *[String]*: A custom header that when set will disable the validator on a per request basis. Default: `'Partial'`.
  - `modelValue` *[String]*: An entry in your data model passed along with a `res.render` that when set will disable validation on the rendered HTML. Default: `'_disableValidator'`

- `validatorConfig` *[Object]*: [html-validate configuration](https://html-validate.org/usage/#configuration) that determines what errors the validator looks for. The full list of available validator rules can be found [here](https://html-validate.org/rules/). This configuration can also be set by a `.htmlValidate.json` file placed in your app root directory.

Default for `validatorConfig`:

```json
{
  "extends": ["html-validate:standard"]
}
```
