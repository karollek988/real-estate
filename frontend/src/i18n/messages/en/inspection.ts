import type { Messages } from "../types";

/** The viewing guide. Same keys as ../sv/inspection.ts; translate the values only. */
const inspection: Messages["inspection"] = {
  title: "Viewing guide",
  lead: "Your complete guide before, during and after the viewing — included in the Peace of Mind Package.",
  loading: "Loading...",
  saved: "Saved",
  header: "{address} · Your complete guide before, during and after the viewing.",
  picker: "Choose which home you want to start or continue the viewing guide for.",

  empty: {
    noAnalysis: {
      title: "No analysis found",
      text: "The viewing guide is included in the Peace of Mind Package. Analyse a home with a Peace of Mind Package to get started.",
      action: "Start an analysis",
    },
    requiresPackage: {
      title: "Requires the Peace of Mind Package",
      text: "This home has no full analysis linked to your account. The viewing guide is included in the Peace of Mind Package.",
      action: "Start an analysis",
    },
    loadFailed: {
      title: "Could not load the inspection",
      text: "Something went wrong. Please try again in a moment.",
      action: "To the overview",
    },
    noSummary: {
      title: "No summary yet",
      text: "Go back to step 2 and complete the walkthrough to generate a summary.",
      action: "To step 2",
    },
  },

  steps: {
    before: { title: "Before the viewing", subtitle: "Preparation & info" },
    during: { title: "During the viewing", subtitle: "Step by step" },
    after: { title: "After the viewing", subtitle: "Follow-up & analysis" },
  },

  step1: {
    prepTitle: "Before your viewing",
    prepLead: "Three steps to prepare properly — know exactly which documents you need and where to find them.",
    knownTitle: "What the analysis already knows",
    knownLead: "Based on your completed analysis of the home.",
    docsTitle: "Documents to upload",
    docsLead: "Upload relevant documents to strengthen the analysis and get more precise recommendations.",
    downloadTitle: "Download checklist",
    downloadLead: "Download our complete checklist so that you have it with you at every step.",
    download: "Download checklist",
    ready: {
      title: "Ready to move on?",
      text: "Once you have collected the documents and gone through the checklist, you are ready for the next step.",
      action: "Go on to step 2",
    },
    brf: {
      title: "The association's finances",
      noConcerns: "The housing association analysis does not point out any key figure outside the usual levels.",
      awaitingDue: "The housing association analysis is being reviewed by Köpanalys' experts and is ready by {due} at the latest. The points to keep an eye on are shown here once it is published.",
      awaiting: "The housing association analysis is being reviewed by Köpanalys' experts. The points to keep an eye on are shown here once it is published.",
      notBrf: "The home does not belong to a housing association.",
    },
    brokerQuestions: "Questions for the estate agent",
    brfQuestions: "Questions for the association",
    tips: {
      title: "Tips",
      text: "The more information you upload, the better our analysis becomes. Missing a document? Contact the board or the estate agent.",
    },
  },

  step2: {
    title: "During the viewing",
    lead: "Three things to do while you are on site — then you go through the home room by room below.",
    guide: {
      rooms: {
        title: "Go through every room",
        text: "Tick off the checkpoints in the checklist below, room by room. Feel free to skip rooms that do not exist in this particular home.",
      },
      notes: {
        title: "Note damage & ask on the spot",
        text: "Write down anything you are unsure about in My observations alongside, so that you still have it when you compare homes afterwards.",
      },
      photos: {
        title: "Photograph what you want to document",
        text: "Upload photos right at the checkpoint. Especially valuable for damp, cracks or anything else that is hard to remember afterwards.",
      },
    },
    roomsTitle: "Room by room",
    observationsTitle: "My observations",
    done: {
      title: "Finished the walkthrough?",
      text: "We put together a professional summary for you.",
      action: "Create summary",
    },
  },

  download: {
    heading: "Köpanalys — Viewing checklist",
    needs: "What you need:",
    fileName: "viewing-checklist.txt",
  },

  prep: {
    markDone: "Mark as done",
    markUndone: "Mark as not done",
    needs: "What you need",
    gather_documents: {
      title: "Get the right documents",
      description: "Most people do not know which documents they actually need to ask for. Here are the five most important — and exactly where to find them.",
      items: {
        annualReport: {
          name: "Annual report (the housing association's latest)",
          whereToFind: "Ask the estate agent for it, or search for the association's name on allabrf.se — free and open to everyone.",
        },
        bylaws: {
          name: "Bylaws",
          whereToFind: "Usually on the association's own website under \"Documents\"; otherwise the estate agent or the board will send them on request.",
        },
        energy: {
          name: "Energy declaration",
          whereToFind: "Search the address at boverket.se/energideklaration — free of charge and linked to the property, not the seller.",
        },
        maintenance: {
          name: "Maintenance plan",
          whereToFind: "Request it from the estate agent or the association's board. Shows planned maintenance and the risk of future fee increases.",
        },
        floorPlan: {
          name: "Floor plan",
          whereToFind: "Usually already in the listing on Hemnet or Booli; otherwise from the estate agent.",
        },
      },
    },
    check_finances_and_property: {
      title: "Review finances & condition",
      description: "With the documents in hand — these are the concrete figures and years to look for, and what they actually mean.",
      items: {
        loanRatio: {
          name: "Loan level (SEK per square metre)",
          whereToFind:
            "Worked out from the association's total loans divided by the living area, in the directors' report of the annual report. Above roughly SEK 15,000 per m² is worth asking the board about.",
        },
        feeTrend: {
          name: "Fee development over the last 3–5 years",
          whereToFind: "Compare several years' annual reports, or ask the board or the estate agent directly whether the fee has been raised recently or is planned to be raised.",
        },
        result: {
          name: "Result and cash flow",
          whereToFind: "The income statement in the annual report shows whether the association is making a profit or a loss — a recurring loss is a warning sign.",
        },
        renovations: {
          name: "Year built and major renovations (pipes, roof, facade)",
          whereToFind: "Ask the estate agent about the renovation history. Anything older than 30–40 years should either have been dealt with or be in the maintenance plan.",
        },
      },
    },
    prepare_questions: {
      title: "Prepare your questions",
      description: "Start from what is actually missing in your analysis, not guesses — so that you know exactly what to ask on site.",
      items: {
        questions: {
          name: "Questions for the estate agent and the association",
          whereToFind: "Already filled in for you in the \"Questions for the estate agent\" and \"Questions for the association\" cards alongside, based on what is missing in your analysis.",
        },
        area: {
          name: "The area's schools, transport links and future plans",
          whereToFind: "See the Area analysis chapter in your report before the viewing, so that you can ask follow-up questions on site instead of reading up afterwards.",
        },
      },
    },
  },

  rooms: {
    entrance: { label: "Entrance", checkpoints: { door_lock: "Door and lock", floor: "Floor", walls: "Walls" } },
    hall: { label: "Hall", checkpoints: { floor: "Floor", storage: "Storage", ventilation: "Ventilation" } },
    kitchen: { label: "Kitchen", checkpoints: { appliances: "Appliances", countertop: "Worktop", sink_drain: "Drain under the sink", fan: "Ventilation/extractor fan" } },
    bathroom: { label: "Bathroom", checkpoints: { waterproofing: "Waterproofing", floor_drain: "Floor drain", tiles_grout: "Grout and tiles", ventilation: "Ventilation" } },
    living_room: { label: "Living room", checkpoints: { floor: "Floor", walls_ceiling: "Walls and ceiling", windows: "Windows" } },
    bedroom: { label: "Bedroom", checkpoints: { floor: "Floor", walls_ceiling: "Walls and ceiling", windows: "Windows" } },
    windows: { label: "Windows", checkpoints: { frames_sealing: "Frames and sealing", condensation: "Condensation/damp", glass: "Glass" } },
    roof: { label: "Roof", checkpoints: { roofing: "Roof covering", chimney: "Chimney", gutters: "Gutters" } },
    facade: { label: "Facade", checkpoints: { cladding: "Render/cladding", cracks: "Cracks", plinth: "Plinth" } },
    balcony: { label: "Balcony", checkpoints: { railing: "Railing", waterproofing: "Waterproofing", drainage: "Drainage" } },
    basement: { label: "Basement", checkpoints: { moisture_smell: "Damp/smell", floor: "Floor", foundation_wall: "Foundation wall" } },
    electrical: { label: "Electrics", checkpoints: { fuse_box: "Fuse box", outlets_switches: "Sockets and switches", visible_wiring: "Visible wiring" } },
    heating: { label: "Heating", checkpoints: { heat_source: "Heat source/radiators", thermostats: "Thermostats", water_heater: "Hot water heater" } },
    ventilation: { label: "Ventilation", checkpoints: { exhaust_air: "Extract air", supply_air: "Supply air", filters: "Filters/cleaning" } },
    drainage: { label: "Drainage", checkpoints: { floor_drains: "Floor drains", pipes: "Pipes", visible_leaks: "Visible leaks" } },
    attic: { label: "Attic", checkpoints: { insulation: "Insulation", mold_moisture: "Damp/mould", roof_trusses: "Roof trusses" } },
  },

  severities: {
    ok: "OK",
    minor: "Minor remark",
    major: "Serious remark",
  },
  checkpoint: {
    notes: "Notes...",
    addPhoto: "Add photo",
    uploading: "Uploading...",
    photos: "{count, plural, one {# photo} other {# photos}}",
  },

  observations: {
    placeholder: "Write your own observation, e.g. a damp smell in the bathroom...",
    add: "Add",
    remove: "Remove observation",
    examples: {
      damp: "Damp smell",
      cracks: "Cracks",
      waterDamage: "Water damage",
      uneven: "Uneven floor",
      paint: "Paint damage",
      electrical: "Electrical fault",
    },
  },

  documents: {
    annual_report: "Annual report",
    inspection_report: "Survey report",
    energy_declaration: "Energy declaration",
    floor_plan: "Floor plan",
    maintenance_plan: "Maintenance plan",
    bylaws: "Bylaws",
    other: "Other",
  },
  dropzone: {
    drop: "Drag and drop files here",
    or: "or",
    choose: "Choose files",
    uploading: "Uploading...",
    recommended: "Recommended documents",
    pdf: "{name} (PDF)",
    genericError: "Something went wrong with the upload.",
    noProperty: "No home chosen.",
  },

  gaps: {
    brf_identity: "Housing association",
    annual_report: "Annual report",
    maintenance_history: "Maintenance history",
    energy_declaration: "Energy declaration",
    parking: "Parking/garage",
    bylaws: "Bylaws",
    missing: "Missing — upload documents to strengthen the analysis.",
    upload: "Upload",
    known: {
      available: "Available",
      uploaded: "Uploaded",
      parkingExists: "Parking available",
      garageExists: "Garage available",
      noParking: "No parking stated",
    },
  },

  questions: {
    broker: {
      annualReport: "Can you send the association's latest annual report?",
      maintenancePlan: "Is there a maintenance plan and has it been followed historically?",
      energyDeclaration: "Is there a valid energy declaration for the home?",
      previousSale: "Why is the home being sold now, and does its condition match the previous sale on {date}?",
      knownFaults: "Are there known faults or remarks that do not appear in the listing?",
    },
    brf: {
      bylaws: "Can the board share the association's bylaws?",
      renovations: "Are any renovations or fee increases planned for the coming years?",
      loans: "What do the association's loans and fixed-interest terms look like?",
      parking: "Does the association manage parking/garages, and is there a queue?",
    },
  },

  summary: {
    recommendation: "Overall recommendation",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    futureCosts: "Possible future costs",
    followUpTitle: "Recommended follow-up",
    missingDocumentation: "Missing documentation",
    openQuestions: "Open questions",
    empty: "Go through the checklist under \"During the viewing\" to generate a full summary.",

    major: "{room} – {checkpoint}: {note}",
    majorNoNote: "{room} – {checkpoint} shows a serious remark.",
    minor: "{room} – {checkpoint}: {note}",
    minorNoNote: "{room} – {checkpoint} shows a minor remark.",
    possibleAction: "Possible action: {room} ({checkpoint}).",
    okPoints: "{count, plural, one {# checkpoint was} other {# checkpoints were}} reviewed without remarks.",
    noRemarks: "No remarks were noted during the walkthrough.",
    ownObservation: "Own observation: {text}",
    followUp: {
      major: "Request a more thorough survey by a certified surveyor for the serious remarks.",
      minor: "Ask the seller or the estate agent to comment on the minor remarks before bidding.",
      missing: "Complete the missing documentation before the final decision.",
      none: "No particular follow-up points beyond the ordinary process.",
    },
    overall: {
      major: "Serious remarks were noted. We recommend a more thorough survey before a bid is placed, and that the cost of remedial work is taken into account in the bidding.",
      several: "No serious remarks, but several minor points and/or missing documentation should be clarified before a final decision.",
      few: "The walkthrough shows a generally good picture of the home, with a few points to follow up before purchase.",
      clean: "The walkthrough shows no remarks. The home appears well maintained on the basis of the walkthrough.",
      notDone: "The walkthrough has not been carried out yet. Go through the checklist room by room to get a full assessment.",
    },
  },
};

export default inspection;
