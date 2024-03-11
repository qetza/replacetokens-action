import { ExportResult, ExportResultCode, hrTimeToMilliseconds, hrTimeToNanoseconds } from '@opentelemetry/core';
import { SpanStatusCode, Tracer, Span } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor, SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import * as crypto from 'crypto';
import axios from 'axios';

const application = 'replacetokens-action';
const version = '1.1.0';
const url = 'https://westeurope-5.in.applicationinsights.azure.com/v2/track';
const key = 'e18a8793-c093-46f9-8c3b-433c9553eb7f';
const timeout = 3000;

class ApplicationInsightsExporter implements SpanExporter {
  private readonly _log: (message: string) => void;
  private _isShutdown = false;

  constructor(log: (message: string) => void) {
    this._log = log;
    this._isShutdown = false;
  }

  async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    if (this._isShutdown) {
      setTimeout(() => resultCallback({ code: ExportResultCode.FAILED }), 0);

      return;
    }

    if (spans.length > 0) {
      const events = spans.map(s => this._spanToEvent(s));
      this._log(
        `telemetry: ${JSON.stringify(
          events.map(e => {
            return { ...e, name: '*****', iKey: '*****' };
          })
        )}`
      );

      resultCallback(await this._send(events));
    }

    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    this._isShutdown = true;

    return Promise.resolve();
  }

  private _spanToEvent(span: ReadableSpan): { [key: string]: any } {
    return {
      name: `Microsoft.ApplicationInsights.Dev.${key}.Event`,
      time: new Date(hrTimeToNanoseconds(span.startTime) / 1000000).toISOString(),
      iKey: key,
      tags: {
        'ai.application.ver': version,
        'ai.cloud.role': span.attributes['host'],
        'ai.internal.sdkVersion': 'replacetokens:2.0.0',
        'ai.operation.id': span.spanContext().traceId,
        'ai.operation.name': application,
        'ai.user.accountId': span.attributes['account'],
        'ai.user.authUserId': span.attributes['workflow']
      },
      data: {
        baseType: 'EventData',
        baseData: {
          ver: '2',
          name: 'tokens.replaced',
          properties: {
            ...span.attributes,
            host: undefined,
            account: undefined,
            workflow: undefined,
            result: (() => {
              switch (span.status.code) {
                case SpanStatusCode.ERROR:
                  return 'failed';
                case SpanStatusCode.OK:
                  return 'success';
                default:
                  return '';
              }
            })(),
            duration: hrTimeToMilliseconds(span.duration)
          }
        }
      }
    };
  }

  private async _send(data: any[]): Promise<ExportResult> {
    try {
      const options: axios.AxiosRequestConfig<any[]> = { timeout: timeout };
      await axios.post(url, data, options);

      return { code: ExportResultCode.SUCCESS };
    } catch (e) {
      return { code: ExportResultCode.FAILED };
    }
  }
}

export class TelemetryClient {
  private readonly _provider: BasicTracerProvider;
  private readonly _tracer: Tracer;
  private readonly _account: string;
  private readonly _workflow: string;
  private readonly _host: string;
  private readonly _os: string;

  private _isApplicationInsightsExporterRegistered = false;

  constructor(account?: string, workflow?: string, host?: string, os?: string) {
    this._provider = new BasicTracerProvider({ forceFlushTimeoutMillis: timeout });
    this._tracer = this._provider.getTracer(application, version);
    this._account = crypto
      .createHash('sha256')
      .update(account || '')
      .digest('hex');
    this._workflow = crypto
      .createHash('sha256')
      .update(workflow || '')
      .digest('hex');
    this._host = host || '';
    this._os = os || '';
  }

  startSpan(name: string): Span {
    return this._tracer.startSpan(name, {
      attributes: { account: this._account, workflow: this._workflow, host: this._host, os: this._os }
    });
  }

  useApplicationInsightsExporter(options: { log: (message: string) => void }) {
    if (this._isApplicationInsightsExporterRegistered) return;

    this._provider.addSpanProcessor(new SimpleSpanProcessor(new ApplicationInsightsExporter(options.log)));
    this._isApplicationInsightsExporterRegistered = true;
  }
}
