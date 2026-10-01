/**
 * Seed data definition for CampusPass
 * FR-001, FR-002, FR-004, FR-006, FR-007, FR-012, FR-013, FR-016
 * Passwords hashed with bcrypt cost 12. Password: Test@1234
 * Dates generated dynamically relative to current date so data never goes stale.
 */

import bcrypt from 'bcrypt';

export const SHARED_PASSWORD_PLAIN = 'Test@1234';
export const BCRYPT_COST = 12;

export interface SeedUser {
  id?: number;
  username: string;
  email: string;
  full_name: string;
  school_id: string;
  password_hash?: string;
  role: 'participant' | 'organizer' | 'admin';
  is_active: number;
}

export interface SeedEvent {
  id?: number;
  organizer_id: number;
  title: string;
  description: string;
  category: 'Academic' | 'Sports' | 'Arts & Culture' | 'Career & Networking' | 'Community & Service' | 'Technology & STEM';
  venue: string;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  capacity: number;
  requires_approval: number;
  status: 'published' | 'cancelled';
}

export interface SeedRegistration {
  id?: number;
  event_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  registered_at: string;
  decided_at?: string | null;
}

export interface SeedNotification {
  id?: number;
  user_id: number;
  type: string;
  message: string;
  event_id: number | null;
  is_read: number;
  created_at: string;
}

/**
 * Format date relative to current time: YYYY-MM-DD HH:mm:ss
 */
export function offsetDateTime(days: number, hours: number = 0, minutes: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours, d.getMinutes() + minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function generateSeedUsers(_schoolName?: string): Promise<SeedUser[]> {
  const password_hash = await bcrypt.hash(SHARED_PASSWORD_PLAIN, BCRYPT_COST);

  const users: SeedUser[] = [
    {
      username: 'admin01',
      email: 'admin01@uc.edu.ph',
      full_name: 'Engr. Danilo B. Cabahug (Dean of Student Affairs)',
      school_id: 'ADM-2024-001',
      password_hash,
      role: 'admin',
      is_active: 1,
    },
    {
      username: 'organizer01',
      email: 'organizer01@uc.edu.ph',
      full_name: 'Prof. Maria Theresa Gomez (College of Computer Studies)',
      school_id: 'FAC-2024-101',
      password_hash,
      role: 'organizer',
      is_active: 1,
    },
    {
      username: 'organizer02',
      email: 'organizer02@uc.edu.ph',
      full_name: 'Joshua Neil Alcantara (Supreme Student Council President)',
      school_id: 'STU-2024-201',
      password_hash,
      role: 'organizer',
      is_active: 1,
    },
  ];

  const studentNames = [
    'Amara D. Mendoza',
    'Liam Kyle Fernandez',
    'Sofia Isabelle Tan',
    'Kenji Paolo Yap',
    'Fatima Joyce Suico',
    'Lucas Gabriel Ouano',
    'Maya Patricia Cortes',
    'Nathaniel James Echavez',
    'Zoe Marie Villamor',
    'Ethan Matthew Seno',
    'Hannah Mae Ceniza',
    'David Christian Dabon',
  ];

  studentNames.forEach((name, idx) => {
    const num = idx + 1;
    const numStr = num.toString().padStart(2, '0');
    users.push({
      username: `student${numStr}`,
      email: `student${numStr}@uc.edu.ph`,
      full_name: name,
      school_id: `26-102${numStr}-M`,
      password_hash,
      role: 'participant',
      is_active: num === 12 ? 0 : 1, // student12 deactivated for testing
    });
  });

  return users;
}

export function generateSeedEvents(_schoolName?: string): SeedEvent[] {
  return [
    // 1. OPEN EVENT (Upcoming, published, seats remaining)
    {
      organizer_id: 2,
      title: 'Annual Research Colloquium',
      description: 'Undergraduate and graduate research symposium showcasing original student innovations across computer science, engineering, and environmental sciences.',
      category: 'Academic',
      venue: 'Grand Auditorium',
      starts_at: offsetDateTime(7, 9, 0),
      ends_at: offsetDateTime(7, 17, 0),
      registration_deadline: offsetDateTime(6, 23, 59),
      capacity: 150,
      requires_approval: 0,
      status: 'published',
    },
    // 2. OPEN EVENT (Upcoming, Codefest)
    {
      organizer_id: 2,
      title: '24-Hour Codefest: Smart Urban Solutions',
      description: 'Collaborative programming marathon addressing civic technology, transit systems, and municipal automation with industry mentors.',
      category: 'Technology & STEM',
      venue: 'Innovation Lab 401',
      starts_at: offsetDateTime(10, 10, 0),
      ends_at: offsetDateTime(11, 12, 0),
      registration_deadline: offsetDateTime(9, 18, 0),
      capacity: 60,
      requires_approval: 0,
      status: 'published',
    },
    // 3. REQUIRES APPROVAL (Upcoming, Community & Service)
    {
      organizer_id: 3,
      title: 'Voluntary Blood Donation Drive',
      description: 'Community blood donation initiative coordinated with the local health chapter. Registered donors undergo medical screening before final schedule confirmation.',
      category: 'Community & Service',
      venue: 'Health Services Pavilion',
      starts_at: offsetDateTime(12, 8, 30),
      ends_at: offsetDateTime(12, 16, 0),
      registration_deadline: offsetDateTime(10, 12, 0),
      capacity: 40,
      requires_approval: 1,
      status: 'published',
    },
    // 4. FULL EVENT (Capacity 2, filled with 2 approved registrations)
    {
      organizer_id: 2,
      title: 'Advanced Marine Simulator Masterclass',
      description: 'Specialized hardware session on the full-mission bridge and engine room simulator. Limited to two console workstations for certified senior cadets.',
      category: 'Technology & STEM',
      venue: 'Simulator Complex, Bay B',
      starts_at: offsetDateTime(14, 14, 0),
      ends_at: offsetDateTime(14, 18, 0),
      registration_deadline: offsetDateTime(13, 12, 0),
      capacity: 2,
      requires_approval: 0,
      status: 'published',
    },
    // 5. REGISTRATION DEADLINE PASSED (Upcoming start, deadline in past)
    {
      organizer_id: 3,
      title: 'Inter-Collegiate Parliamentary Debate Briefing',
      description: 'Technical briefing and tournament bracket draw for debaters representing collegiate academic societies.',
      category: 'Academic',
      venue: 'Audio-Visual Hall 1',
      starts_at: offsetDateTime(5, 13, 0),
      ends_at: offsetDateTime(5, 16, 0),
      registration_deadline: offsetDateTime(-1, 12, 0),
      capacity: 50,
      requires_approval: 0,
      status: 'published',
    },
    // 6. ALREADY STARTED (Started 2 hours ago, ends in 4 hours)
    {
      organizer_id: 2,
      title: 'Robotics Prototyping Workshop',
      description: 'Hands-on hardware lab covering microcontrollers, sensor integration, and motor controllers for competitive autonomous robots.',
      category: 'Technology & STEM',
      venue: 'Engineering Workshop 2',
      starts_at: offsetDateTime(0, -2, 0),
      ends_at: offsetDateTime(0, 4, 0),
      registration_deadline: offsetDateTime(0, -3, 0),
      capacity: 35,
      requires_approval: 0,
      status: 'published',
    },
    // 7. CANCELLED EVENT (Upcoming, but status cancelled)
    {
      organizer_id: 3,
      title: 'Charity 5K Fun Run',
      description: 'Community charity fun run along the perimeter circuit. Cancelled due to scheduled road maintenance.',
      category: 'Sports',
      venue: 'Perimeter Circuit',
      starts_at: offsetDateTime(16, 6, 0),
      ends_at: offsetDateTime(16, 10, 0),
      registration_deadline: offsetDateTime(15, 18, 0),
      capacity: 100,
      requires_approval: 0,
      status: 'cancelled',
    },
    // 8. ENDED EVENT 1 (Past)
    {
      organizer_id: 2,
      title: 'First Semester Freshmen Orientation',
      description: 'General orientation session introducing incoming students to student services, library resources, and departmental faculty.',
      category: 'Community & Service',
      venue: 'Gymnasium',
      starts_at: offsetDateTime(-14, 8, 0),
      ends_at: offsetDateTime(-14, 17, 0),
      registration_deadline: offsetDateTime(-15, 18, 0),
      capacity: 500,
      requires_approval: 0,
      status: 'published',
    },
    // 9. ENDED EVENT 2 (Past)
    {
      organizer_id: 3,
      title: 'Collegiate Leadership Roundtable',
      description: 'Discussion forum for student organization officers on budget management, event planning, and student council governance.',
      category: 'Career & Networking',
      venue: 'Conference Suite',
      starts_at: offsetDateTime(-7, 10, 0),
      ends_at: offsetDateTime(-7, 15, 0),
      registration_deadline: offsetDateTime(-8, 17, 0),
      capacity: 30,
      requires_approval: 0,
      status: 'published',
    },
    // 10. OPEN EVENT (Upcoming, Career Fair)
    {
      organizer_id: 2,
      title: 'Industry Career and Internship Fair',
      description: 'Networking and recruitment exposition connecting technical students and graduating seniors with regional employers and partner firms.',
      category: 'Career & Networking',
      venue: 'Multi-Purpose Activity Complex',
      starts_at: offsetDateTime(18, 9, 0),
      ends_at: offsetDateTime(18, 16, 30),
      registration_deadline: offsetDateTime(17, 18, 0),
      capacity: 300,
      requires_approval: 0,
      status: 'published',
    },
    // 11. OPEN EVENT (Upcoming, Culture Recital)
    {
      organizer_id: 3,
      title: 'Traditional Folk Dance and Musical Recital',
      description: 'Annual cultural presentation featuring student performing arts ensembles in acoustic string arrangements and regional dance numbers.',
      category: 'Arts & Culture',
      venue: 'Recital Hall',
      starts_at: offsetDateTime(20, 19, 0),
      ends_at: offsetDateTime(20, 21, 30),
      registration_deadline: offsetDateTime(20, 12, 0),
      capacity: 120,
      requires_approval: 0,
      status: 'published',
    },
    // 12. OPEN EVENT (Upcoming, Sports)
    {
      organizer_id: 3,
      title: 'Inter-Department Table Tennis Tournament',
      description: 'Collegiate singles and doubles table tennis competition for student athletes across academic departments.',
      category: 'Sports',
      venue: 'Indoor Gymnasium Court 2',
      starts_at: offsetDateTime(22, 9, 0),
      ends_at: offsetDateTime(22, 18, 0),
      registration_deadline: offsetDateTime(21, 20, 0),
      capacity: 32,
      requires_approval: 0,
      status: 'published',
    },
    // 13. REQUIRES APPROVAL (Upcoming, Cybersecurity)
    {
      organizer_id: 2,
      title: 'Defensive Cybersecurity Bootcamp',
      description: 'Intensive network defense, intrusion analysis, and forensic simulation. Prerequisite background in networking protocols recommended.',
      category: 'Technology & STEM',
      venue: 'Cyber Range Lab 3',
      starts_at: offsetDateTime(24, 13, 0),
      ends_at: offsetDateTime(24, 19, 0),
      registration_deadline: offsetDateTime(23, 15, 0),
      capacity: 20,
      requires_approval: 1,
      status: 'published',
    },
    // 14. OPEN EVENT (Upcoming, Mental Health Clinic)
    {
      organizer_id: 3,
      title: 'Mindfulness and Exam Preparation Workshop',
      description: 'Practical cognitive resilience techniques and stress management exercises designed for students preparing for midterm assessments.',
      category: 'Community & Service',
      venue: 'Guidance Seminar Room',
      starts_at: offsetDateTime(26, 14, 0),
      ends_at: offsetDateTime(26, 16, 30),
      registration_deadline: offsetDateTime(25, 23, 59),
      capacity: 45,
      requires_approval: 0,
      status: 'published',
    },
    // 15. OPEN EVENT (Upcoming, Photography)
    {
      organizer_id: 3,
      title: 'Student Photography and Visual Arts Exhibition',
      description: 'Curated gallery displaying student photography documenting campus architecture, civic life, and regional cultural heritage.',
      category: 'Arts & Culture',
      venue: 'Atrium Exhibition Hall',
      starts_at: offsetDateTime(28, 10, 0),
      ends_at: offsetDateTime(30, 17, 0),
      registration_deadline: offsetDateTime(27, 18, 0),
      capacity: 80,
      requires_approval: 0,
      status: 'published',
    },
    // 16. OPEN EVENT (Upcoming, AI Governance)
    {
      organizer_id: 2,
      title: 'Collegiate Forum on Artificial Intelligence Ethics',
      description: 'Panel forum featuring regional computing faculty, software engineers, and student leaders discussing responsible technology development.',
      category: 'Academic',
      venue: 'Centennial Hall',
      starts_at: offsetDateTime(32, 15, 0),
      ends_at: offsetDateTime(32, 18, 0),
      registration_deadline: offsetDateTime(31, 17, 0),
      capacity: 90,
      requires_approval: 0,
      status: 'published',
    },
    // 17. OPEN EVENT (Upcoming, Volleyball)
    {
      organizer_id: 3,
      title: 'Intramural Volleyball Tournament Opening',
      description: 'Opening matches of the inter-departmental volleyball league. Spectators must reserve admission passes.',
      category: 'Sports',
      venue: 'Covered Court',
      starts_at: offsetDateTime(34, 17, 0),
      ends_at: offsetDateTime(34, 21, 0),
      registration_deadline: offsetDateTime(33, 18, 0),
      capacity: 150,
      requires_approval: 0,
      status: 'published',
    },
    // 18. REQUIRES APPROVAL (Upcoming, Grant Writing)
    {
      organizer_id: 2,
      title: 'Undergraduate Research Grant Writing Workshop',
      description: 'Special mentoring workshop for senior science and engineering students preparing formal proposals for competitive external research grants.',
      category: 'Academic',
      venue: 'Faculty Conference Room',
      starts_at: offsetDateTime(36, 13, 0),
      ends_at: offsetDateTime(36, 16, 30),
      registration_deadline: offsetDateTime(35, 17, 0),
      capacity: 18,
      requires_approval: 1,
      status: 'published',
    },
    // 19. OPEN EVENT (Upcoming, Software Sprint)
    {
      organizer_id: 2,
      title: 'Open-Source Civic Software Sprint',
      description: 'Hands-on sprint building open tools and educational software for student organizations and community initiatives.',
      category: 'Technology & STEM',
      venue: 'Software Incubator',
      starts_at: offsetDateTime(38, 10, 0),
      ends_at: offsetDateTime(38, 18, 0),
      registration_deadline: offsetDateTime(37, 20, 0),
      capacity: 50,
      requires_approval: 0,
      status: 'published',
    },
    // 20. OPEN EVENT (Upcoming, Theater)
    {
      organizer_id: 3,
      title: 'Student Drama Guild Ensemble Presentation',
      description: 'Live dramatic theater performance staged and produced entirely by student actors, set designers, and stage crews.',
      category: 'Arts & Culture',
      venue: 'Black Box Studio',
      starts_at: offsetDateTime(40, 19, 30),
      ends_at: offsetDateTime(40, 22, 0),
      registration_deadline: offsetDateTime(40, 14, 0),
      capacity: 75,
      requires_approval: 0,
      status: 'published',
    },
  ];
}

export function generateSeedRegistrations(): SeedRegistration[] {
  return [
    // Event 1 (Colloquium): approved registrations
    { event_id: 1, user_id: 4, status: 'approved', registered_at: offsetDateTime(-2, 10, 0), decided_at: offsetDateTime(-2, 10, 0) },
    { event_id: 1, user_id: 5, status: 'approved', registered_at: offsetDateTime(-2, 11, 30), decided_at: offsetDateTime(-2, 11, 30) },
    { event_id: 1, user_id: 6, status: 'cancelled', registered_at: offsetDateTime(-3, 9, 15), decided_at: offsetDateTime(-2, 14, 0) },

    // Event 3 (Blood Drive - requires approval): pending, approved, rejected
    { event_id: 3, user_id: 4, status: 'pending', registered_at: offsetDateTime(-1, 8, 30), decided_at: null },
    { event_id: 3, user_id: 5, status: 'pending', registered_at: offsetDateTime(-1, 9, 15), decided_at: null },
    { event_id: 3, user_id: 7, status: 'approved', registered_at: offsetDateTime(-2, 14, 0), decided_at: offsetDateTime(-1, 10, 0) },
    { event_id: 3, user_id: 8, status: 'rejected', registered_at: offsetDateTime(-2, 15, 30), decided_at: offsetDateTime(-1, 10, 5) },

    // Event 4 (FULL EVENT - capacity 2): 2 approved registrations (student01=4, student02=5)
    { event_id: 4, user_id: 4, status: 'approved', registered_at: offsetDateTime(-3, 14, 0), decided_at: offsetDateTime(-3, 14, 0) },
    { event_id: 4, user_id: 5, status: 'approved', registered_at: offsetDateTime(-3, 14, 2), decided_at: offsetDateTime(-3, 14, 2) },

    // Event 7 (Cancelled event with existing registrations)
    { event_id: 7, user_id: 4, status: 'approved', registered_at: offsetDateTime(-4, 10, 0), decided_at: offsetDateTime(-4, 10, 0) },
    { event_id: 7, user_id: 9, status: 'approved', registered_at: offsetDateTime(-4, 11, 0), decided_at: offsetDateTime(-4, 11, 0) },

    // Event 8 (Past ended event): approved registrations
    { event_id: 8, user_id: 4, status: 'approved', registered_at: offsetDateTime(-16, 9, 0), decided_at: offsetDateTime(-16, 9, 0) },
    { event_id: 8, user_id: 5, status: 'approved', registered_at: offsetDateTime(-16, 10, 0), decided_at: offsetDateTime(-16, 10, 0) },

    // Event 9 (Past ended event): approved registrations
    { event_id: 9, user_id: 4, status: 'approved', registered_at: offsetDateTime(-9, 14, 0), decided_at: offsetDateTime(-9, 14, 0) },

    // Event 13 (Cybersecurity - requires approval): pending
    { event_id: 13, user_id: 4, status: 'pending', registered_at: offsetDateTime(-1, 15, 0), decided_at: null },
  ];
}

export function generateSeedNotifications(): SeedNotification[] {
  return [
    {
      user_id: 4, // student01
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive has been submitted and is awaiting organizer approval.',
      event_id: 3,
      is_read: 0,
      created_at: offsetDateTime(-1, 8, 30),
    },
    {
      user_id: 4, // student01
      type: 'EVENT_UPDATE',
      message: 'Notice: Charity 5K Fun Run has been cancelled by the organizer.',
      event_id: 7,
      is_read: 0,
      created_at: offsetDateTime(-1, 14, 0),
    },
    {
      user_id: 8, // student05
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive was declined by the organizer.',
      event_id: 3,
      is_read: 1,
      created_at: offsetDateTime(-1, 10, 5),
    },
    {
      user_id: 7, // student04
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive has been approved.',
      event_id: 3,
      is_read: 0,
      created_at: offsetDateTime(-1, 10, 0),
    },
  ];
}
