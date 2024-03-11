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
import * as path from 'path';
import * as yaml from 'js-yaml';
import stripJsonComments from './strip-json-comments';
import { TelemetryClient } from './telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

export async function run(): Promise<void> {
  const _debug = console.debug;
  const _info = console.info;
  const _warn = console.warn;
  const _error = console.error;
  const _group = console.group;
  const _groupEnd = console.groupEnd;

  const telemetry = new TelemetryClient(
    process.env['GITHUB_REPOSITORY'],
    process.env['GITHUB_WORKFLOW'],
    process.env['GITHUB_SERVER_URL'] === 'https://github.com' ? 'cloud' : 'server',
    process.env['RUNNER_OS']
  );

  if (
    !core.getBooleanInput('no-telemetry') &&
    !['true', '1'].includes(process.env['REPLACETOKENS_TELEMETRY_OPTOUT'] || '')
  ) {
    telemetry.useApplicationInsightsExporter({ log: core.debug });
  }

  const telemetryEvent = telemetry.startSpan('run');

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

    const ifNoFilesFound = getChoiceInput('if-no-files-found', ['ignore', 'warn', 'error']) || 'ignore';
    const logLevelStr = getChoiceInput('log-level', ['debug', 'info', 'warn', 'error']) || 'info';

    // set telemetry attributes
    telemetryEvent.setAttributes({
      sources: sources.length,
      'add-bom': options.addBOM,
      'chars-to-escape': options.escape!.chars,
      encoding: options.encoding,
      escape: options.escape!.type,
      'escape-char': options.escape!.escapeChar,
      'if-no-files-found': ifNoFilesFound,
      'log-level': logLevelStr,
      'missing-var-action': options.missing!.action,
      'missing-var-default': options.missing!.default,
      'missing-var-log': options.missing!.log,
      recusrive: options.recursive,
      separator: options.separator,
      'token-pattern': options.token!.pattern,
      'token-prefix': options.token!.prefix,
      'token-suffix': options.token!.suffix,
      transforms: options.transforms!.enabled,
      'transforms-prefix': options.transforms!.prefix,
      'transforms-suffix': options.transforms!.suffix,
      'variable-files': variableFilesCount,
      'variable-envs': variablesEnvCount,
      'inline-variables': inlineVariablesCount
    });

    // override console logs
    const logLevel = parseLogLevel(logLevelStr);
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
      if (logLevel < LogLevel.Warn) core.startGroup(args.join(' '));
    };
    console.groupEnd = function () {
      if (logLevel < LogLevel.Warn) core.endGroup();
    };

    // replace tokens
    const result = await replaceTokens(sources, variables, options);

    if (result.files === 0) {
      switch (ifNoFilesFound) {
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

    telemetryEvent.setAttributes({
      'output-defaults': result.defaults,
      'output-files': result.files,
      'output-replaced': result.replaced,
      'output-tokens': result.tokens,
      'output-transforms': result.transforms
    });

    telemetryEvent.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    telemetryEvent.setStatus({ code: SpanStatusCode.ERROR });

    core.setFailed(error instanceof Error ? error.message : `${error}`);
  } finally {
    telemetryEvent.end();

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

var variablesEnvCount = 0;
var inlineVariablesCount = 0;
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

          ++variablesEnvCount;

          return JSON.parse(stripJsonComments(process.env[v.substring(1)] || '{}'));

        default: // unsupported
          throw new Error(
            "Unsupported value for: variables\nString values starts with '@' (file path) or '$' (environment variable)"
          );
      }
    }

    inlineVariablesCount += Object.keys(v).length;

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

var variableFilesCount = 0;
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

    const content = (await readTextFile(file)).content;

    if (['.yml', '.yaml'].includes(path.extname(file).toLowerCase())) {
      yaml.loadAll(content, (v: any) => {
        vars.push(v);
      });
    } else {
      vars.push(JSON.parse(stripJsonComments(content || '{}')));
    }

    ++variableFilesCount;
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
