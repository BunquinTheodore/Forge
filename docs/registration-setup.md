# FORGE PH 2027: registration, domain and launch guide

## 1. How registration works

1. A visitor opens one of the three forms: `/register/conference/`, `/register/booth/`, `/register/workshop/`.
2. The browser validates the form, then posts it to `/api/register` (a Vercel serverless function, `api/register.js`).
3. The function validates again on the server (same rules, `shared/registration.js`), rejects spam and cross-site posts, and forwards the registration to an **Apps Script web app that lives inside an ICCPI Google Sheet**.
4. The script appends one row to the tab for that form (Conference, Booth, Workshop) and emails the registration team.
5. Once the row is saved, the function emails the full registration to `f.calabretta@iccpi.org.ph` through Resend (`api/_email.js`). Replying to that email writes to the person who registered.

Who can read the data is decided by who the Google Sheet is shared with, and by who receives the emails. The website itself stores nothing and has no admin login.

### Set up the Resend email

**Without access to the domain's DNS (works now).** The sender `onboarding@resend.dev` needs no DNS records, but Resend only delivers it to the address that owns the Resend account. Resend describes it as being for testing.

1. Create the Resend account at resend.com **with `f.calabretta@iccpi.org.ph`** as its email address, and confirm that address.
2. API Keys > Create API key with **Sending access** only.
3. Vercel > Project > Settings > Environment Variables, for **Production**: add `RESEND_API_KEY` with that key (never commit it or paste it into a chat).
4. Redeploy, submit a test registration and confirm the email arrives (check spam the first time).

**Later, with GoDaddy access (recommended).** Needed to send to more than one address, or from a `forgeph.org` sender.

1. Resend > Domains > Add domain: `forgeph.org`. Add each DNS record it lists in GoDaddy > forgeph.org > DNS, then press Verify.
2. In Vercel add `REGISTRATION_EMAIL_FROM`, for example `FORGE PH 2027 <registrations@forgeph.org>`.
3. Optional: `REGISTRATION_EMAIL_TO`, recipients separated by commas. Default `f.calabretta@iccpi.org.ph`.
4. Redeploy and test again.

If an email cannot be sent, the registration is still saved and the Vercel function log shows its reference. A free Resend account has daily and monthly sending limits, so add the firewall rule under Spam protection before promoting the forms.

To avoid two notices for each registration, remove `f.calabretta@iccpi.org.ph` from the Apps Script property `NOTIFY_EMAILS` once the Resend email works.

### Set up the Google Sheet (about 10 minutes, ICCPI Google account)

1. Create a new Google Sheet named `FORGE PH 2027 registrations` with the ICCPI account. Share it **only** with the authorized ICCPI team (Viewer or Editor as needed). Keep general link sharing off.
2. In the Sheet: Extensions > Apps Script. Replace the contents of `Code.gs` with `docs/apps-script/Code.gs` from this repository.
3. Project Settings > Script properties. Add:
   - `SECRET`: a long random string (for example 40 random characters).
   - `NOTIFY_EMAILS`: `info@iccpi.org.ph,f.calabretta@iccpi.org.ph`
4. Deploy > New deployment > type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Authorize when asked, then copy the web app URL. (The URL is not secret on its own: the script rejects any request without the `SECRET`.)
5. In Vercel: Project > Settings > Environment Variables. Add these for **Production**. For **Preview** (staging) use a separate test Sheet with its own web app URL and secret, so test registrations never reach the real list:
   - `REGISTRATION_WEBHOOK_URL`: the web app URL from step 4
   - `REGISTRATION_WEBHOOK_SECRET`: the same value as `SECRET`
6. Redeploy. Submit a test registration on the staging site and confirm the row and the email arrive.

Until step 5 is done the forms show a friendly message asking people to email `info@iccpi.org.ph` and `f.calabretta@iccpi.org.ph`.

### Spam protection

The form has a hidden honeypot, same-site checks and a small per-visitor limit inside the function. These do not cap the total number of emails, so spam could use up the Resend allowance. Add a Vercel Firewall rate-limit rule for `/api/register` (Project > Firewall) and, if spam appears, a CAPTCHA such as Cloudflare Turnstile. The Apps Script sends at most 100 notification emails a day; rows are always saved.

### Data and privacy

Collected: name, email, mobile, job title, organization, country, business category, sector, interests, notes, and form specific answers. Participants confirm a consent line on every form. IP addresses are not stored. On a deletion request, remove the row from the Sheet and delete the matching notification emails. Sent emails also appear in the Resend dashboard.

## 2. Payment (to be decided)

The site collects registrations only. The pass (PHP 5,000 per participant) and booth packages (PHP 15,000, 35,000, 55,000) are **not** charged online yet. The confirmation text says the ICCPI team sends payment details after confirming. Options to decide with ICCPI:

- Bank transfer or invoice sent by the ICCPI team after each registration (no integration needed).
- A hosted payment link per product (for example PayMongo, Xendit or Stripe Payment Links) shown on the success screen.
- A full online checkout (needs a payment provider account, a business verification and an order record per payment).

## 3. Domain: forgeph.org

Current state when this was checked: `forgeph.org` still resolves to a GoDaddy address (`160.153.0.224`), so the Vercel records are not applied yet.

1. GoDaddy > forgeph.org > DNS. Set (see `forgeph-godaddy-dns.png`):
   - `A`, name `@`, value `216.198.79.1`
   - `CNAME`, name `www`, value `d12d154dcea832b0.vercel-dns-017.com.`
   Remove any older `A` record for `@` or `CNAME` for `www` that points to GoDaddy parking.
2. Vercel > Project > Settings > Domains. Add `www.forgeph.org` (primary) and `forgeph.org`. `vercel.json` redirects the bare domain to `https://www.forgeph.org/…` permanently.
3. Vercel issues the SSL certificate automatically once DNS resolves (usually minutes, up to a few hours). Check that `https://www.forgeph.org` shows a padlock and that `http://` redirects to `https://`.
4. Verify: `nslookup forgeph.org` shows `216.198.79.1`; `https://forgeph.org` redirects to `https://www.forgeph.org`.

## 4. Staging before launch

- Every push to a non-production branch gets a private Vercel preview URL. Use it for the review. In Project > Settings > Deployment Protection keep **Vercel Authentication** on so only invited people can open previews.
- Launch: merge to `main` (production), add the domain, test a registration on `https://www.forgeph.org`, then share.

## 5. Items waiting for confirmation

- Piaggio: sponsorship is **not shown** on the site until Piaggio confirms its official corporate name, logo and role. The hero tile, the Partners card and the homepage featured card are prepared in `docs/main-sponsor-blocks.html`. The programme still lists the 13:30 "Piaggio / Vespa Experience" session, tagged "subject to final approval": remove it from `src/sections/programme/programme.html` if it should also stay off.
- Opening session line "Italian Chamber of Commerce in Hong Kong": kept as written in the programme document and marked "to be confirmed". Confirm if "Hong Kong" is intended.
- Speakers and institutional participants (marked "to be confirmed" on `/programme/`).
- FD90 milestones (Day 0, 10, 45, 90) come from the pitch deck v1.1 and are marked indicative.
- Partner names for each partner group on `/partners/`.
