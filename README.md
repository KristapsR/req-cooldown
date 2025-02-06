# Request Cool-Down for Fastify and Koa

Handle all parallel requests once for identical requests.
It doesn't cache results - it caches request promise and uses results to serve all identical requests.
Result is not cached, if you need that use caching middleware. This is just plane simple tool for solving request burst to long running expensive requests that could happen by reloading dozen of browser tabs or abbusing page reload.

## Features

- Respond to multiple identical requests with results from first request
- User speciffic session key for cache key

## Todo

- [ ] Improve readme file (install notes, build status, coverage?)
- [ ] Check if there are some cases that are no covered, eg. different responese statuses, headers, body types, etc.
- [ ] Add tests for different body types
- [ ] Add tests for different response statuses
- [ ] Add tests for different response headers
- [ ] Add tests for different response body types
- [ ] Add tests for different response body types
