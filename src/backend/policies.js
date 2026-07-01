export const AUSTRALIAN_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

export const AUSTRALIAN_CONTACT_ZONES = {
  NSW: { timezone: "Australia/Sydney", observesDst: true },
  VIC: { timezone: "Australia/Melbourne", observesDst: true },
  QLD: { timezone: "Australia/Brisbane", observesDst: false },
  SA: { timezone: "Australia/Adelaide", observesDst: true },
  WA: { timezone: "Australia/Perth", observesDst: false },
  TAS: { timezone: "Australia/Hobart", observesDst: true },
  ACT: { timezone: "Australia/Sydney", observesDst: true },
  NT: { timezone: "Australia/Darwin", observesDst: false },
  BrokenHill: { timezone: "Australia/Broken_Hill", observesDst: true },
  LordHowe: { timezone: "Australia/Lord_Howe", observesDst: true },
};

export const BUILDER_CONTACT_POLICY = {
  email: {
    preferredWindow: "09:00-15:30 local builder time",
    allowedDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    fridayCutoff: "12:00 local builder time",
    avoidPublicHolidays: true,
  },
  phone: {
    preferredWindow: "10:00-15:00 local builder time",
    requiresUserApproval: true,
    avoidMondaysBefore: "10:00",
    avoidFridaysAfter: "12:00",
  },
  followUp: {
    waitBusinessDays: 3,
    maxFollowUps: 2,
    userApprovalRequiredBeforeFirstContact: true,
  },
};

export const LICENCE_SOURCES_BY_STATE = {
  QLD: "QBCC",
  NSW: "NSW_FAIR_TRADING",
  VIC: "BPC_VIC",
  SA: "SA_CBS",
  WA: "WA_BUILDING_ENERGY",
  ACT: "ACT_ACCESS_CANBERRA",
  TAS: "TAS_CBOS",
  NT: "NT_BPB",
};

export const BRIEF_FACT_FIELDS = [
  "homeownerName",
  "projectName",
  "state",
  "suburb",
  "projectType",
  "currentStage",
  "budgetRange",
  "targetStartDate",
  "contractApproach",
  "priorities",
  "concerns",
  "siteLocation",
  "lotPlanDetails",
  "landStatus",
  "siteAccess",
  "siteConditions",
  "planningConstraints",
  "bedrooms",
  "bathrooms",
  "carSpaces",
  "storeys",
  "homeSize",
  "style",
  "keySpaces",
  "mustHaves",
  "niceToHaves",
  "responseDeadline",
];
