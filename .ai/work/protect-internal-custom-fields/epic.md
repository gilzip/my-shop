# Epic: Keep internal custom fields away from customers

## Context

my-shop stores five custom fields: three pipeline-test fields (`Customer.GilTest`, `Customer.dror_cust`, `Payment.gil_payment`) and two internal notes (`ProductVariant.internalNote`, `Customer.internalNote`). In Vendure, custom fields are visible on the Shop API **unless they are explicitly marked otherwise**. The three test fields were never marked, so today customers can:

- read `GilTest` and `dror_cust` on their own record, and `gil_payment` on their payments;
- write `GilTest` and `dror_cust` when they edit their account, when they register, and when they check out as a guest.

The two internal notes are already hidden with the same per-field visibility setting this epic will apply.

## Goal

Every internal or test custom field is invisible to the Shop API, for both reading and writing, on every customer path. The Admin API and dashboard keep full read/write access. No stored data changes. From now on, a field is exposed to customers only when someone deliberately decides to expose it.

## Stories

1. Hide the customer test fields from customers (read and all write paths)
2. Hide the payment test field from customers
3. Keep back-office access and existing data intact
4. Keep the existing internal notes hidden, and normal shopping working (regression)
5. Make "internal by default" the rule for future custom fields

## Success measures

- Shop API introspection shows no `GilTest`, `dror_cust` or `gil_payment` in any type, and `customFields` returns `null` for Customer and Payment.
- A re-run of the 2026-10-21 E2E test passes with no exposure findings.
- Staff can view and edit all five fields in the Admin API and dashboard.
- Row values for all five fields are unchanged.

## Out of scope

- Removing or renaming fields, changing values, or resuming the stopped `customer-giltest-field` pipeline.
- Staff permission tiers.
- Admin password hardening.
- Storefront UI changes.
