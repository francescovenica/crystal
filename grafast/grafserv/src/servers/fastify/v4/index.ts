import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PassThrough } from "node:stream";

import {
  convertHandlerResultToResult,
  GrafservBase,
} from "../../../core/base.js";
import type {
  EventStreamHeandlerResult,
  GrafservConfig,
  RequestDigest,
  Result,
} from "../../../interfaces.js";
import { processHeaders } from "../../../utils.js";

declare global {
  namespace Grafserv {
    interface RequestDigestFrameworkMeta {
      fastify: {
        request: FastifyRequest;
        reply: FastifyReply;
      };
    }
  }
}

function getDigest(
  request: FastifyRequest,
  reply: FastifyReply,
): RequestDigest {
  return {
    httpVersionMajor: request.raw.httpVersionMajor,
    httpVersionMinor: request.raw.httpVersionMinor,
    method: request.method,
    path: request.url,
    headers: processHeaders(request.headers),
    getBody(_dynamicOptions) {
      return { type: "json", json: request.body as any };
    },
    frameworkMeta: {
      request,
      reply,
    },
    preferJSON: true,
  };
}

export class FastifyGrafserv extends GrafservBase {
  constructor(config: GrafservConfig) {
    super(config);
  }

  public async send(
    request: FastifyRequest,
    reply: FastifyReply,
    result: Result | null,
  ) {
    if (result === null) {
      // 404
      reply.statusCode = 404;
      return "¯\\_(ツ)_/¯";
    }

    switch (result.type) {
      case "error": {
        const { statusCode, headers } = result;
        reply.headers(headers);
        reply.statusCode = statusCode;
        // TODO: mutating the error is probably bad form...
        const errorWithStatus = Object.assign(result.error, {
          status: statusCode,
        });
        throw errorWithStatus;
      }
      case "buffer": {
        const { statusCode, headers, buffer } = result;
        reply.headers(headers);
        reply.statusCode = statusCode;
        return buffer;
      }
      case "json": {
        const { statusCode, headers, json } = result;
        reply.headers(headers);
        reply.statusCode = statusCode;
        return json;
      }
      case "bufferStream": {
        const { statusCode, headers, lowLatency, bufferIterator } = result;
        if (lowLatency) {
          request.raw.socket.setTimeout(0);
          request.raw.socket.setNoDelay(true);
          request.raw.socket.setKeepAlive(true);
        }
        reply.headers(headers);
        reply.statusCode = statusCode;
        const stream = new PassThrough();
        reply.send(stream);

        // Fork off and convert bufferIterator to
        try {
          for await (const buffer of bufferIterator) {
            stream.write(buffer);
          }
          stream.end();
        } catch (e) {
          try {
            stream.end();
          } catch (e2) {
            /* nom nom nom */
          }
          try {
            // TODO: what should we really do here?
            if (bufferIterator.return) {
              bufferIterator.return();
            } else if (bufferIterator.throw) {
              bufferIterator.throw(e);
            }
          } catch (e2) {
            /* nom nom nom */
          }
        }

        return reply;
      }
      default: {
        const never: never = result;
        console.log("Unhandled:");
        console.dir(never);
        reply.type("text/plain");
        reply.statusCode = 503;
        return "Server hasn't implemented this yet";
      }
    }
  }

  addTo(app: FastifyInstance) {
    app.addContentTypeParser(
      "application/graphql-request+json",
      { parseAs: "string" },
      app.getDefaultJsonParser("ignore", "ignore"),
    );

    const dynamicOptions = this.dynamicOptions;

    app.route({
      // TODO: support GraphQL over GET
      method: "POST",
      url: this.dynamicOptions.graphqlPath,
      bodyLimit: this.dynamicOptions.maxRequestLength,
      handler: async (request, reply) => {
        const digest = getDigest(request, reply);
        if (dynamicOptions.graphiqlOnGraphQLGET) {
          // Consider handling this
        }
        const handlerResult = await this.graphqlHandler(digest);
        const result = await convertHandlerResultToResult(handlerResult);
        return this.send(request, reply, result);
      },
    });

    if (dynamicOptions.graphiql) {
      app.route({
        method: "GET",
        url: this.dynamicOptions.graphiqlPath,
        bodyLimit: this.dynamicOptions.maxRequestLength,
        handler: async (request, reply) => {
          const digest = getDigest(request, reply);
          const handlerResult = await this.graphiqlHandler(digest);
          const result = await convertHandlerResultToResult(handlerResult);
          return this.send(request, reply, result);
        },
      });
    }

    if (dynamicOptions.watch) {
      app.route({
        method: "GET",
        url: this.dynamicOptions.eventStreamRoute,
        bodyLimit: this.dynamicOptions.maxRequestLength,
        handler: async (request, reply) => {
          const digest = getDigest(request, reply);
          // TODO: refactor this to use the eventStreamHandler once we write that...
          const handlerResult: EventStreamHeandlerResult = {
            type: "event-stream",
            request: digest,
            dynamicOptions,
            payload: this.makeStream(),
            statusCode: 200,
          };
          const result = await convertHandlerResultToResult(handlerResult);
          return this.send(request, reply, result);
        },
      });
    }
  }
}

export function grafserv(config: GrafservConfig) {
  return new FastifyGrafserv(config);
}
