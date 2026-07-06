import * as Calendar from 'expo-calendar';

import type { PetEvent } from './types';

export interface CalendarDraft {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes: string;
}

/** Map a Pawk event to the fields the OS "Add Event" dialog expects. */
export function calendarDraft(event: PetEvent): CalendarDraft {
  return {
    title: event.title,
    startDate: new Date(event.startsAt),
    endDate: new Date(event.endsAt),
    location: event.address || event.areaLabel || '',
    notes: event.description || '',
  };
}

/** Present the system "Add to Calendar" dialog for an event (no permission prompt). */
export async function addEventToCalendar(event: PetEvent): Promise<void> {
  await Calendar.createEventInCalendarAsync(calendarDraft(event));
}
