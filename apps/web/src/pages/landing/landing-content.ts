export const navigationItems = [
  { label: "Platform", href: "#platform" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Solutions", href: "#solutions" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#demo" },
] as const;

export const industries = [
  "Commercial buildings",
  "Transport",
  "Retail",
  "Fitness",
  "Hospitality",
  "Education",
  "Healthcare",
  "Multi-site operations",
] as const;

export const problemStatements = [
  {
    title: "Unclear instructions",
    copy: "Cleaners receive incomplete information or depend on someone being available to explain the duty.",
    icon: "message",
  },
  {
    title: "Missed recurring work",
    copy: "Periodic cleaning tasks are difficult to remember and often depend on manual follow-up.",
    icon: "calendar",
  },
  {
    title: "Limited proof of completion",
    copy: "Managers cannot always confirm when, where or how a duty was completed.",
    icon: "camera",
  },
  {
    title: "Scattered communication",
    copy: "Photos, notes, incidents and updates are spread across multiple channels.",
    icon: "files",
  },
  {
    title: "Inconsistent standards",
    copy: "Different cleaners may complete the same duty in completely different ways.",
    icon: "sliders",
  },
] as const;

export const workflowSteps = [
  {
    number: "01",
    label: "Plan",
    title: "Plan every duty",
    copy: "Create detailed duties with the location, frequency, instructions, equipment, chemicals and safety requirements your team needs.",
  },
  {
    number: "02",
    label: "Assign",
    title: "Assign the right work",
    copy: "Organise duties by site, shift, area or cleaner so every person knows exactly what belongs to them.",
  },
  {
    number: "03",
    label: "Guide",
    title: "Give cleaners clear instructions",
    copy: "Cleaners receive practical, mobile-friendly information without searching through messages or asking for repeated explanations.",
  },
  {
    number: "04",
    label: "Verify",
    title: "Verify completion",
    copy: "Track progress, review completion notes and collect photo evidence directly from the duty.",
  },
  {
    number: "05",
    label: "Improve",
    title: "Identify issues before they repeat",
    copy: "Incident reports and operational visibility help supervisors respond faster and maintain consistent standards across every site.",
  },
] as const;

export const features = [
  {
    title: "Recurring duty schedules",
    copy: "Automatically organise duties that repeat daily, weekly, monthly or on custom schedules.",
    icon: "repeat",
    size: "wide",
  },
  {
    title: "Multi-site management",
    copy: "Keep sites, buildings, zones and shifts organised from one platform.",
    icon: "map",
    size: "standard",
  },
  {
    title: "Photo verification",
    copy: "Attach completion evidence directly to the duty instead of searching through chat galleries.",
    icon: "camera",
    size: "standard",
  },
  {
    title: "Clear duty instructions",
    copy: "Document the expected process, equipment, chemicals and safety considerations.",
    icon: "clipboard",
    size: "standard",
  },
  {
    title: "Live progress tracking",
    copy: "See what is scheduled, active, completed, missed or waiting for review.",
    icon: "activity",
    size: "wide",
  },
  {
    title: "Incident reporting",
    copy: "Allow cleaners to report damage, hazards, access problems or maintenance issues immediately.",
    icon: "alert",
    size: "standard",
  },
  {
    title: "Cleaner-friendly mobile access",
    copy: "Give field staff a focused interface designed for use during active shifts.",
    icon: "phone",
    size: "standard",
  },
  {
    title: "Operational history",
    copy: "Maintain a useful record of completed work, notes, evidence and reported issues.",
    icon: "history",
    size: "wide",
  },
] as const;

export const roles = [
  {
    id: "managers",
    eyebrow: "Operations managers",
    title: "See the full picture",
    copy: "Manage sites, schedules, service requirements and performance without rebuilding the same information across spreadsheets and messages.",
    points: ["Cross-site visibility", "Recurring schedules", "Operational reporting"],
  },
  {
    id: "supervisors",
    eyebrow: "Supervisors",
    title: "Run every shift with confidence",
    copy: "Assign duties, monitor progress, review evidence and respond quickly when something changes on site.",
    points: ["Live shift progress", "Evidence review", "Incident follow-up"],
  },
  {
    id: "cleaners",
    eyebrow: "Cleaners",
    title: "Know exactly what needs to be done",
    copy: "Open the shift, follow clear instructions, report problems and complete duties without unnecessary back-and-forth.",
    points: ["Focused task list", "Clear instructions", "Mobile photo upload"],
  },
] as const;

export const outcomes = [
  "Fewer missed duties",
  "Clearer responsibility",
  "Faster shift handovers",
  "More consistent cleaning standards",
  "Easier quality reviews",
  "Better documentation",
  "Faster incident response",
  "Stronger communication between office and field teams",
] as const;

export const shiftTimeline = [
  "Shift prepared",
  "Duties assigned",
  "Cleaners begin work",
  "Progress becomes visible",
  "Evidence is submitted",
  "Supervisor reviews",
  "Issues are followed up",
  "Shift record is complete",
] as const;

export const faqs = [
  {
    question: "Who is Cleaning Duties designed for?",
    answer: "Cleaning Duties is designed for commercial cleaning contractors, facility managers, supervisors and organisations managing cleaning work across one or multiple sites.",
  },
  {
    question: "Can duties repeat automatically?",
    answer: "Duties can be organised around recurring schedules such as daily, weekly, monthly or custom operational frequencies.",
  },
  {
    question: "Can cleaners use the platform from their phones?",
    answer: "Yes. The cleaner experience is designed to provide clear shift information, duty instructions, progress actions, notes and photo uploads from a mobile device.",
  },
  {
    question: "Can managers oversee multiple sites?",
    answer: "Yes. Cleaning Duties is designed to organise work across multiple locations, buildings, zones, teams and shifts.",
  },
  {
    question: "Can staff upload completion photos?",
    answer: "Yes. Completion photos can be attached to the relevant duty, helping supervisors review work without searching through unrelated messages.",
  },
  {
    question: "Can cleaners report incidents or maintenance problems?",
    answer: "Yes. Staff can record issues such as hazards, damage, access problems or equipment concerns from the relevant duty or site.",
  },
  {
    question: "Is Cleaning Duties a generic task manager?",
    answer: "No. It is structured specifically around cleaning operations, including recurring duties, sites, shifts, cleaning instructions, equipment, chemicals, completion evidence and incident reporting.",
  },
  {
    question: "How do we get started?",
    answer: "Book a demonstration so the platform can be presented around your organisation's actual sites, cleaning schedules and operational requirements.",
  },
] as const;

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "#platform" },
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Solutions", href: "#solutions" },
      { label: "Book a demo", href: "#demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#demo" },
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
] as const;
