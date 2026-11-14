import type { BrowserFamily, OsFamily } from './types';

/**
 * Client-reported browser/OS context for orbita-rt-1 (no fingerprinting). Versions come from the
 * user-agent string using one fixed convention per setup; they are not hardware calibration.
 * Unsupported setups (mobile/touch, unknown browser, missing OS version) cannot run the check.
 */

export interface Platform {
  readonly browser_family: BrowserFamily;
  readonly browser_version: string;
  readonly os_family: OsFamily;
  readonly os_version: string;
}

export type PlatformResult = { readonly ok: true; readonly platform: Platform } | { readonly ok: false; readonly reason: string };

const VERSION = /^[0-9]+(\.[0-9]+){0,3}$/;
const firstComponents = (version: string): string => version.split('.').slice(0, 4).join('.');

function browserOf(ua: string): { family: BrowserFamily; version: string } | null {
  const edge = /Edg\/([\d.]+)/.exec(ua);
  if (edge?.[1]) return { family: 'edge', version: edge[1] };
  const firefox = /Firefox\/([\d.]+)/.exec(ua);
  if (firefox?.[1]) return { family: 'firefox', version: firefox[1] };
  const chrome = /Chrome\/([\d.]+)/.exec(ua);
  if (chrome?.[1] && !/OPR\//.test(ua)) return { family: 'chrome', version: chrome[1] };
  const safari = /Version\/([\d.]+).*Safari\//.exec(ua);
  if (safari?.[1]) return { family: 'safari', version: safari[1] };
  return null;
}

function osOf(ua: string): { family: OsFamily; version: string | null } | null {
  const windows = /Windows NT ([\d.]+)/.exec(ua);
  if (windows?.[1]) return { family: 'windows', version: windows[1] };
  const mac = /Mac OS X ([\d_.]+)/.exec(ua);
  if (mac?.[1]) return { family: 'macos', version: mac[1].replace(/_/g, '.') };
  if (/Linux/.test(ua)) return { family: 'linux', version: null };
  return null;
}

export function detectPlatform(userAgent: string): PlatformResult {
  if (/Android|iPhone|iPad|Mobile/.test(userAgent)) {
    return { ok: false, reason: 'Phones and tablets are not supported by this check (desktop or laptop with a keyboard only).' };
  }
  const browser = browserOf(userAgent);
  if (browser === null) return { ok: false, reason: 'This browser is not supported (Chrome, Edge, Firefox or Safari only).' };
  const os = osOf(userAgent);
  if (os === null) return { ok: false, reason: 'This operating system is not supported (Windows, macOS or Linux only).' };
  if (os.version === null) return { ok: false, reason: 'The operating system version is not reported by this browser, so results cannot be compared.' };
  const browser_version = firstComponents(browser.version);
  const os_version = firstComponents(os.version);
  if (!VERSION.test(browser_version) || !VERSION.test(os_version)) {
    return { ok: false, reason: 'Browser or operating system version could not be read.' };
  }
  return { ok: true, platform: { browser_family: browser.family, browser_version, os_family: os.family, os_version } };
}

/** Touch-first devices cannot run a Space-key test. */
export function isTouchOnly(win: Window = window): boolean {
  return win.navigator.maxTouchPoints > 0 && win.matchMedia?.('(pointer: coarse)').matches === true;
}
