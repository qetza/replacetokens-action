import * as core from '@actions/core';
import * as rt from '@qetza/replacetokens';
import * as os from 'os';
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
    telemetry.enableTelemetry({ log: core.debug });
  }

  const telemetryEvent = telemetry.startSpan('run');

  try {
    // read and validate inputs
    const options: rt.Options = {
      addBOM: core.getBooleanInput('add-bom'),
      encoding: core.getInput('encoding') || rt.Encodings.Auto,
      escape: {
        chars: core.getInput('chars-to-escape'),
        escapeChar: core.getInput('escape-char'),
        type:
          getChoiceInput('escape', [
            rt.Escapes.Auto,
            rt.Escapes.Custom,
            rt.Escapes.Json,
            rt.Escapes.Off,
            rt.Escapes.Xml
          ]) || rt.Escapes.Auto
      },
      missing: {
        action:
          getChoiceInput('missing-var-action', [
            rt.MissingVariables.Action.Keep,
            rt.MissingVariables.Action.None,
            rt.MissingVariables.Action.Replace
          ]) || rt.MissingVariables.Action.None,
        default: core.getInput('missing-var-default'),
        log:
          getChoiceInput('missing-var-log', [
            rt.MissingVariables.Log.Error,
            rt.MissingVariables.Log.Off,
            rt.MissingVariables.Log.Warn
          ]) || rt.MissingVariables.Log.Warn
      },
      recursive: core.getBooleanInput('recursive'),
      root: core.getInput('root'),
      token: {
        pattern:
          getChoiceInput('token-pattern', [
            rt.TokenPatterns.AzurePipelines,
            rt.TokenPatterns.Custom,
            rt.TokenPatterns.Default,
            rt.TokenPatterns.DoubleBraces,
            rt.TokenPatterns.DoubleUnderscores,
            rt.TokenPatterns.GithubActions,
            rt.TokenPatterns.Octopus
          ]) || rt.TokenPatterns.Default,
        prefix: core.getInput('token-prefix'),
        suffix: core.getInput('token-suffix')
      },
      transforms: {
        enabled: core.getBooleanInput('transforms'),
        prefix: core.getInput('transforms-prefix') || rt.Defaults.TransformPrefix,
        suffix: core.getInput('transforms-suffix') || rt.Defaults.TransformSuffix
      }
    };

    const sources = getSources();
    const ifNoFilesFound = getChoiceInput('if-no-files-found', ['ignore', 'warn', 'error']) || 'ignore';
    const logLevelStr = getChoiceInput('log-level', ['debug', 'info', 'warn', 'error']) || 'info';

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

    // load variables
    const separator = core.getInput('separator') || rt.Defaults.Separator;
    const variables = await getVariables(options.root, separator);

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
      separator: separator,
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

    // replace tokens
    const result = await rt.replaceTokens(sources, (name: string) => variables[name], options);

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

function getSources(): string[] {
  const sources = core.getMultilineInput('sources', { required: true, trimWhitespace: true });

  // make sources compatible with fast-glob on win32
  if (os.platform() === 'win32') {
    for (const i in sources) {
      sources[i] = sources[i].replace(/\\/g, '/');
    }
  }

  return sources;
}

var variableFilesCount = 0;
var variablesEnvCount = 0;
var inlineVariablesCount = 0;
async function getVariables(root?: string, separator?: string): Promise<{ [key: string]: string }> {
  const input = core.getInput('variables', { required: true, trimWhitespace: true }) || '';
  if (!input) return {};

  return await rt.loadVariables(getVariablesFromJson(input), {
    normalizeWin32: true,
    root: root,
    separator: separator
  });
}

function getVariablesFromJson(input: string): string[] {
  const variables = JSON.parse(stripJsonComments(input));
  const parse = (v: any): string => {
    if (typeof v === 'string') {
      switch (v[0]) {
        case '@': // single string referencing a file
          ++variableFilesCount;
          return v;

        case '$': // single string referencing environment variable
          ++variablesEnvCount;
          return v;

        default: // unsupported
          throw new Error(
            "Unsupported value for: variables\nString values starts with '@' (file path) or '$' (environment variable)"
          );
      }
    }

    inlineVariablesCount += Object.keys(v).length;

    return JSON.stringify(v);
  };

  if (Array.isArray(variables)) {
    // merge inputs
    const vars: string[] = [];
    for (let v of variables) {
      vars.push(parse(v));
    }

    return vars;
  }

  return [parse(variables)];
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
