import { describe, expect, it } from 'vitest'

import {
  REQUEST_DELAY,
  delayRequest,
  getApp,
  getRequestHandler,
} from './utils/fastify'
import { sleep } from './utils/general'

describe('fastify', async () => {
  it('request context contains proper helpers', async () => {
    const { fastify, assertionError } = await getApp()

    fastify.get(
      '/one',
      getRequestHandler((request, reply) => {
        expect(request).toBeDefined()
        expect(request.reqCooldownResolve).toBeDefined()
        expect(typeof request.reqCooldownResolve).toEqual('function')
        expect(request.reqCooldownTimedOut).toBeUndefined()
        reply.send()
      })
    )
    await fastify.ready()

    const response = await fastify.inject({ method: 'GET', path: '/one' })

    if (assertionError.error) throw assertionError.error
    expect(response.statusCode).toEqual(200)
  })

  it('requests to same path should be cached but to different paths should not be cached', async () => {
    const { fastify, assertionError } = await getApp()

    fastify.get('/one', getRequestHandler())
    fastify.get('/two', getRequestHandler())
    await fastify.ready()

    const [response1, response2, response22] = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-request-id': '1' },
      }),
      fastify.inject({
        method: 'GET',
        path: '/two',
        headers: { 'x-request-id': '2' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/two',
          headers: { 'x-request-id': '3' },
        })
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(response1.body).toEqual('1')
    expect(response2.body).toEqual('2')
    expect(response22.body).toEqual('2')
  })

  it('requests promise should be only cached while it is in progress', async () => {
    const { fastify, assertionError } = await getApp()

    fastify.get('/one', getRequestHandler())

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-request-id': '1' },
      }),
      delayRequest(REQUEST_DELAY / 2, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-request-id': '2' },
        })
      ),
      delayRequest(REQUEST_DELAY * 1.5, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-request-id': '3' },
        })
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('1')
    expect(responses[2].body).toEqual('3')
  })

  it('reqCooldownTimedOut should not be added to context on timeout if there was no repeated request', async () => {
    const { fastify, assertionError } = await getApp({
      timeout: REQUEST_DELAY / 2,
    })

    fastify.get(
      '/one',
      getRequestHandler(
        // Before delay: Verify reqCooldownTimedOut is undefined initially
        (request) => {
          expect(request.reqCooldownTimedOut).toBeUndefined()
        },
        // After delay: Verify reqCooldownTimedOut is still undefined
        (request) => {
          expect(request.reqCooldownTimedOut).toBeUndefined()
        }
      )
    )
    await fastify.ready()

    const response = await fastify.inject({ method: 'GET', path: '/one' })

    if (assertionError.error) throw assertionError.error
    expect(response.statusCode).toEqual(200)
  })

  it('timeout should fire when there is other request waiting for response', async () => {
    let timedOut = false

    const { fastify, assertionError } = await getApp({
      timeout: REQUEST_DELAY / 2,
      onTimeout: (req, reply) => {
        timedOut = true
        reply.send('timeout')
      },
    })

    fastify.get(
      '/one',
      getRequestHandler(
        // Before delay: Verify reqCooldownTimedOut is undefined initially
        (request) => {
          expect(request.reqCooldownTimedOut).toBeUndefined()
        },
        // After delay: Verify reqCooldownTimedOut is set to true
        (request) => {
          expect(request.reqCooldownTimedOut).toEqual(true)
        }
      )
    )

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-request-id': '1' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-request-id': '2' },
        })
      ),
    ])

    expect(timedOut).toEqual(true)

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('timeout')
  })

  it('should not cache same path requests from different ip addresses', async () => {
    const { fastify, assertionError } = await getApp()

    fastify.get('/one', getRequestHandler())

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        remoteAddress: '10.0.0.101',
        headers: { 'x-request-id': '1' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          remoteAddress: '10.0.0.101',
          headers: { 'x-request-id': '2' },
        })
      ),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          remoteAddress: '10.0.0.102',
          headers: { 'x-request-id': '3' },
        })
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('1')
    expect(responses[2].body).toEqual('3')
  })

  it('should not cache same path requests for different users', async () => {
    const { fastify, assertionError } = await getApp({
      getUserKey: (req) => JSON.stringify({ id: req.headers['x-user-id'] }),
    })

    fastify.get('/one', getRequestHandler())

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-user-id': '1', 'x-request-id': '1' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-user-id': '1', 'x-request-id': '2' },
        })
      ),
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-user-id': '2', 'x-request-id': '3' },
      }),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('1')
    expect(responses[2].body).toEqual('3')
  })

  it('should continue with original request handler if badReply callback does not send reply', async () => {
    const { fastify, assertionError } = await getApp({
      onBadReply: () => {
        /** Empty callback for testing */
      },
    })

    fastify.get(
      '/one',
      getRequestHandler((request, reply) => {
        if (request.headers['x-request-id'] === 'badReply') {
          reply.statusCode = 418
          reply.send("I'm a teapot")
        }
      })
    )
    fastify.get(
      '/two',
      getRequestHandler((request, reply) => {
        if (request.headers['x-request-id'] === 'badReply') {
          reply.statusCode = 404
          reply.send({ badReply: true })
        }
      })
    )

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-request-id': 'badReply' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-request-id': '2' },
        })
      ),
      fastify.inject({
        method: 'GET',
        path: '/two',
        headers: { 'x-request-id': 'badReply' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/two',
          headers: { 'x-request-id': '2' },
        })
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].statusCode).toEqual(418)
    expect(responses[1].statusCode).toEqual(200)
    expect(responses[0].body).toEqual("I'm a teapot")
    expect(responses[1].body).toEqual('2')
    expect(responses[0].headers['content-type']).toMatch(/^text\/plain/)
    expect(responses[1].headers['content-type']).toEqual(
      responses[0].headers['content-type']
    )

    expect(responses[2].statusCode).toEqual(404)
    expect(responses[3].statusCode).toEqual(200)
    expect(JSON.parse(responses[2].body)).toMatchObject({ badReply: true })
    expect(responses[3].body).toEqual('2')
    expect(responses[2].headers['content-type']).toMatch(/^application\/json/)
    expect(responses[3].headers['content-type']).toMatch(/^text\/plain/)
  })

  it('should respond with reply made in badReply callback', async () => {
    const { fastify, assertionError } = await getApp({
      onBadReply: (req, reply) => {
        reply.statusCode = 400
        reply.send('badReply')
      },
    })

    fastify.get(
      '/one',
      getRequestHandler(async (request, reply) => {
        if (request.headers['x-request-id'] === 'badReply') {
          await sleep(REQUEST_DELAY / 2)
          reply.statusCode = 418
          reply.send("I'm a teapot")
          return
        }
      })
    )
    fastify.get(
      '/two',
      getRequestHandler(async (request, reply) => {
        if (request.headers['x-request-id'] === 'badReply') {
          await sleep(REQUEST_DELAY / 2)
          reply.statusCode = 404
          reply.send({ badReply: true })
          return
        }
      })
    )

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: { 'x-request-id': 'badReply' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: { 'x-request-id': '2' },
        })
      ),
      fastify.inject({
        method: 'GET',
        path: '/two',
        headers: { 'x-request-id': 'badReply' },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'GET',
          path: '/two',
          headers: { 'x-request-id': '2' },
        })
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].statusCode).toEqual(418)
    expect(responses[1].statusCode).toEqual(400)
    expect(responses[0].body).toEqual("I'm a teapot")
    expect(responses[1].body).toEqual('badReply')
    expect(responses[0].headers['content-type']).toMatch(/^text\/plain/)
    expect(responses[1].headers['content-type']).toEqual(
      responses[0].headers['content-type']
    )

    expect(responses[2].statusCode).toEqual(404)
    expect(responses[3].statusCode).toEqual(400)
    expect(JSON.parse(responses[2].body)).toMatchObject({ badReply: true })
    expect(responses[3].body).toEqual('badReply')
    expect(responses[2].headers['content-type']).toMatch(/^application\/json/)
    expect(responses[3].headers['content-type']).toMatch(/^text\/plain/)
  })

  it('should not cache POST requests by default', async () => {
    const { fastify, assertionError } = await getApp()

    fastify.post('/one', getRequestHandler())

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'POST',
        path: '/one',
        payload: { foo: 'bar' },
        headers: {
          'x-request-id': '1',
          'content-type': 'application/json',
        },
      }),
      fastify.inject({
        method: 'POST',
        path: '/one',
        payload: { foo: 'bar' },
        headers: {
          'x-request-id': '2',
          'content-type': 'application/json',
        },
      }),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('2')
  })

  it('should cache POST requests if configured and take into account request body', async () => {
    const { fastify, assertionError } = await getApp({ methods: ['POST'] })

    fastify.post('/one', getRequestHandler())

    await fastify.ready()

    const responses = await Promise.all([
      fastify.inject({
        method: 'POST',
        path: '/one',
        payload: { foo: 'bar' },
        headers: {
          'x-request-id': '1',
          'content-type': 'application/json',
        },
      }),
      delayRequest(REQUEST_DELAY / 4, () =>
        fastify.inject({
          method: 'POST',
          path: '/one',
          payload: { foo: 'bar' },
          headers: {
            'x-request-id': '2',
            'content-type': 'application/json',
          },
        })
      ),
      fastify.inject({
        method: 'POST',
        path: '/one',
        payload: { foo: 'baz' },
        headers: {
          'x-request-id': '3',
          'content-type': 'application/json',
        },
      }),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].body).toEqual('1')
    expect(responses[1].body).toEqual('1')
    expect(responses[2].body).toEqual('3')
  })
})
