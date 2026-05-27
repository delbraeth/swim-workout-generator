---
title: "Breach Notification SLA"
subtitle: "SetForge / Competition Aquatics, LLC"
date: "{{TODAY_YMD}}"
---

## Purpose

This document states SetForge's commitment to notifying Customer when
a confirmed Personal Data breach affects Customer Data. It supports
the Data Processing Addendum §10 and is referenced from the Services
Agreement §11 by way of the DPA.

## Trigger

This SLA fires when SetForge has **confirmed** a Personal Data breach
affecting Customer Data. A "confirmed breach" means:

(a) SetForge's operator has independently verified that unauthorized
access, disclosure, alteration, loss, or destruction of Customer
Personal Data has occurred or is highly likely to have occurred; and

(b) The scope (Data Subjects, categories of data) is reasonably
established — at least at preliminary granularity.

A suspected breach that has not yet been confirmed (e.g. an
unverified third-party tip, an anomaly under investigation) does NOT
start the SLA clock. SetForge will, however, share a preliminary
notice within 72 hours when a suspected breach involving Customer
Data is under active investigation — even if confirmation hasn't
occurred — so Customer is not surprised by a later confirmed
notification.

## Timeline

| Event | SetForge action | SLA |
|---|---|---|
| Confirmed breach | Initial written notice to Customer's contact-of-record | **24 hours** |
| Subsequent updates | Status update emails until closed | Every 7 days |
| Closure notice | Final written notice summarizing root cause, remediation, and any obligations Customer has toward its Data Subjects | At closure |

## Notification content

Each written notice will include, to the extent known at the time:

1. The nature of the breach (what type of unauthorized access /
   disclosure / loss).
2. The categories and approximate number of Data Subjects affected.
3. The categories of Personal Data affected (identity, activity,
   contact, preferences, technical — per DPA §3).
4. The likely consequences for affected Data Subjects.
5. Measures SetForge has taken or proposes to take to address the
   breach, including (where applicable) measures to mitigate adverse
   effects.
6. Contact for follow-up: `hello@setforge.io` + a direct phone line
   provided in the notification.

## Who receives the notification

- Customer's **contact-of-record** as listed on the Services Agreement
  (or as updated by Customer in writing). Customer is responsible for
  keeping this current.
- SetForge will additionally post an in-app banner notice to affected
  Coach and Swimmer accounts when the breach materially affects them
  individually (e.g., their data was specifically in the breached
  scope).

## Why 24 hours, not 1 or 4 hours

SetForge is operated by one person. A 1-hour or 4-hour notification
SLA would require an on-call rotation that does not exist. 24 hours is
the shortest SLA SetForge can honestly commit to and meet in every
scenario, including overnight discovery + weekend confirmation.

This SLA exceeds the GDPR 72-hour notification window for supervisory
authorities (a separate process Customer may need to invoke depending
on the breach scope).

## Drills

SetForge runs a tabletop breach-response drill at least annually,
walking through the notification checklist with a synthetic incident
description. Drill results are documented in SetForge's internal
runbook and inform updates to this SLA.

## Out of scope

This SLA does NOT cover:

- **Notification to data-subject Data Subjects directly** — that
  obligation flows from Customer to its Data Subjects under
  applicable law; SetForge supports it by providing Customer with the
  scope information needed.
- **Notification to supervisory authorities** (e.g., state AGs,
  privacy commissioners) — Customer's obligation under applicable
  law; SetForge provides scope information on request.
- **Suspected breaches** that have not been confirmed (see Trigger
  above; preliminary notice within 72 hours instead).

---

Document maintained at: `setforge.io/vendor-kit/breach-notification-sla.md`
(source) and `setforge.io/security.html` (public summary).
