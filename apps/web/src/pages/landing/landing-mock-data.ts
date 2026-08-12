export type MockDutyStatus = "Assigned" | "In progress" | "Awaiting review" | "Completed" | "Issue reported";

export const sampleSite = {
  name: "Central Square Complex",
  shift: "Night Shift · 11:00 PM–6:30 AM",
  date: "Sample workspace",
  progress: 62,
  cleaners: 6,
  completed: 5,
  review: 2,
  incidents: 1,
};

export const sampleDuties: Array<{
  id: string;
  title: string;
  zone: string;
  assignee: string;
  time: string;
  status: MockDutyStatus;
}> = [
  { id: "D-104", title: "Main bathrooms deep clean", zone: "Level 1 · Amenities", assignee: "AM", time: "11:00 PM", status: "Completed" },
  { id: "D-105", title: "Lobby floor scrubbing", zone: "Ground · Lobby", assignee: "KL", time: "11:30 PM", status: "In progress" },
  { id: "D-106", title: "Escalator detail cleaning", zone: "Ground · East", assignee: "RT", time: "12:15 AM", status: "Assigned" },
  { id: "D-107", title: "Glass doors and entry points", zone: "Ground · Entry", assignee: "KL", time: "12:30 AM", status: "Awaiting review" },
  { id: "D-108", title: "Waste room inspection", zone: "Basement · Service", assignee: "AM", time: "1:00 AM", status: "Issue reported" },
  { id: "D-109", title: "Loading bay pressure washing", zone: "Basement · Bay", assignee: "RT", time: "2:00 AM", status: "Assigned" },
  { id: "D-110", title: "Staff kitchen reset", zone: "Level 3 · Kitchen", assignee: "SP", time: "3:30 AM", status: "Assigned" },
  { id: "D-111", title: "Lift interior cleaning", zone: "All levels · Lifts", assignee: "SP", time: "4:15 AM", status: "Assigned" },
];

export const dashboardTabs = ["Operations", "Duties", "Team", "Sites", "Incidents"] as const;

export const useCases = [
  {
    id: "transport",
    label: "Transport facilities",
    challenge: "Coordinate high-traffic zones around arrivals, closures and public access.",
    site: "Central Station",
    image: "/landing/site-commercial.jpg",
    imageAlt: "Cleaning team maintaining a large commercial concourse",
    structure: "Concourse · Platforms · Amenities · Back of house",
    shift: "Overnight · 10:00 PM–5:30 AM",
    duties: ["Platform spill response", "Public amenities rotation", "Escalator detailing"],
  },
  {
    id: "office",
    label: "Office buildings",
    challenge: "Maintain consistent standards across floors without disrupting occupants.",
    site: "Harbour Business Centre",
    image: "/landing/site-office.jpg",
    imageAlt: "Modern commercial office lobby and shared work areas",
    structure: "Lobby · Tenancy floors · Kitchens · End-of-trip",
    shift: "Evening · 6:00 PM–1:00 AM",
    duties: ["Workstation touchpoints", "Kitchen reset", "End-of-trip deep clean"],
  },
  {
    id: "retail",
    label: "Shopping centres",
    challenge: "Keep public areas moving while tracking periodic and after-hours work.",
    site: "West Quarter Centre",
    image: "/landing/site-commercial.jpg",
    imageAlt: "Commercial cleaners machine scrubbing a high-traffic public lobby",
    structure: "Malls · Food court · Amenities · Loading areas",
    shift: "Night · 10:30 PM–6:00 AM",
    duties: ["Food court machine scrub", "Amenities deep clean", "Entry glass detail"],
  },
  {
    id: "fitness",
    label: "Fitness studios",
    challenge: "Give every studio a repeatable hygiene routine between peak periods.",
    site: "Metro Fitness Network",
    image: "/landing/site-fitness.jpg",
    imageAlt: "Modern fitness centre with cardio and strength equipment zones",
    structure: "Studios · Change rooms · Reception · Equipment zones",
    shift: "Closing · 6:00 PM–2:00 AM",
    duties: ["Equipment sanitisation", "Change room reset", "Studio floor clean"],
  },
  {
    id: "hospitality",
    label: "Hospitality venues",
    challenge: "Turn around guest and service spaces against tight operating windows.",
    site: "Riverside Hotel",
    image: "/landing/site-office.jpg",
    imageAlt: "Premium lobby with guest and service areas",
    structure: "Lobby · Guest floors · Events · Service corridors",
    shift: "Overnight · 11:00 PM–7:00 AM",
    duties: ["Public area presentation", "Function room reset", "Service corridor detail"],
  },
  {
    id: "education",
    label: "Education facilities",
    challenge: "Cover varied buildings, term schedules and high-use shared spaces.",
    site: "North Campus",
    image: "/landing/site-commercial.jpg",
    imageAlt: "Large shared facility prepared for daily cleaning operations",
    structure: "Teaching blocks · Library · Labs · Sports hall",
    shift: "Afternoon · 3:30 PM–11:30 PM",
    duties: ["Classroom reset", "Library touchpoints", "Sports hall amenities"],
  },
  {
    id: "healthcare",
    label: "Healthcare environments",
    challenge: "Communicate detailed procedures and capture a clear record of completion.",
    site: "Community Health Centre",
    image: "/landing/site-office.jpg",
    imageAlt: "Professional reception and shared waiting environment",
    structure: "Consult rooms · Waiting areas · Amenities · Staff zones",
    shift: "Evening · 7:00 PM–2:00 AM",
    duties: ["Consult room protocol", "High-touch disinfection", "Clinical waste check"],
  },
  {
    id: "multi-site",
    label: "Multi-site contracts",
    challenge: "Give operations teams a reliable view across many locations and shifts.",
    site: "Metro Contract Portfolio",
    image: "/landing/site-commercial.jpg",
    imageAlt: "Commercial cleaning operation across a large public building",
    structure: "12 sites · 4 supervisors · 3 shift windows",
    shift: "Multiple active shifts",
    duties: ["Portfolio exception review", "Site handover checks", "Evidence audit"],
  },
] as const;

export const cleanerScreens = [
  {
    id: "shift",
    eyebrow: "Night shift · 8 duties",
    title: "Tonight's duties",
    items: ["Lobby floor scrubbing", "Glass doors", "Lift interiors"],
  },
  {
    id: "instructions",
    eyebrow: "Ground floor · Lobby",
    title: "Lobby floor scrubbing",
    items: ["Equipment required", "Chemicals required", "Safety notes"],
  },
  {
    id: "complete",
    eyebrow: "Completion",
    title: "Add completion photos",
    items: ["Add a note", "Report an issue", "Mark as completed"],
  },
] as const;
