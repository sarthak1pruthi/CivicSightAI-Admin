export type WorkerTaskStatus = "assigned" | "in_progress" | "resolved";
export type WorkerTaskPriority = "critical" | "high" | "medium" | "low";

export type WorkerTask = {
  id: string;
  title: string;
  category: string;
  priority: WorkerTaskPriority;
  status: WorkerTaskStatus;
  location: string;
  reportedAt: string;
  dueDate: string;
  description: string;
  citizen: string;
  instructions: string[];
};

export const workerTasks: WorkerTask[] = [
  {
    id: "RPT-2847",
    title: "Large pothole on Main Street",
    category: "Roads & Potholes",
    priority: "high",
    status: "assigned",
    location: "Main Street & Oak Ave",
    reportedAt: "2026-03-06T10:30:00Z",
    dueDate: "2026-03-08T18:00:00Z",
    description:
      "A deep pothole is causing vehicle tire damage near the intersection. Cones are not currently placed.",
    citizen: "John Doe",
    instructions: [
      "Place temporary hazard cones before repair starts.",
      "Capture pre-repair photo for audit trail.",
      "Apply cold patch if weather blocks full asphalt resurfacing.",
    ],
  },
  {
    id: "RPT-2846",
    title: "Broken street light near Central Park",
    category: "Street Lights",
    priority: "medium",
    status: "in_progress",
    location: "Elm Street, Central Park",
    reportedAt: "2026-03-06T09:45:00Z",
    dueDate: "2026-03-09T17:00:00Z",
    description:
      "Street light flickered for several days and is now completely out, reducing visibility at night.",
    citizen: "Sarah Mitchell",
    instructions: [
      "Check lamp fixture and control relay.",
      "Test power feed before replacing bulb.",
      "Record final lux level after restoration.",
    ],
  },
  {
    id: "RPT-2844",
    title: "Water leak on Oak Avenue",
    category: "Water Supply",
    priority: "critical",
    status: "in_progress",
    location: "Oak Avenue, between 3rd & 4th",
    reportedAt: "2026-03-06T07:00:00Z",
    dueDate: "2026-03-07T12:00:00Z",
    description:
      "Continuous surface water flow suggests a possible main line fracture under asphalt.",
    citizen: "Lisa Kim",
    instructions: [
      "Coordinate with water utility emergency unit.",
      "Isolate affected segment before excavation.",
      "Upload completion photos and closure summary.",
    ],
  },
  {
    id: "RPT-2843",
    title: "Damaged sidewalk near Lincoln School",
    category: "Sidewalk Safety",
    priority: "medium",
    status: "resolved",
    location: "Lincoln School, Maple Drive",
    reportedAt: "2026-03-05T14:20:00Z",
    dueDate: "2026-03-07T17:00:00Z",
    description:
      "Raised slab edges and cracks create a tripping risk for children during school hours.",
    citizen: "Tom Wilson",
    instructions: [
      "Replace damaged slab sections.",
      "Install temporary warning paint until cure complete.",
      "Confirm path accessibility for mobility devices.",
    ],
  },
];

export const statusLabel: Record<WorkerTaskStatus, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
};
