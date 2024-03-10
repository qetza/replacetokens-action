import * as core from '@actions/core';
import * as path from 'path';
import * as rt from '@qetza/replacetokens';
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
let replaceTokenSpy: jest.SpiedFunction<typeof rt.replaceTokens>;

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
    replaceTokenSpy = jest
      .spyOn(rt, 'replaceTokens')
      .mockImplementation(
        (sources, variables, options) =>
          new Promise<rt.Counter>((resolve, reject) =>
            resolve({ defaults: 1, files: 2, replaced: 3, tokens: 4, transforms: 5 })
          )
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      sources,
      {},
      {
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
        separator: rt.Defaults.Separator,
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
      }
    );
    expect(setOutputSpy).toHaveBeenCalledWith('defaults', 1);
    expect(setOutputSpy).toHaveBeenCalledWith('files', 2);
    expect(setOutputSpy).toHaveBeenCalledWith('replaced', 3);
    expect(setOutputSpy).toHaveBeenCalledWith('tokens', 4);
    expect(setOutputSpy).toHaveBeenCalledWith('transforms', 5);
  });

  it('variables: object', async () => {
    // arrange
    const vars = { VAR1: 'value1', VAR2: 'value2', SECRET1: 'secret1' };
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

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), vars, expect.anything());
  });

  it('variables: array', async () => {
    // arrange
    const vars = { VAR1: 'value1', VAR2: 'value2', SECRET1: 'secret1' };
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

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), vars, expect.anything());
  });

  it('variables: file', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify('@tests/**/*.(json|jsonc|yml|yaml);!**/settings*');
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(debugSpy).toHaveBeenCalledWith(
      `loading variables from file '${path.join(__dirname, 'data/vars.json').replace(/\\/g, '/')}'`
    );
    expect(debugSpy).toHaveBeenCalledWith(
      `loading variables from file '${path.join(__dirname, 'data/vars.jsonc').replace(/\\/g, '/')}'`
    );
    expect(debugSpy).toHaveBeenCalledWith(
      `loading variables from file '${path.join(__dirname, 'data/vars.yml').replace(/\\/g, '/')}'`
    );

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      { VAR3: 'file_value3', VAR4: 'file_value4', VAR5: 'file_value5' },
      expect.anything()
    );
  });

  it('variables: env', async () => {
    // arrange
    jest.replaceProperty(process, 'env', {
      ENV_VARS: `{
      "VAR1": "value1" // inline comment
    }`
    });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify('$ENV_VARS');
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(debugSpy).toHaveBeenCalledWith("loading variables from environment 'ENV_VARS'");

    expect(replaceTokenSpy).toHaveBeenCalledWith(expect.anything(), { VAR1: 'value1' }, expect.anything());
  });

  it('variables: merge', async () => {
    // arrange
    jest.replaceProperty(process, 'env', { ENV_VARS: JSON.stringify({ VAR2: 'env_value2' }) });

    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'variables':
          return JSON.stringify([
            { VAR1: 'value1', VAR2: 'value2', VAR3: 'value3' },
            '$ENV_VARS',
            `@${path.join(__dirname, 'data/vars.jsonc').replace(/\\/g, '/')}`,
            '@**/vars.(yml|yaml)'
          ]);
        default:
          return '';
      }
    });

    // act
    await run();

    // assert
    expect(setFailedSpy).not.toHaveBeenCalled();

    expect(debugSpy).toHaveBeenCalledWith(
      `loading variables from file '${path.join(__dirname, 'data/vars.jsonc').replace(/\\/g, '/')}'`
    );
    expect(debugSpy).toHaveBeenCalledWith(
      `loading variables from file '${path.join(__dirname, 'data/vars.yml').replace(/\\/g, '/')}'`
    );
    expect(debugSpy).toHaveBeenCalledWith("loading variables from environment 'ENV_VARS'");

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      { VAR1: 'value1', VAR2: 'env_value2', VAR3: 'file_value3', VAR5: 'file_value5' },
      expect.anything()
    );
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

    expect(replaceTokenSpy).toHaveBeenCalledWith(
      expect.anything(),
      { VAR1: 'value1', VAR2: 'value2' },
      expect.anything()
    );
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
      expect.anything(),
      expect.objectContaining({ addBOM: true })
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
      expect.anything(),
      expect.objectContaining({ encoding: 'encoding' })
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
      expect.anything(),
      expect.objectContaining({ escape: expect.objectContaining({ chars: 'abcd' }) })
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
      expect.anything(),
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
      expect.anything(),
      expect.objectContaining({ escape: expect.objectContaining({ type: 'json' }) })
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
    expect(startGroupSpy).toHaveBeenCalledWith('group');
    expect(endGroupSpy).toHaveBeenCalled();
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
    expect(startGroupSpy).toHaveBeenCalledWith('group');
    expect(endGroupSpy).toHaveBeenCalled();
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
      expect.anything(),
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
      expect.anything(),
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
      expect.anything(),
      expect.objectContaining({ missing: expect.objectContaining({ log: 'error' }) })
    );
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
      expect.anything(),
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
      expect.anything(),
      expect.objectContaining({ root: 'root' })
    );
  });

  it('separator', async () => {
    // arrange
    getInputSpy.mockImplementation(name => {
      switch (name) {
        case 'separator':
          return ':';
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
      expect.anything(),
      expect.objectContaining({ separator: ':' })
    );
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
      expect.anything(),
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
      expect.anything(),
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
      expect.anything(),
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
      expect.anything(),
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
      expect.anything(),
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
      expect.anything(),
      expect.objectContaining({ transforms: expect.objectContaining({ suffix: ']]' }) })
    );
  });
});
