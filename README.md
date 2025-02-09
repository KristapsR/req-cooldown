# Request Cool-Down for Fastify and Koa

Handles all parallel requests once for identical requests.
It doesn't cache results - it caches the request promise and uses the results to serve all identical requests.
Results are not cached. If you need caching, use a caching middleware. This is just a plain and simple tool for solving request bursts to long-running expensive requests that could happen by reloading dozens of browser tabs or abusing page reload.

## Features

- Respond to multiple identical requests with results from first request
- User specific session key for cache key

## Todo

- [ ] Improve readme file (install notes, build status, coverage?)
- [ ] Check if there are some cases that are no covered, eg. different responese statuses, headers, body types, etc.
- [ ] Add tests for different body types
- [ ] Add tests for different response statuses
- [ ] Add tests for different response headers
- [ ] Add tests for different response body types
