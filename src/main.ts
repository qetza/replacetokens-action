import * as core from '@actions/core';
import {
  readTextFile,
  merge,
  replaceTokens,
  Defaults,
  Encodings,
  Escapes,
  MissingVariables,
  Options,
  TokenPatterns
} from '@qetza/replacetokens';
import * as fg from 'fast-glob';
import stripJsonComments from './strip-json-comments';

export async function run(): Promise<void> {
  const _debug = console.debug;
  const _info = console.info;
  const _warn = console.warn;
  const _error = console.error;
  const _group = console.group;
  const _groupEnd = console.groupEnd;

  try {
    // read and validate inputs
    const options: Options = {
      addBOM: core.getBooleanInput('add-bom'),
      encoding: core.getInput('encoding') || Encodings.Auto,
      escape: {
        chars: core.getInput('chars-to-escape'),
        escapeChar: core.getInput('escape-char'),
        type:
          getChoiceInput('escape', [Escapes.Auto, Escapes.Custom, Escapes.Json, Escapes.Off, Escapes.Xml]) ||
          Escapes.Auto
      },
      missing: {
        action:
          getChoiceInput('missing-var-action', [
            MissingVariables.Action.Keep,
            MissingVariables.Action.None,
            MissingVariables.Action.Replace
          ]) || MissingVariables.Action.None,
        default: core.getInput('missing-var-default'),
        log:
          getChoiceInput('missing-var-log', [
            MissingVariables.Log.Error,
            MissingVariables.Log.Off,
            MissingVariables.Log.Warn
          ]) || MissingVariables.Log.Warn
      },
      recursive: core.getBooleanInput('recursive'),
      root: core.getInput('root'),
      separator: core.getInput('separator') || Defaults.Separator,
      token: {
        pattern:
          getChoiceInput('token-pattern', [
            TokenPatterns.AzurePipelines,
            TokenPatterns.Custom,
            TokenPatterns.Default,
            TokenPatterns.DoubleBraces,
            TokenPatterns.DoubleUnderscores,
            TokenPatterns.GithubActions,
            TokenPatterns.Octopus
          ]) || TokenPatterns.Default,
        prefix: core.getInput('token-prefix'),
        suffix: core.getInput('token-suffix')
      },
      transforms: {
        enabled: core.getBooleanInput('transforms'),
        prefix: core.getInput('transforms-prefix') || Defaults.TransformPrefix,
        suffix: core.getInput('transforms-suffix') || Defaults.TransformSuffix
      }
    };

    const sources = core.getMultilineInput('sources', { required: true, trimWhitespace: true });
    const variables = await parseVariables(
      core.getInput('variables', { required: true, trimWhitespace: true }),
      options.root || process.cwd()
    );

    // override console logs
    const logLevel = parseLogLevel(getChoiceInput('log-level', ['debug', 'info', 'warn', 'error']));
    console.debug = function (...args) {
      core.debug(args.join(' ')); // always debug to core

      if (logLevel === LogLevel.Debug) core.info(args.join(' ')); // log as info to be independant of core switch
    };
    console.info = function (...args) {
      if (logLevel < LogLevel.Warn) core.info(args.join(' '));
    };
    console.warn = function (...args) {
      if (logLevel < LogLevel.Error) core.warning(args.join(' '));
    };
    console.error = function (...args) {
      core.setFailed(args.join(' ')); // always set failure on error
    };
    console.group = function (...args) {
      core.startGroup(args.join(' '));
    };
    console.groupEnd = function () {
      core.endGroup();
    };

    // replace tokens
    const result = await replaceTokens(sources, variables, options);

    if (result.files === 0) {
      switch (getChoiceInput('if-no-files-found', ['ignore', 'warn', 'error']) || 'ignore') {
        case 'warn':
          core.warning('No files were found with provided sources.');
        case 'error':
          core.setFailed('No files were found with provided sources.');
        default:
          core.info('No files were found with provided sources.');
      }
    }

    // set outputs
    core.setOutput('defaults', result.defaults);
    core.setOutput('files', result.files);
    core.setOutput('replaced', result.replaced);
    core.setOutput('tokens', result.tokens);
    core.setOutput('transforms', result.transforms);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : `${error}`);
  } finally {
    // restore console logs
    console.debug = _debug;
    console.info = _info;
    console.warn = _warn;
    console.error = _error;
    console.group = _group;
    console.groupEnd = _groupEnd;
  }
}

function getChoiceInput(name: string, choices: string[], options?: core.InputOptions): string {
  const input = core.getInput(name, options).trim();

  if (!input || choices.includes(input)) return input;

  throw new TypeError(`Unsupported value for input: ${name}\nSupport input list: '${choices.join(' | ')}'`);
}

async function parseVariables(input: string, root: string): Promise<{ [key: string]: any }> {
  input = input || '{}';
  const variables = JSON.parse(stripJsonComments(input));

  let load = async (v: any) => {
    if (typeof v === 'string') {
      switch (v[0]) {
        case '@': // single string referencing a file
          return await loadVariablesFromFile(v.substring(1), root);

        case '$': // single string referencing environment variable
          core.debug(`loading variables from environment '${v.substring(1)}'`);

          return JSON.parse(stripJsonComments(process.env[v.substring(1)] || '{}'));

        default: // unsupported
          throw new Error(
            "Unsupported value for: variables\nString values starts with '@' (file path) or '$' (environment variable)"
          );
      }
    }

    return v;
  };

  if (Array.isArray(variables)) {
    // merge inputs
    const vars: { [key: string]: any }[] = [];
    for (let v of variables) {
      vars.push(await load(v));
    }

    return merge(...vars);
  }

  return await load(variables);
}

async function loadVariablesFromFile(name: string, root: string): Promise<{ [key: string]: any }> {
  var files = await fg.glob(
    name.split(';').map(v => v.trim()),
    {
      absolute: true,
      cwd: root,
      onlyFiles: true,
      unique: true
    }
  );

  const vars: { [key: string]: any }[] = [];
  for (const file of files) {
    core.debug(`loading variables from file '${file}'`);

    vars.push(JSON.parse(stripJsonComments((await readTextFile(file)).content || '{}')));
  }

  return merge(...vars);
}

enum LogLevel {
  Debug,
  Info,
  Warn,
  Error
}
function parseLogLevel(level: string): LogLevel {
  switch (level) {
    case 'debug':
      return LogLevel.Debug;
    case 'info':
      return LogLevel.Info;
    case 'warn':
      return LogLevel.Warn;
    case 'error':
      return LogLevel.Error;
    default:
      return LogLevel.Info;
  }
}
