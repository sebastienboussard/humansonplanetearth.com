// The site's own public address. One definition, because it now appears on
// several pages and a second copy is the one that drifts.
//
// This is the address people are told to write to. It must stay the same
// mailbox as `ADMIN_NOTIFY_EMAIL` in the environment, which is where the site's
// own alerts land — publishing an address nobody reads is worse than
// publishing none. Note that Resend cannot *send* from a gmail.com address:
// outbound mail stays on `NOTIFY_FROM_EMAIL` with this as reply-to (TODO §11).
export const SITE_EMAIL = "weare.HumansOnPlanetEarth@gmail.com";
