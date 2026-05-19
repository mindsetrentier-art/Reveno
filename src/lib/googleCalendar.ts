import { getAccessToken } from './firebase';

export interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export const createCalendarEvent = async (event: CalendarEvent) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available. Please sign in again.');
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create calendar event');
  }

  return response.json();
};
