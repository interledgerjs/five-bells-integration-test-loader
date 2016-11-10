# five-bells-integration-test-loader

## Purpose

The Five Bells integration tests will test a module against the latest versions
of each other module. If it is testing the branch of a module, it will prefer
branches of the same name for other modules.

However, the version of the integration tests themselves are hard-coded in each
module's package.json file.

That means that when a new component requires a change to the integration tests,
the integration test version must be bumped in every single component. It also
means that we often need to "`[skip tests]`" when making changes to the tests
themselves.

This module fixes this problem by applying the same rules we apply to the
modules under test to the integration tests themselves. In other words, it will
automatically test using the latest master of the integration tests or using a
branch of the same name.

## Usage

### Adding tests to a module

If a module should be tested as part of the integration tests, it needs to
depend on this loader:

``` sh
npm install --save-dev five-bells-integration-test-loader
```

And it needs to specify which integration test module to use in its `package.json`:

``` json
{
  "name": "foo",
  "version": "1.0.0",
  "config": {
    "integration-test-loader": {
      "module": "five-bells-integration-test",
      "repo": "interledgerjs/five-bells-integration-test"
    }
  }
}
```
