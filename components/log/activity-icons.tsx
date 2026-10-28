import {
  Baby, Bath, Briefcase, Building2, CookingPot, Dices, Drama, Dumbbell, Footprints, Gamepad2, HeartHandshake, MapPin,
  Palette, School, Shapes, Sparkles, Sun, Trees, Tv, Users, Volleyball,
} from "lucide-react";
import type { ReactNode } from "react";

// Drawings from the S04 mockup for its eight tiles; lucide for the rest of the Appendix A library.
const MOCKUP: Record<string, string> = {
  playground: '<path d="M5 21V5h14v16"/><path d="M9 5v9M15 5v9"/><path d="M8 14h8"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  reading: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M19 19v2H6"/>',
  screen_time: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sensory_play: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 17.5L3.5 14a1.5 1.5 0 0 1 2.6-1.4L8 15"/>',
  swimming: '<path d="M3 15c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><path d="M3 19c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><circle cx="15" cy="6.5" r="2"/><path d="M6 11.5l4-4 3 3"/>',
  building_toys: '<rect x="3.5" y="12" width="8" height="8" rx="1.5"/><rect x="12.5" y="12" width="8" height="8" rx="1.5"/><rect x="8" y="3.5" width="8" height="8" rx="1.5"/>',
  therapy: '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 13.2s-3-1.8-3-4a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2.2-3 4-3 4z"/>',
};

const LUCIDE: Record<string, typeof Trees> = {
  outdoor_play: Trees, art: Palette, video_games: Gamepad2, pretend_play: Drama, sports: Volleyball, playdate: Users,
  school: School, tummy_time: Baby, bath: Bath, walk: Footprints, play_mat: Shapes, skin_to_skin: HeartHandshake,
  outside_time: Sun, tv_movies: Tv, games: Dices, cooking: CookingPot, exercise: Dumbbell, social_outing: Users,
  community_outing: MapPin, day_program: Building2, work_volunteer: Briefcase,
};

export function ActivityIcon({ id, size = 24 }: { id: string; size?: number }): ReactNode {
  if (MOCKUP[id]) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MOCKUP[id] }} />
    );
  }
  const Icon = LUCIDE[id] ?? Sparkles;
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}
