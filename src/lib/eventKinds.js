// src/lib/eventKinds.js — shared team-event kinds (Phase 5, pulled from
// MEET_SCHEDULE_WEATHER_SCOPE.md §3 ahead of Slice B). Single source of truth for
// the enum, labels, and emoji — imported by the server (feed emoji + validation)
// and the web client (event form dropdown + list pills). Pure data, no deps.
//
// `meet` is special: only meets are eligible as group-anchor / taper anchors
// (spec §3.3.1 / §8 #10), enforced in the anchor route + UI.
export const EVENT_KINDS = [
  { value: "meet",         label: "Meet",                emoji: "🏊" },
  { value: "picture_day",  label: "Picture day",         emoji: "📸" },
  { value: "team_meal",    label: "Team meal / banquet", emoji: "🍽️" },
  { value: "team_meeting", label: "Team meeting",        emoji: "📋" },
  { value: "fundraiser",   label: "Fundraiser",          emoji: "💰" },
  { value: "travel",       label: "Travel",              emoji: "✈️" },
  { value: "social",       label: "Social",              emoji: "🎉" },
  { value: "other",        label: "Other",               emoji: "📌" },
];

export const EVENT_KIND_VALUES = EVENT_KINDS.map(k => k.value);
export const DEFAULT_EVENT_KIND = "meet";

export function eventKindEmoji(value) {
  const k = EVENT_KINDS.find(x => x.value === value);
  return k ? k.emoji : "📌";
}
export function eventKindLabel(value) {
  const k = EVENT_KINDS.find(x => x.value === value);
  return k ? k.label : "Event";
}
export function isValidEventKind(value) {
  return EVENT_KIND_VALUES.includes(value);
}
