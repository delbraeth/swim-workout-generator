# Apple root certificates (for App Store Server Library JWS verification)

`lib/appleIap.js` → `SignedDataVerifier` needs Apple's **root CA** certificates
to validate the x5c certificate chain on signed transactions and notifications.
These are NOT bundled with the npm package and are NOT secret — they're Apple's
public roots.

## What to put here
Download from <https://www.apple.com/certificateauthority/> and drop the files
in this directory (the loader picks up `*.cer`, `*.der`, `*.pem`, `*.crt`):

- **Apple Root CA - G3 Root** (`AppleRootCA-G3.cer`) — required; this is the
  root for the App Store receipt/JWS chain.
- (Optional) Apple Root CA - G2, if Apple's docs indicate it for your chain.

## Notes
- The loader reads every cert file in this dir; extra/irrelevant certs are
  harmless but keep it minimal.
- `enableOnlineChecks=true` in the verifier also does an OCSP revocation check,
  which needs outbound network from the server.
- Override this directory via `APPLE_IAP_CONFIG.root_cert_dir` if you'd rather
  store certs elsewhere (e.g. a mounted secret volume).
- Until a root cert is present AND `APPLE_IAP_CONFIG` is set, IAP stays inert —
  `_getVerifier()` throws `no_root_certs`, surfaced as a clear error, never a
  silent bad-verify.
