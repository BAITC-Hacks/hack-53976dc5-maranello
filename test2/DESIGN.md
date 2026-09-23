---
name: "Практика (working name)"
description: "A quiet project workspace for business problems and student proposals."
colors:
  brand: "#235c48"
  brand-hover: "#174333"
  accent: "#dbeaaf"
  ink: "#25372f"
  muted: "#5d6b60"
  green-text: "#506a3f"
  surface: "#fff"
  canvas: "#f6f7f4"
  line: "#e3e8e1"
  soft: "#eef3eb"
  error: "#a53c36"
  focus: "#467958"
  progress: "#769a59"
typography:
  headline:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "2.35rem"
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: "-.025em"
  title:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: "-.025em"
  body:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  action:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.5
  field-label:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "11px"
    fontWeight: 700
  score:
    fontFamily: "'Manrope Variable', Manrope, sans-serif"
    fontSize: "43px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.035em"
rounded:
  badge: "5px"
  control: "8px"
  panel: "12px"
  card: "14px"
  welcome: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  card: "22px"
  section: "26px"
  form: "28px"
  page: "42px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-light:
    backgroundColor: "#e2f0bb"
    textColor: "#254432"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-danger:
    backgroundColor: "#a24039"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  navigation:
    textColor: "#65716a"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  badge:
    backgroundColor: "#eef2e9"
    textColor: "#5c6b50"
    rounded: "{rounded.badge}"
    padding: "4px 7px"
  task-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "22px"
  rating:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "23px"
---

# Design System: Практика

## Overview

**Creative North Star: "Shared project studio"**

White work surfaces, a grey-green canvas, forest actions and restrained lime accents make a practical workspace for business representatives and student teams. Typography, borders and spacing carry the hierarchy; icons support actions and no raster imagery ships.

This is a descriptive record of the implemented MVP, based on `frontend/src/styles.css`, shared components and pages. The studio metaphor, Russian copy and name «Практика» are working assumptions from the direction contract, not an approved standing identity.

**Key Characteristics:**

- Quiet, bordered work surfaces.
- One Manrope family with clear numerical hierarchy.
- Explicit save, confirmation and publication states.
- Scores explain readiness without restricting participation.

## Colors

Muted greens connect the workspace while white surfaces keep lengthy forms legible. The frontmatter records the reusable palette; component-only shades remain in component definitions and sidecar snippets.

### Primary

- **Forest** (`brand`, `brand-hover`): main actions, active navigation and links.
- **Lime** (`accent`): restrained emphasis and selection; related pale greens appear on welcome actions and readiness badges.
- **Leaf** (`progress`, `green-text`): rating bars and supporting green text, respectively.

### Neutral

- **Ink / muted**: primary text and secondary explanation, including placeholders.
- **Surface / canvas / soft**: white work panels, page background and quiet icon or hover areas.
- **Line**: panel outlines and section dividers.

Error and focus colors are functional states. Readiness and proposal badges pair their green, amber, grey or red tint with text; color alone does not name the state.

**The State Has Words Rule.** Pair state color with a label, number or explicit message.

## Typography

Manrope Variable is bundled through `@fontsource-variable/manrope`; the fallback stack is in the tokens. It serves headings, body, controls and figures. There is no separate display or monospace face.

The headline and title tokens describe base heading rules. Page introductions use 13px copy with 1.8 line height and up to 72ch. Task titles use 16px/1.45, weight 650; form content and buttons mostly use 12px. Supporting text is commonly 10–11px, with compact 9px status text in the current MVP. These compact sizes describe existing components, not a blanket size for new body copy.

Large rating figures use the score token and tabular numerals; smaller card scores use 15px, weight 750. Welcome headings vary from 32–34px on the default desktop layout. Heading tracking is slightly tight; paragraph text retains normal tracking.

**The Number Stays Readable Rule.** Keep score numerals tabular and show the denominator alongside each total.

## Layout

Desktop shell: fixed 234px sidebar, 82px minimum header, and a main area capped at 1420px with 42px horizontal padding. Task grids have three equal columns with 18px gaps. The editor pairs a flexible form with a 310px rating rail and 26px gap; the rating panel sticks 25px from the viewport top. Reused panel padding ranges from 22px for cards to 26–28px for editing and forms.

Responsive rules are CSS viewport thresholds, not device detection:

| Threshold | Implemented change |
| --- | --- |
| ≥1600px | Main top padding grows to 50px; business welcome heading grows to 38px. |
| ≤1190px | Sidebar becomes 208px, content gutters 27px; editor fields stack; filters wrap. |
| ≤960px | Sidebar becomes 190px, gutters 23px; task grid becomes two columns; intake and clarification asides stack. |
| ≤760px | Sidebar becomes a 235px off-canvas drawer with scrim; header becomes 68px; content gutters become 20px and base h1 becomes 27px. Editor still has two columns. |
| ≤580px | Task, welcome, editor and proposal content grids become one column; rating stops sticking; paired form fields stack. |

The current minimum body width is 360px. Long task and proposal text wraps; catalog card title and excerpt previews clamp to two lines. Complete text appears on detail surfaces.

## Elevation & Depth

Most surfaces are flat: quiet one-pixel borders and pale background changes establish grouping. Card hover changes border and background without lifting. The selected role uses `0 2px 4px #2038200b`; toast feedback uses `0 8px 25px #253d2429`. Fields use a focus ring of `0 0 0 3px #e1ecdc`, and other focusable controls have a 3px focus outline offset by 4px.

**The Quiet Surface Rule.** Keep working cards flat; reserve the shipped shadows for selection, focus and transient feedback.

## Shapes

Cards and editor panels use the card radius; welcome panels are slightly rounder. Inputs and buttons share the control radius, while badges are compact rounded rectangles. Numbered steps, role avatars and status dots use circles. Lucide SVG icons use a consistent 1.75 stroke width; the brand mark is an inline SVG.

## Components

### Buttons

Primary forest actions, white bordered secondary actions, pale welcome actions and red decision confirmation share 43px minimum height, 9px icon gap and the action type token. Small actions use 36px minimum height, 8px 12px padding and 11px type. Hover transitions run for 180ms. Disabled buttons use 0.48 opacity and a not-allowed cursor; busy actions show a spinner and explicit action text.

### Chips

Badges name readiness or proposal status. Priority uses pale lime, ready/accepted use green, workable/pending use amber, draft uses grey and rejected uses soft red. The small rectangle stays compact; it is an informational label rather than an interactive filter.

### Cards / Containers

Task cards are full-card links with a title, excerpt, readiness label, numeric score, progress bar and API-derived proposal count. A pending or failed count is described explicitly. Forms and proposals use the same white bordered panel language, with dividers separating meaningful content groups.

### Inputs / Fields

White fields have a one-pixel border, 46px minimum input/select height and a forest focus border with a pale ring. Textareas resize vertically. Labels remain visible above the field; hints and optional labels use secondary text. Native required and length constraints remain in use. Error notices use `role="alert"`, preserve entered content and may offer retry. Fieldsets disable during requests.

### Navigation

Sidebar links use icons, labels and a pale-green active surface with stronger type. The role selector uses pressed button state and a white selected surface. The mobile drawer opens from the header and closes by the scrim or a route change. A skip link targets the main region.

The role switch is a demo preference stored locally, not authentication or authorization. Locally remembered task IDs drive the working-task list; they do not establish ownership.

### Rating and decisions

The rating widget shows the server's score, level, breakdown and missing-field guidance. Total bars are 7px high, card bars 4px and breakdown bars 3px; changes animate for 450ms with `cubic-bezier(.16,1,.3,1)`. Unsaved edits keep the last server rating and show a save reminder. Saving replaces the card and rating with the API response; confirmation saves outstanding edits first, and publication remains a separate action. No rating threshold disables publishing or proposals.

Manual accept/reject actions expand an explicit confirmation row before sending the decision. Skeletons, inline errors and status toasts distinguish waiting, failure and success. Reduced-motion preference disables all animation and transitions.

## Do's and Don'ts

### Do:

- Do use labels and numeric values alongside state colors and bars.
- Do preserve the visible distinction between unsaved, saved, confirmed and published work.
- Do keep full explanations on detail surfaces when catalog previews are clamped.
- Do retain keyboard focus treatment and reduced-motion behavior.

### Don't:

- Don't present the demo role switch as authentication or local task history as ownership.
- Don't turn a low readiness score into a publishing or proposal restriction.
- Don't replace API loading or error states with invented activity.
- Don't treat the working name or studio metaphor as user-approved standing branding.
