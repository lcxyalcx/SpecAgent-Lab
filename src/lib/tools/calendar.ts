import { tool } from "ai";
import { z } from "zod";

const slotCatalog = [
  {
    start: "2026-05-12T09:00:00.000Z",
    end: "2026-05-12T09:30:00.000Z",
    label: "Tue 09:00 UTC",
  },
  {
    start: "2026-05-12T14:00:00.000Z",
    end: "2026-05-12T14:30:00.000Z",
    label: "Tue 14:00 UTC",
  },
  {
    start: "2026-05-13T16:00:00.000Z",
    end: "2026-05-13T16:30:00.000Z",
    label: "Wed 16:00 UTC",
  },
  {
    start: "2026-05-14T11:00:00.000Z",
    end: "2026-05-14T11:45:00.000Z",
    label: "Thu 11:00 UTC",
  },
  {
    start: "2026-05-15T08:30:00.000Z",
    end: "2026-05-15T09:00:00.000Z",
    label: "Fri 08:30 UTC",
  },
] as const;

export const calendarInputSchema = z
  .object({
    startDate: z.string().datetime().describe("Inclusive ISO start date."),
    endDate: z.string().datetime().describe("Inclusive ISO end date."),
  })
  .refine(
    ({ startDate, endDate }) => new Date(startDate).getTime() <= new Date(endDate).getTime(),
    {
      message: "startDate must be less than or equal to endDate.",
      path: ["endDate"],
    },
  );

export const calendar = tool({
  description:
    "Return deterministic mock availability slots for a given date range.",
  inputSchema: calendarInputSchema,
  execute: async ({ startDate, endDate }) => {
    const rangeStart = new Date(startDate).getTime();
    const rangeEnd = new Date(endDate).getTime();

    const slots = slotCatalog.filter((slot) => {
      const slotStart = new Date(slot.start).getTime();
      return slotStart >= rangeStart && slotStart <= rangeEnd;
    });

    return {
      ok: true,
      tool: "calendar" as const,
      range: {
        startDate,
        endDate,
      },
      latencyMs: deterministicLatency(startDate, endDate),
      slotCount: slots.length,
      availability: slots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        label: slot.label,
      })),
    };
  },
});

function deterministicLatency(startDate: string, endDate: string) {
  return 22 + ((startDate.length + endDate.length) % 8);
}
