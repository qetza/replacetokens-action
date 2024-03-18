# Changelog
## v1.1.2
- Change telemetry provider.

## v1.1.1
- Fix variable case-sensitivity ([#7](https://github.com/qetza/replacetokens-action/issues/7)).
- Fix paths in sources incompatible with `fast-glob` syntax on win32.

## v1.1.0
- Add support for JSON comments in _variables_ and in JSON variable files and environment variables
- Add support for multiple glob patterns separeted by a semi-colon (`;`) using [fast-glob](https://github.com/mrmlnc/fast-glob) in variable file paths
- Add support for YAML variable files (`.yml` or `.yaml`)
- Fix log level (`info`) for groups
- Add anonymous telemetry usage
- Upgrade package `@qetza/replacetokens` to `1.2.0`

## v1.0.0
- Initial Release of the ReplaceTokens action