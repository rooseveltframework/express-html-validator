## 1.1.0

- Breaking: Increased Node.js requirement to 22.5.0 or higher.
- Fixed a crash that could occur when a response is sent from middleware rather than a route while the `exceptions.routes` param is in use.
- Fixed an issue where validator error messages containing quotes could break the markup of the error page.
- Fixed a race condition where concurrent `res.render` calls could apply the wrong data model when evaluating the `exceptions.modelValue` param.
- Updated dependencies.

## 1.0.1

- Fixed a possible crash that can happen with some variety of request objects.
- Updated various dependencies.

## 1.0.0

- Added a new type of `exceptions` param called `routes`.
- Refactored the code.
- Updated various dependencies.

## 0.2.5

- Fixed possible race condition.
- Updated various dependencies.

## 0.2.4

- Updated various dependencies.

## 0.2.3

- Updated various dependencies.

## 0.2.2

- Bumped various dependencies.

## 0.2.1

- Added feature to run the validator on arbitrary strings in addition to the direct Express render integration.
- Bumped various dependencies.

## 0.2.0

- Bumped various dependencies.

## 0.1.3

- Bumped various dependencies.

## 0.1.2

- Changed default rules to focus less on best practices enforcement and more on validation only.
- Bumped various dependencies.

## 0.1.1

- Changed default rules to focus less on best practices enforcement and more on validation only.
- Bumped various dependencies.

## 0.1.0

- Released initial version.
