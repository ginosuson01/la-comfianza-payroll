import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

interface HttpRequestInfo {
  method?: string;
  originalUrl?: string;
  url?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequestInfo>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const responseMessage = (
          response as {
            message?: string | string[];
          }
        ).message;

        if (responseMessage) {
          message = responseMessage;
        }
      }
    } else {
      this.logger.error(
        'Unhandled application exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const path = request.originalUrl ?? request.url ?? 'UNKNOWN';

    const responseBody = {
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path,
      method: request.method ?? 'UNKNOWN',
    };

    httpAdapter.reply(context.getResponse(), responseBody, statusCode);
  }
}
