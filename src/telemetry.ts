import { ExportResult, ExportResultCode, hrTimeToMilliseconds } from '@opentelemetry/core';
import { SpanStatusCode, Tracer, Span } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor, SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import * as crypto from 'crypto';
import axios from 'axios';

const application = 'replacetokens-action';
const version = '1.0.0';
const endpoint = 'https://insights-collector.eu01.nr-data.net/v1/accounts/4392697/events';
const key = 'eu01xxc28887c2d47d9719ed24a74df5FFFFNRAL';
const timeout = 3000;

class NewRelicExporter implements SpanExporter {
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
      this._log(`telemetry: ${JSON.stringify(events)}`);

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
      eventType: 'TokensReplaced',
      application: application,
      version: version,
      ...span.attributes,
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
    };
  }

  private async _send(data: any[]): Promise<ExportResult> {
    try {
      const options: axios.AxiosRequestConfig<any[]> = {
        headers: {
          'Api-Key': key,
          'Content-Type': 'application/json'
        },
        timeout: timeout
      };
      await axios.post(endpoint, data, options);

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

  private _isEnabled = false;

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
      attributes: { account: this._account, pipeline: this._workflow, host: this._host, os: this._os }
    });
  }

  enableTelemetry(options: { log: (message: string) => void }) {
    if (this._isEnabled) return;

    this._provider.addSpanProcessor(new SimpleSpanProcessor(new NewRelicExporter(options.log)));
    this._isEnabled = true;
  }
}
