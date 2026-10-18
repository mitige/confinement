/**
 * Waiting for the app to actually be up.
 *
 * Every harness in this directory used to wait for `.loader` to detach, on the
 * assumption that the preloader unmounts once the first frames are on screen. It
 * does — but Playwright's `state: 'detached'` is also satisfied by a selector that
 * never existed, so a page whose bundle had not finished loading looked exactly
 * like a page that had finished. On a cold CDN that produced a run of failures
 * against the deployed site that did not reproduce locally, because locally the
 * bundle is instant.
 *
 * So: wait for the preloader to go, then assert the scroll track is really there.
 */

/** Resolves once the app has rendered its act timeline. */
export async function waitForApp(page, { timeout = 120_000 } = {}) {
  await page.waitForSelector('.loader', { state: 'detached', timeout })

  await page.waitForFunction(() => document.querySelectorAll('[data-act]').length > 0, {
    timeout,
  })

  const acts = await page.evaluate(() => document.querySelectorAll('[data-act]').length)
  if (acts === 0) throw new Error('the app rendered no acts')
  return acts
}

/**
 * Append the parameters a harness needs to be deterministic.
 *
 * The attract mode starts moving the page after five seconds of no mouse
 * movement, which is exactly what a screenshot harness does — it drove the scroll
 * out from under every measurement until this was added.
 */
export function harnessUrl(base, query = '') {
  const url = new URL(base)
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
  params.set('autoplay', 'off')
  for (const [key, value] of params) url.searchParams.set(key, value)
  return url.toString()
}

/** Camera and renderer handles, exposed only by the dev build. */
export async function waitForRenderer(page, { timeout = 120_000 } = {}) {
  await page.waitForFunction(() => Boolean(window.__r3f?.camera), { timeout })
}
