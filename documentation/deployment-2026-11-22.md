# Deployment automation and catalogue capacity — 2026-11-22

The owner approved pushing `main`, linking GitHub to Vercel with deploy on
push, the daily refresh hook, and raising the catalogue limits with a push.

- The five commits from 2026-11-19 were pushed as `eb83297`; CI passed,
  including the Redis cases skipped locally. This supersedes "Not pushed" in
  the 2026-11-19 record.
- The owner created the Deploy Hook and saved it as a GitHub Actions secret.
  A manual workflow run deployed
  https://apifit-41pnwogfo-nethrens-projects.vercel.app from `eb83297` with
  68,768 entries across 699 pages, reported complete and fresh by live search.
  A run started by the schedule had not yet been observed.

## Capacity change

- At 7-9 pages a day the 1,000-page cap would have been reached between
  2026-12-25 and 2027-01-02, failing every subsequent build.
- Limits are now 2,000 pages, 200,000 entries and 200 MiB. At the same rate
  the page cap is reached around April-May 2027.
- The build now refuses a snapshot that the runtime loader would reject.
  Previously such a build could deploy and make the API return 503.
- Local load test on replicated public listing data, no network or AI:

| Entries | File | Load | Keyword search | Expanded search | Peak RSS |
|---:|---:|---:|---:|---:|---:|
| 68,768 | 59 MiB | 0.3 s | 0.5 s | 1.7 s | 445 MiB |
| 100,000 | 86 MiB | 0.4 s | 0.7 s | 2.6 s | 496 MiB |
| 200,000 | 172 MiB | 0.9 s | 1.5 s | 5.1 s | 927 MiB |

These ran on a development Mac with a 1 GiB heap, not on Vercel. Search CPU
grows linearly with the catalogue, so watch Hobby Active CPU usage.

## Schedule check — 2026-11-23

- The first schedule-started run (45018604643) began 2026-11-22 11:42 UTC,
  about 8 hours after its 03:23 UTC slot. Its Vercel build
  `apifit-iyzqdsw96` from `645b96e` reported 68,931 entries across 701 pages
  and became the live deployment. Live search reported it complete and fresh.
  This supersedes "had not yet been observed" above.
- By 2026-11-23 08:17 UTC no scheduled run had appeared for that day. The
  workflow was active, so this points to GitHub delaying or dropping
  scheduled runs rather than a broken setup.
- The owner approved moving the cron to `47 5 * * *` (05:47 UTC, 13:47
  Singapore), away from busier times. The previous deployment stays live if
  a refresh build fails, so late runs leave the catalogue older, not broken.
