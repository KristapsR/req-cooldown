import { describe, expect, it } from 'vitest'

import { sleep } from './utils/general'
import {
  REQUEST_DELAY,
  delayRequest,
  getApp,
  getRequestHandler,
} from './utils/koa'

describe('koa', async () => {
  it('requests to same path should be cached but to different paths should not be cached', async () => {
    const { app, router, request, assertionError } = await getApp()

    router.get('/one', getRequestHandler())
    router.get('/two', getRequestHandler())

    app.use(router.routes())

    const [response1, response2, response22] = await Promise.all([
      request.get('/one').set('x-request-id', '1'),
      request.get('/two').set('x-request-id', '2'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/two').set('x-request-id', '3')
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(response1.text).toEqual('1')
    expect(response2.text).toEqual('2')
    expect(response22.text).toEqual('2')
  })

  it('requests promise should be only cached while it is in progress', async () => {
    const { app, router, request, assertionError } = await getApp()

    router.get('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request.get('/one').set('x-request-id', '1'),
      delayRequest(REQUEST_DELAY / 2, () =>
        request.get('/one').set('x-request-id', '2')
      ),
      delayRequest(REQUEST_DELAY * 1.5, () =>
        request.get('/one').set('x-request-id', '3')
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('1')
    expect(responses[2].text).toEqual('3')
  })

  it('timeout should fire when there is other request waiting for response', async () => {
    let timedOut = false

    const { app, router, request, assertionError } = await getApp({
      timeout: REQUEST_DELAY / 2,
      onTimeout: (ctx) => {
        timedOut = true
        ctx.body = 'timeout'
      },
    })

    router.get('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request.get('/one').set('x-request-id', '1'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/one').set('x-request-id', '2')
      ),
    ])

    expect(timedOut).toEqual(true)

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('timeout')
  })

  it('should not cache same path requests from different ip addresses', async () => {
    const { app, router, request, assertionError } = await getApp()

    router.get('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request
        .get('/one')
        .set('x-request-id', '1')
        .set('X-Forwarded-For', '10.0.0.101'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request
          .get('/one')
          .set('x-request-id', '2')
          .set('X-Forwarded-For', '10.0.0.101')
      ),
      delayRequest(REQUEST_DELAY / 4, () =>
        request
          .get('/one')
          .set('x-request-id', '3')
          .set('X-Forwarded-For', '10.0.0.102')
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('1')
    expect(responses[2].text).toEqual('3')
  })

  it('should not cache same path requests for different users', async () => {
    const { app, router, request, assertionError } = await getApp({
      getUserKey: (req) => JSON.stringify({ id: req.headers['x-user-id'] }),
    })

    router.get('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request.get('/one').set('x-request-id', '1').set('x-user-id', '1'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/one').set('x-request-id', '2').set('x-user-id', '1')
      ),
      request.get('/one').set('x-request-id', '3').set('x-user-id', '2'),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('1')
    expect(responses[2].text).toEqual('3')
  })

  it('should continue with original request handler if badReply callback does not send reply', async () => {
    const { app, router, request, assertionError } = await getApp({
      onBadReply: () => {
        /** Empty callback for testing */
      },
    })

    router.get(
      '/one',
      getRequestHandler((ctx, next, sent) => {
        if (ctx.header['x-request-id'] === 'badReply') {
          ctx.body = "I'm a teapot"
          ctx.response.status = 418
          sent()
        }
      })
    )
    router.get(
      '/two',
      getRequestHandler((ctx, next, sent) => {
        if (ctx.header['x-request-id'] === 'badReply') {
          ctx.response.set('Content-type', 'application/json')
          ctx.body = JSON.stringify({ badReply: true })
          ctx.response.status = 404
          sent()
        }
      })
    )

    app.use(router.routes())

    const responses = await Promise.all([
      request.get('/one').set('x-request-id', 'badReply'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/one').set('x-request-id', '2')
      ),
      request.get('/two').set('x-request-id', 'badReply'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/two').set('x-request-id', '2')
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].statusCode).toEqual(418)
    expect(responses[1].status).toEqual(200)
    expect(responses[0].text).toEqual("I'm a teapot")
    expect(responses[1].text).toEqual('2')
    expect(responses[0].headers['content-type']).toMatch(/^text\/plain/)
    expect(responses[1].headers['content-type']).toEqual(
      responses[0].headers['content-type']
    )

    expect(responses[2].statusCode).toEqual(404)
    expect(responses[3].status).toEqual(200)
    expect(JSON.parse(responses[2].text)).toMatchObject({ badReply: true })
    expect(responses[3].text).toEqual('2')
    expect(responses[2].headers['content-type']).toMatch(/^application\/json/)
    expect(responses[3].headers['content-type']).toMatch(/^text\/plain/)
  })

  it('should respond with reply made in badReply callback', async () => {
    const { app, router, request, assertionError } = await getApp({
      onBadReply: (ctx) => {
        ctx.response.status = 400
        ctx.body = 'badReply'
      },
    })

    router.get(
      '/one',
      getRequestHandler(async (ctx, next, sent) => {
        if (ctx.header['x-request-id'] === 'badReply') {
          await sleep(REQUEST_DELAY / 2)
          ctx.response.status = 418
          ctx.body = "I'm a teapot"
          return sent()
        }
      })
    )
    router.get(
      '/two',
      getRequestHandler(async (ctx, next, sent) => {
        if (ctx.header['x-request-id'] === 'badReply') {
          await sleep(REQUEST_DELAY / 2)
          ctx.response.status = 404
          ctx.response.set('Content-type', 'application/json')
          ctx.body = JSON.stringify({ badReply: true })
          return sent()
        }
      })
    )

    app.use(router.routes())

    const responses = await Promise.all([
      request.get('/one').set('x-request-id', 'badReply'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/one').set('x-request-id', '2')
      ),
      request.get('/two').set('x-request-id', 'badReply'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.get('/two').set('x-request-id', '2')
      ),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].statusCode).toEqual(418)
    expect(responses[1].status).toEqual(400)
    expect(responses[0].text).toEqual("I'm a teapot")
    expect(responses[1].text).toEqual('badReply')
    expect(responses[0].headers['content-type']).toMatch(/^text\/plain/)
    expect(responses[1].headers['content-type']).toEqual(
      responses[0].headers['content-type']
    )

    expect(responses[2].statusCode).toEqual(404)
    expect(responses[3].status).toEqual(400)
    expect(JSON.parse(responses[2].text)).toMatchObject({ badReply: true })
    expect(responses[3].text).toEqual('badReply')
    expect(responses[2].headers['content-type']).toMatch(/^application\/json/)
    expect(responses[3].headers['content-type']).toMatch(/^text\/plain/)
  })

  it('should not cache POST requests by default', async () => {
    const { app, router, request, assertionError } = await getApp()

    router.post('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request.post('/one').send({ foo: 'bar' }).set('x-request-id', '1'),
      request.post('/one').send({ foo: 'bar' }).set('x-request-id', '2'),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('2')
  })

  it('should cache POST requests if configured and take into account request body', async () => {
    const { app, router, request, assertionError } = await getApp({
      methods: ['POST'],
    })

    router.post('/one', getRequestHandler())

    app.use(router.routes())

    const responses = await Promise.all([
      request.post('/one').send({ foo: 'bar' }).set('x-request-id', '1'),
      delayRequest(REQUEST_DELAY / 4, () =>
        request.post('/one').send({ foo: 'bar' }).set('x-request-id', '2')
      ),
      request.post('/one').send({ foo: 'baz' }).set('x-request-id', '3'),
    ])

    if (assertionError.error) throw assertionError.error
    expect(responses[0].text).toEqual('1')
    expect(responses[1].text).toEqual('1')
    expect(responses[2].text).toEqual('3')
  })
})
