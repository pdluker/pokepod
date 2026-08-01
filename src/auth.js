// Matches the auth pattern already used across stl-bucket, space, and intel:
// Authorization: Bearer <secret> header only. Query-string ?secret= is
// explicitly rejected so a token never ends up in logs/browser history.
//
// If you already have a shared auth.js in another Worker, feel free to
// swap this file for that one directly — same contract (401 on failure,
// null on success) — this is just a self-contained copy so this Worker
// doesn't depend on another repo/folder existing.

export function requireAuth(request, expectedSecret) {
  const url = new URL(request.url);
  if (url.searchParams.has('secret')) {
    return new Response('Query-string auth is not supported. Use an Authorization: Bearer header.', { status: 401 });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match || match[1] !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  return null; // authorized
}
