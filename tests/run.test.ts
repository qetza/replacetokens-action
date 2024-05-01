import * as core from '@actions/core';
import * as path from 'path';
import * as rt from '@qetza/replacetokens';
import * as os from 'os';
import axios from 'axios';
import { run } from '../src/main';

let debugSpy: jest.SpiedFunction<typeof core.debug>;
let endGroupSpy: jest.SpiedFunction<typeof core.endGroup>;
let getBooleanInputSpy: jest.SpiedFunction<typeof core.getBooleanInput>;
let getInputSpy: jest.SpiedFunction<typeof core.getInput>;
let getMultilineInputSpy: jest.SpiedFunction<typeof core.getMultilineInput>;
let infoSpy: jest.SpiedFunction<typeof core.info>;
let setFailedSpy: jest.SpiedFunction<typeof core.setFailed>;
let setOutputSpy: jest.SpiedFunction<typeof core.setOutput>;
let startGroupSpy: jest.SpiedFunction<typeof core.startGroup>;
let warningSpy: jest.SpiedFunction<typeof core.warning>;
let loadVariablesSpy: jest.SpiedFunction<typeof rt.loadVariables>;
let replaceTokenSpy: jest.SpiedFunction<typeof rt.replaceTokens>;
let postSpy: jest.SpiedFunction<typeof axios.post>;

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env['GITHUB_REPOSITORY'] = 'qetza/local';
    process.env['GITHUB_WORKFLOW'] = 'tests';
    process.env['GITHUB_SERVER_URL'] = 'https://localhost';
    process.env['RUNNER_OS'] = 'Windows';

    debugSpy = jest.spyOn(core, 'debug').mockImplementation();
    endGroupSpy = jest.spyOn(core, 'endGroup').mockImplementation();
    getBooleanInputSpy = jest.spyOn(core, 'getBooleanInput').mockImplementation(_ => false);
    getInputSpy = jest.spyOn(core, 'getInput').mockImplementation(_ => '');
    getMultilineInputSpy = jest.spyOn(core, 'getMultilineInput').mockImplementation(_ => []);
    infoSpy = jest.spyOn(core, 'info').mockImplementation();
    setFailedSpy = jest.spyOn(core, 'setFailed').mockImplementation();
    setOutputSpy = jest.spyOn(core, 'setOutput').mockImplementation();
    startGroupSpy = jest.spyOn(core, 'startGroup').mockImplementation();
    warningSpy = jest.spyOn(core, 'warning').mockImplementation();
    loadVariablesSpy = jest.spyOn(rt, 'loadVariables').mockResolvedValue({});
    replaceTokenSpy = jest
      .spyOn(rt, 'replaceTokens')
      .mockResolvedValue({ defaults: 1, files: 2, replaced: 3, tokens: 4, transforms: 5 });
    postSpy = jest.spyOn(axios, 'post').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();

    delete process.env['GITHUB_REPOSITORY'];
    delete process.env['GITHUB_WORKFLOW'];
    delete process.env['GITHUB_SERVER_URL'];
    delete process.env['RUNNER_OS'];
    delete process.env['REPLACETOKENS_TELEMETRY_OPTOUT'];
  });

  it('validate: sources', async () => {
    // arrange
    getMultilineInputSpy.mockImplementation(name => {
      throw new Error(`Input required and not supplied: ${name}`);
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith('Input required and not supplied: sources');
  });

  it('validate: variables', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      if (name !== 'variables') return '';

      throw new Error(`Input required and not supplied: ${name}`);
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith('Input required and not supplied: variables');
  });

  it('validate: escape', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'escape':
          return 'unsupported';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith(
      "Unsupported value for input: escape\nSupport input list: 'auto | custom | json | off | xml'"
    );
  });

  it('validate: missing-var-action', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return '*.json';
        case 'missing-var-action':
          return 'unsupported';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith(
      "Unsupported value for input: missing-var-action\nSupport input list: 'keep | none | replace'"
    );
  });

  it('validate: missing-var-log', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return '*.json';
        case 'missing-var-log':
          return 'unsupported';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith(
      "Unsupported value for input: missing-var-log\nSupport input list: 'error | off | warn'"
    );
  });

  it('validate: token-pattern', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return '*.json';
        case 'token-pattern':
          return 'unsupported';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalledWith(
      "Unsupported value for input: token-pattern\nSupport input list: 'azpipelines | custom | default | doublebraces | doubleunderscores | githubactions | octopus'"
    );
  });

  it('default', async () => {
    // arrange
    const sources = ['**/*.json; !**/*.dev.json => _out/*.json', '**/*.xml; !**/*.dev.xml => _out/*.xml'];

    getMultilineInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return sources;
        default:
          return [];
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(loadVariablesSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(sources, expect.any(Function), {
      addBOM: false,
      encoding: rt.Encodings.Auto,
      escape: {
        chars: '',
        escapeChar: '',
        type: rt.Escapes.Auto
      },
      missing: {
        action: rt.MissingVariables.Action.None,
        default: '',
        log: rt.MissingVariables.Log.Warn
      },
      recursive: false,
      root: '',
      sources: {
        caseInsensitive: false,
        dot: false
      },
      token: {
        pattern: rt.TokenPatterns.Default,
        prefix: '',
        suffix: ''
      },
      transforms: {
        enabled: false,
        prefix: rt.Defaults.TransformPrefix,
        suffix: rt.Defaults.TransformSuffix
      }
    });
    expect(setOutputSpy).toHaveBeenCalledWith('defaults', 1);
    expect(setOutputSpy).toHaveBeenCalledWith('files', 2);
    expect(setOutputSpy).toHaveBeenCalledWith('replaced', 3);
    expect(setOutputSpy).toHaveBeenCalledWith('tokens', 4);
    expect(setOutputSpy).toHaveBeenCalledWith('transforms', 5);
  });

  it('telemetry: success', async () => {
    // arrange
    const sources = ['**/*.json', '**/*.xml', '**/*.yml'];
    getMultilineInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return sources;
        default:
          return [];
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(postSpy).toHaveBeenCalled();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[\{"eventType":"TokensReplaced","application":"replacetokens-action","version":"1\.\d+\.\d+","account":"c054bf9f6127dc352a184a29403ac9114f6c2a8e27cb467197cdfc1c3df119e4","pipeline":"59830ebc3a4184110566bf1a290d08473dfdcbd492ce498b14cd1a5e2fa2e441","host":"server","os":"Windows","sources":3,"add-bom":false,"case-insensitive-paths":false,"chars-to-escape":"","encoding":"auto","escape":"auto","escape-char":"","if-no-files-found":"ignore","include-dot-paths":false,"log-level":"info","missing-var-action":"none","missing-var-default":"","missing-var-log":"warn","recusrive":false,"separator":"\.","token-pattern":"default","token-prefix":"","token-suffix":"","transforms":false,"transforms-prefix":"\(","transforms-suffix":"\)","variable-files":0,"variable-envs":0,"inline-variables":0,"output-defaults":1,"output-files":2,"output-replaced":3,"output-tokens":4,"output-transforms":5,"result":"success","duration":\d+(?:\.\d+)?}]/
      )
    );
  });

  it('telemetry: failure', async () => {
    // arrange
    getMultilineInputSpy.mockImplementation(name => {
      throw new Error(`Input required and not supplied: ${name}`);
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).toHaveBeenCalled();

    expect(postSpy).toHaveBeenCalled();

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[\{"eventType":"TokensReplaced","application":"replacetokens-action","version":"1\.\d+\.\d+","account":"c054bf9f6127dc352a184a29403ac9114f6c2a8e27cb467197cdfc1c3df119e4","pipeline":"59830ebc3a4184110566bf1a290d08473dfdcbd492ce498b14cd1a5e2fa2e441","host":"server","os":"Windows","result":"failed","duration":\d+(?:\.\d+)?}]/
      )
    );
  });

  it('sources: normalize', async () => {
    // arrange
    const source = path.join(__dirname, 'data', 'vars.json').replace(/\//g, '\\');
    getMultilineInputSpy.mockImplementation(name => {
      switch (name) {
        case 'sources':
          return [source];
        default:
          return [];
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    if (os.platform() === 'win32') {
      expect(replaceTokenSpy).toHaveBeenCalledWith(
        [source.replace(/\\/g, '/')],
        expect.any(Function),
        expect.anything()
      );
    } else {
      expect(replaceTokenSpy).toHaveBeenCalledWith([source], expect.any(Function), expect.anything());
    }
  });

  it('variables: object', async () => {
    // arrange
    const vars = { var1: 'value1', var2: 'value2', SECRET1: 'secret1' };
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify(vars);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith([JSON.stringify(vars)], {
      separator: rt.Defaults.Separator,
      normalizeWin32: true,
      root: '',
      caseInsensitive: false,
      dot: false
    });

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('variables: array', async () => {
    // arrange
    const vars = { var1: 'value1', var2: 'value2', SECRET1: 'secret1' };
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify([vars]);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith([JSON.stringify(vars)], {
      separator: rt.Defaults.Separator,
      normalizeWin32: true,
      root: '',
      caseInsensitive: false,
      dot: false
    });

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('variables: file', async () => {
    // arrange
    const vars = '@tests/**/*.(json|jsonc|yml|yaml);!**/settings*';
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify(vars);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith([vars], {
      separator: rt.Defaults.Separator,
      normalizeWin32: true,
      root: '',
      caseInsensitive: false,
      dot: false
    });

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('variables: env', async () => {
    // arrange
    const vars = '$ENV_VARS';
    jest.replaceProperty(process, 'env', {
      ENV_VARS: `{
      "var1": "value1" // inline comment
    }`
    });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify(vars);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith([vars], {
      separator: rt.Defaults.Separator,
      normalizeWin32: true,
      root: '',
      caseInsensitive: false,
      dot: false
    });

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('variables: merge', async () => {
    // arrange
    const vars = [
      { VAR1: 'value1', VAR2: 'value2', var3: 'value3' },
      [1, true, { var6: 'value6' }],
      '$ENV_VARS',
      `@${path.join(__dirname, 'data/vars.jsonc').replace(/\\/g, '/')}`,
      '@**/vars.(yml|yaml)'
    ];
    jest.replaceProperty(process, 'env', { ENV_VARS: JSON.stringify({ var2: 'env_value2' }) });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify(vars);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith(
      [JSON.stringify(vars[0]), JSON.stringify(vars[1]), vars[2], vars[3], vars[4]],
      {
        separator: rt.Defaults.Separator,
        normalizeWin32: true,
        root: '',
        caseInsensitive: false,
        dot: false
      }
    );

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('variables: comments', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return `{
            "VAR1": "value1", // inline comment
            "VAR2": "value2" /* block comment */
            /* multiline comment
            "VAR3": "value3"
            */
          }`;
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith([JSON.stringify({ VAR1: 'value1', VAR2: 'value2' })], {
      separator: rt.Defaults.Separator,
      normalizeWin32: true,
      root: '',
      caseInsensitive: false,
      dot: false
    });

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('add-bom', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'add-bom':
          return true;
        default:
          return false;
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ addBOM: true })
    );
  });

  it('case-insensitive-paths', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'case-insensitive-paths':
          return true;
        default:
          return false;
      }
    });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return '{}';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ caseInsensitive: true })
    );

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ sources: expect.objectContaining({ caseInsensitive: true }) })
    );
  });

  it('chars-to-escape', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'chars-to-escape':
          return 'abcd';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ chars: 'abcd' }) })
    );
  });

  it('encoding', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'encoding':
          return 'encoding';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ encoding: 'encoding' })
    );
  });

  it('escape-char', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'escape-char':
          return '/';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ escapeChar: '/' }) })
    );
  });

  it('escape', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'escape':
          return 'json';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ escape: expect.objectContaining({ type: 'json' }) })
    );
  });

  it('include-dot-paths', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'include-dot-paths':
          return true;
        default:
          return false;
      }
    });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return '{}';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dot: true }));

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ sources: expect.objectContaining({ dot: true }) })
    );
  });

  it('log-level: debug', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'log-level':
          return 'debug';
        default:
          return '';
      }
    });

    replaceTokenSpy.mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    // act
    await run();

    // assert
    expect(debugSpy).toHaveBeenCalledWith('debug');
    expect(infoSpy).toHaveBeenCalledWith('debug');
    expect(infoSpy).toHaveBeenCalledWith('info');
    expect(warningSpy).toHaveBeenCalledWith('warn');
    expect(setFailedSpy).toHaveBeenCalledWith('error');
    expect(startGroupSpy).toHaveBeenCalledWith('group');
    expect(endGroupSpy).toHaveBeenCalled();
  });

  it('log-level: info', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'log-level':
          return 'info';
        default:
          return '';
      }
    });

    replaceTokenSpy.mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    // act
    await run();

    // assert
    expect(debugSpy).toHaveBeenCalledWith('debug');
    expect(infoSpy).not.toHaveBeenCalledWith('debug');
    expect(infoSpy).toHaveBeenCalledWith('info');
    expect(warningSpy).toHaveBeenCalledWith('warn');
    expect(setFailedSpy).toHaveBeenCalledWith('error');
    expect(startGroupSpy).toHaveBeenCalledWith('group');
    expect(endGroupSpy).toHaveBeenCalled();
  });

  it('log-level: warn', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'log-level':
          return 'warn';
        default:
          return '';
      }
    });

    replaceTokenSpy.mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    // act
    await run();

    // assert
    expect(debugSpy).toHaveBeenCalledWith('debug');
    expect(infoSpy).not.toHaveBeenCalledWith('debug');
    expect(infoSpy).not.toHaveBeenCalledWith('info');
    expect(warningSpy).toHaveBeenCalledWith('warn');
    expect(setFailedSpy).toHaveBeenCalledWith('error');
    expect(startGroupSpy).not.toHaveBeenCalledWith('group');
    expect(endGroupSpy).not.toHaveBeenCalled();
  });

  it('log-level: error', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'log-level':
          return 'error';
        default:
          return '';
      }
    });

    replaceTokenSpy.mockImplementation((sources, variables, options) => {
      return new Promise((resolve, reject) => {
        console.debug('debug');
        console.info('info');
        console.warn('warn');
        console.error('error');
        console.group('group');
        console.groupEnd();

        resolve({ defaults: 1, files: 1, replaced: 1, tokens: 1, transforms: 1 });
      });
    });

    // act
    await run();

    // assert
    expect(debugSpy).toHaveBeenCalledWith('debug');
    expect(infoSpy).not.toHaveBeenCalledWith('debug');
    expect(infoSpy).not.toHaveBeenCalledWith('info');
    expect(warningSpy).not.toHaveBeenCalledWith('warn');
    expect(setFailedSpy).toHaveBeenCalledWith('error');
    expect(startGroupSpy).not.toHaveBeenCalledWith('group');
    expect(endGroupSpy).not.toHaveBeenCalled();
  });

  it('missing-var-action', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'missing-var-action':
          return 'keep';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ action: 'keep' }) })
    );
  });

  it('missing-var-default', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'missing-var-default':
          return 'default';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ default: 'default' }) })
    );
  });

  it('missing-var-log', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'missing-var-log':
          return 'error';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ missing: expect.objectContaining({ log: 'error' }) })
    );
  });

  it('no-telemetry: input', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'no-telemetry':
          return true;
        default:
          return false;
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(postSpy).not.toHaveBeenCalled();

    expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('telemetry: '));
  });

  it('no-telemetry: REPLACETOKENS_TELEMETRY_OPTOUT=1', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => false);

    process.env['REPLACETOKENS_TELEMETRY_OPTOUT'] = '1';

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(postSpy).not.toHaveBeenCalled();

    expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('telemetry: '));
  });

  it('no-telemetry: REPLACETOKENS_TELEMETRY_OPTOUT=true', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => false);

    process.env['REPLACETOKENS_TELEMETRY_OPTOUT'] = 'true';

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(postSpy).not.toHaveBeenCalled();

    expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('telemetry: '));
  });

  it('recursive', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'recursive':
          return true;
        default:
          return false;
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ recursive: true })
    );
  });

  it('root', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'root':
          return 'root';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ root: 'root' })
    );
  });

  it('separator', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'separator':
          return ':';
        case 'variables':
          return '{}';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(loadVariablesSpy).toHaveBeenCalledWith(['{}'], expect.objectContaining({ separator: ':' }));

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.anything());
  });

  it('token-pattern', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'token-pattern':
          return 'octopus';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ pattern: 'octopus' }) })
    );
  });

  it('token-prefix', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'token-prefix':
          return '[[';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ prefix: '[[' }) })
    );
  });

  it('token-suffix', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'token-suffix':
          return ']]';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ token: expect.objectContaining({ suffix: ']]' }) })
    );
  });

  it('transforms', async () => {
    // arrange
    getBooleanInputSpy.mockImplementation(name => {
      switch (name) {
        case 'transforms':
          return true;
        default:
          return false;
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ enabled: true }) })
    );
  });

  it('transforms-prefix', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'transforms-prefix':
          return '[[';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ prefix: '[[' }) })
    );
  });

  it('transforms-suffix', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'transforms-suffix':
          return ']]';
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ transforms: expect.objectContaining({ suffix: ']]' }) })
    );
  });
});
