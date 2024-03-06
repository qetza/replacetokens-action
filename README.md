# ReplaceTokens
[![CI](https://github.com/qetza/replacetokens-action/actions/workflows/ci.yml/badge.svg)](https://github.com/qetza/replacetokens-action/actions/workflows/ci.yml) [![mit license](https://img.shields.io/badge/license-MIT-green)](https://github.com/qetza/replacetokens-action/blob/main/LICENSE) [![donate](https://img.shields.io/badge/donate-paypal-blue)](https://www.paypal.com/donate/?hosted_button_id=CCEAVYA8DUFD8)

This GitHub Action replaces tokens in text files with variables and/or secrets.

## What's new
Please refer to the [release page](https://github.com/qetza/replacetokens-action/releases) for the latest release notes.

## Usage
### Inputs
```yaml
- uses: qetza/replacetokens-action@v1
  with:
    # A multiline list of files to replace tokens in.
    # Each line supports:
    #   - multiple glob patterns separated by a semi-colon ';' using fast-glob syntax 
    #     (you must always use forward slash '/' as a directory separator)
    #   - outputing the result in another file adding the output path after an arrow '=>' 
    #     (if the output path is a relative path, it will be relative to the input file)
    #   - wildcard replacement in the output file name using an asterix '*' in the input 
    #     and output file names
    #
    # Example: '**/*.json; !local/ => out/*.json' will match all files ending with '.json' 
    # in all directories and sub directories except in `local` directory and the output 
    # will be in a sub directory `out` relative to the input file keeping the file name.
    #
    # Required.
    sources: ''

    # A JSON serialized object containing the variables values. The object can be:
    #   - an object: properties will be parsed as key/value pairs
    #   - a string starting with '@': value is parsed as a path to a JSON file
    #   - a string starting with '$': value is parsed as an environment variable name 
    #     containing JSON encoded key/value pairs
    #   - an array: each item must be an object or a string and will be parsed as 
    #     specified previously
    #  
    # Multiple entries are merge into a single list of key/value pairs.
    #
    # Example: '[${{ toJSON(vars) }}, ${{ toJSON(secrets) }}]' will pass all defined 
    # variables and secrets.
    #
    # Required.
    variables: ''

    # Add BOM when writing files.
    #
    # Optional. Default: false
    add-bom: ''

    # The characters to escape when using 'custom' escape.
    #
    # Optional.
    chars-to-escape: ''

    # Encoding to read and write all files.
    #
    # Accepted values:
    #   - auto: detect encoding using js-chardet
    #   - any value supported by iconv-lite
    #
    # Optional. Default: auto
    encoding: ''

    # Character escape type to apply on each value.
    #
    # Accepted values:
    #  - auto: automatically apply JSON or XML escape based on file extension
    #  - off: don't escape values
    #  - json: JSON escape
    #  - xml: XML escape
    #  - custom: apply custom escape using escape-char and chars-to-escape
    #
    # Optional. Default: auto
    escape: ''

    # The escape character to use when using custom escape.
    #
    # Optional.
    escape-char: ''

    # The behavior if no files are found.
    #
    # Accepted values:
    #   - ignore: do not output any message, the action do not fail
    #   - warn: output a warning but do not fail the action
    #   - error: fail the action with an error message
    #
    # Optional. Default: ignore
    if-no-files-found: ''

    # The log level.
    #
    # Accepted values:
    #   - debug
    #   - info
    #   - warn
    #   - error
    #
    # Debug messages will always be sent to the internal debug system.
    # Error messages will always fail the action.
    #
    # Optional. Default: info
    log-level: ''

    # The behavior if variable is not found.
    #
    # Accepted values:
    #   - none: replace the token with an empty string and log a message
    #   - keep: leave the token and log a message
    #   - replace: replace with the value from missing-var-default and do not 
    #     log a message
    #
    # Optional. Default: none
    missing-var-action: ''

    # The default value to use when a key is not found.
    #
    # Optional. Default: empty string
    missing-var-default: ''

    # The level to log key not found messages.
    #
    # Accepted values:
    #   - off
    #   - warn
    #   - error
    #
    # Optional. Default: warn
    missing-var-log: ''

    # Enable token replacements in values recusively.
    #
    # Example: '#{message}#' with variables '{"message":"hello #{name}#!","name":"world"}' 
    # will result in 'hello world!'
    #
    # Optional. Default: false
    recursive: ''

    # The root path to use when reading input source files with relative paths.
    #
    # Optional. Default: ${{ github.workspace }}
    root: ''

    # The separtor to use when flattening keys in variables.
    #
    # Example: '{ "key": { "array": ["a1", "a2"], "sub": "s1" } }' will be flatten as 
    # '{ "key.array.0": "a1", "key.array.1": "a2", "key.sub": "s1" }'
    #
    # Optional. Default: .
    separator: ''

    # The token pattern to use.
    #
    # Accepted values:
    #   - default: #{ ... }#
    #   - azurepipelines: $( ... )
    #   - custom: token-prefix ... token-suffix
    #   - doublebraces: {{ ... }}
    #   - doubleunderscores: __ ... __
    #   - githubactions: #{{ ... }}
    #   - octopus: #{ ... }
    #
    # Optional. Default: default
    token-pattern: ''

    # The token prefix when using 'custom' token pattern.
    #
    # Optional.
    token-prefix: ''

    # The token suffix when using 'custom' token pattern.
    #
    # Optional.
    token-suffix: ''

    # Enable transforms on values.
    # The syntax to apply transform on a value is '#{<transform>(<name>[,<parameters>])}#'.
    #
    # Supported transforms:
    #   - base64(name): base64 encode the value
    #   - indent(name[, size, firstline]): indent lines in the value where size is the 
    #     indent size (default is '2') and firstline specifies if the first line must be 
    #     indented also (default is 'false')
    #   - lower(name): lowercase the value
    #   - raw(name): raw value (disable escaping)
    #   - upper(name): uppercase the value
    #
    # Example: 'key=#{upper(KEY1)}#' with '{ "KEY1": "value1" }' will result in 
    # 'key=VALUE1'
    #
    # Optional. Default: false
    transforms: ''

    # The tranforms prefix when using transforms.
    #
    # Optional. Default: (
    transforms-prefix: ''

    # The tranforms prefix when using transforms.
    #
    # Optional. Default: )
    transforms-suffix: ''
```

### Outputs
| Name | Description | Example |
| - | - | - |
| defaults | The number of tokens replaced with the default value if one was specified. | `1` |
| files | The number of source files parsed. | `2` |
| replaced | The number of values replaced by a value different than the default value. | `7` |
| tokens | The number of tokens found in all files. | `8` |
| transforms | The number of transforms applied. | `2` |

## Examples
### Multiple sources
```yaml
- uses: qetza/replacetokens-action@v1
  with:
    sources: |
      **/*.json;!**/*.dev.json;!**/vars.json => _tmp/*.json
      **/*.yml
    variables: '[${{ toJSON(vars) }},${{ toJSON(secrets) }}]' # use variables & secrets
```

### Multiple variables
```yaml
- uses: qetza/replacetokens-action@v1
  with:
    sources: '**/*.yml'
    variables: >
      [
        ${{ toJSON(vars) }},                                                  # variables
        ${{ toJSON(secrets) }},                                               # secrets
        ${{ toJSON(format('@{0}/tests/data/vars.json', github.workspace)) }}, # read from file
        "$ENV_VARS",                                                          # read from env
        { "VAR2": "${{ github.event.inputs.var2 }}" }                         # inline values
      ]
  env:
    ENV_VARS: '{ "VAR4": "env_value4" }'
```

### Access outputs
```yaml
steps:
- uses: qetza/replacetokens-action@v1
  id: replace-tokens
  with:
    sources: '**/*.yml'
    variables: '[${{ toJSON(vars) }},${{ toJSON(secrets) }}]'
- run: |
    echo "defaults  : ${{ steps.replace-tokens.outputs.defaults }}"
    echo "files     : ${{ steps.replace-tokens.outputs.files }}"
    echo "replaced  : ${{ steps.replace-tokens.outputs.replaced }}"
    echo "tokens    : ${{ steps.replace-tokens.outputs.tokens }}"
    echo "transforms: ${{ steps.replace-tokens.outputs.transforms }}"
```