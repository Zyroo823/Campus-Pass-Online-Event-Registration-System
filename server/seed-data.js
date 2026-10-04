/**
 * Seed data definition for CampusPass
 * Exactly 1 Admin, 1 Organizer, and 4 Student accounts
 * FR-001, FR-002, FR-004, FR-006, FR-007, FR-008, FR-009, FR-010, FR-012, FR-013, FR-015, FR-016
 * Passwords hashed with bcrypt cost 12. Password: Test@1234
 * Dates generated dynamically with base = later of today and SEED_MIN_DATE (default 2026-10-19).
 */

import bcrypt from 'bcrypt';

export const SHARED_PASSWORD_PLAIN = 'Test@1234';
export const BCRYPT_COST = 12;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function formatDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function getBaseDate() {
  const today = new Date();
  const minDateStr = process.env.SEED_MIN_DATE || '2026-10-19';
  const minDate = new Date(minDateStr);
  return today > minDate ? today : minDate;
}

export function offsetFromBase(days, hours = 0, minutes = 0) {
  const base = getBaseDate();
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return formatDateTime(d);
}

export function offsetFromToday(days, hours = 0, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours, d.getMinutes() + minutes, 0, 0);
  return formatDateTime(d);
}

export async function generateSeedUsers() {
  const password_hash = await bcrypt.hash(SHARED_PASSWORD_PLAIN, BCRYPT_COST);

  const users = [
    // 1 Admin account
    {
      username: 'admin01',
      email: 'admin01@uc.edu.ph',
      full_name: 'Clent Kurt Alforo',
      school_id: 'ADM-2024-001',
      password_hash,
      role: 'admin',
      is_active: 1,
    },
    // 1 Organizer account
    {
      username: 'organizer01',
      email: 'organizer01@uc.edu.ph',
      full_name: 'John Kurt Senerpida',
      school_id: 'FAC-2024-101',
      password_hash,
      role: 'organizer',
      is_active: 1,
    },
    // 4 Student accounts
    {
      username: 'student01',
      email: 'student01@uc.edu.ph',
      full_name: 'John Kurt Alforo',
      school_id: '26-10201-M',
      password_hash,
      role: 'participant',
      is_active: 1,
    },
    {
      username: 'student02',
      email: 'student02@uc.edu.ph',
      full_name: 'Liel Joseph C. Ceniza',
      school_id: '26-10202-M',
      password_hash,
      role: 'participant',
      is_active: 1,
    },
    {
      username: 'student03',
      email: 'student03@uc.edu.ph',
      full_name: 'John Mar Z. Aledon',
      school_id: '26-10203-M',
      password_hash,
      role: 'participant',
      is_active: 1,
    },
    {
      username: 'student04',
      email: 'student04@uc.edu.ph',
      full_name: 'Clent John B. Senerpida',
      school_id: '26-10204-M',
      password_hash,
      role: 'participant',
      is_active: 1,
    },
  ];

  return users;
}

export function generateSeedEvents() {
  return [
    {
      organizer_id: 2,
      title: 'Annual Research Colloquium',
      description: 'Undergraduate and graduate research symposium showcasing original student innovations across computer science, engineering, and environmental sciences.',
      category: 'Academic',
      venue: 'Grand Auditorium',
      starts_at: offsetFromBase(2, 9, 0),
      ends_at: offsetFromBase(2, 17, 0),
      registration_deadline: offsetFromBase(1, 23, 59),
      capacity: 150,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: '24-Hour Codefest: Smart Urban Solutions',
      description: 'Collaborative programming marathon addressing civic technology, transit systems, and municipal automation with industry mentors.',
      category: 'Technology & STEM',
      venue: 'Innovation Lab 401',
      starts_at: offsetFromBase(5, 10, 0),
      ends_at: offsetFromBase(6, 12, 0),
      registration_deadline: offsetFromBase(4, 18, 0),
      capacity: 60,
      fee_amount: 50.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Voluntary Blood Donation Drive',
      description: 'Community blood donation initiative coordinated with the local health chapter. Registered donors undergo medical screening before final schedule confirmation.',
      category: 'Community & Service',
      venue: 'Health Services Pavilion',
      starts_at: offsetFromBase(8, 8, 30),
      ends_at: offsetFromBase(8, 16, 0),
      registration_deadline: offsetFromBase(7, 12, 0),
      capacity: 40,
      fee_amount: 0.00,
      requires_approval: 1,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Advanced Marine Simulator Masterclass',
      description: 'Specialized hardware session on the full-mission bridge and engine room simulator. Limited to two console workstations for certified senior cadets.',
      category: 'Technology & STEM',
      venue: 'Simulator Complex, Bay B',
      starts_at: offsetFromBase(11, 14, 0),
      ends_at: offsetFromBase(11, 18, 0),
      registration_deadline: offsetFromBase(10, 12, 0),
      capacity: 2,
      fee_amount: 150.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Inter-Collegiate Parliamentary Debate Briefing',
      description: 'Technical briefing and tournament bracket draw for debaters representing collegiate academic societies.',
      category: 'Academic',
      venue: 'Audio-Visual Hall 1',
      starts_at: offsetFromBase(3, 13, 0),
      ends_at: offsetFromBase(3, 16, 0),
      registration_deadline: offsetFromToday(-1, 12, 0), // Deadline passed before today, but starts after base
      capacity: 50,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Robotics Prototyping Workshop',
      description: 'Hands-on hardware lab covering microcontrollers, sensor integration, and motor controllers for competitive autonomous robots.',
      category: 'Technology & STEM',
      venue: 'Engineering Workshop 2',
      starts_at: offsetFromToday(0, -2, 0), // Already started relative to today
      ends_at: offsetFromToday(0, 4, 0),
      registration_deadline: offsetFromToday(0, -3, 0),
      capacity: 35,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Charity 5K Fun Run',
      description: 'Community charity fun run along the perimeter circuit. Cancelled due to scheduled road maintenance.',
      category: 'Sports',
      venue: 'Perimeter Circuit',
      starts_at: offsetFromBase(14, 6, 0),
      ends_at: offsetFromBase(14, 10, 0),
      registration_deadline: offsetFromBase(13, 18, 0),
      capacity: 100,
      fee_amount: 100.00,
      requires_approval: 0,
      status: 'cancelled',
    },
    {
      organizer_id: 2,
      title: 'First Semester Freshmen Orientation',
      description: 'General orientation session introducing incoming students to student services, library resources, and departmental faculty.',
      category: 'Community & Service',
      venue: 'Gymnasium',
      starts_at: offsetFromToday(-14, 8, 0), // Ended relative to today
      ends_at: offsetFromToday(-14, 17, 0),
      registration_deadline: offsetFromToday(-15, 18, 0),
      capacity: 500,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Collegiate Leadership Roundtable',
      description: 'Discussion forum for student organization officers on budget management, event planning, and student council governance.',
      category: 'Career & Networking',
      venue: 'Conference Suite',
      starts_at: offsetFromToday(-7, 10, 0), // Ended relative to today
      ends_at: offsetFromToday(-7, 15, 0),
      registration_deadline: offsetFromToday(-8, 17, 0),
      capacity: 30,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Industry Career and Internship Fair',
      description: 'Networking and recruitment exposition connecting technical students and graduating seniors with regional employers and partner firms.',
      category: 'Career & Networking',
      venue: 'Multi-Purpose Activity Complex',
      starts_at: offsetFromBase(16, 9, 0),
      ends_at: offsetFromBase(16, 16, 30),
      registration_deadline: offsetFromBase(15, 18, 0),
      capacity: 300,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Traditional Folk Dance and Musical Recital',
      description: 'Annual cultural presentation featuring student performing arts ensembles in acoustic string arrangements and regional dance numbers.',
      category: 'Arts & Culture',
      venue: 'Recital Hall',
      starts_at: offsetFromBase(18, 19, 0),
      ends_at: offsetFromBase(18, 21, 30),
      registration_deadline: offsetFromBase(18, 12, 0),
      capacity: 120,
      fee_amount: 250.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Inter-Department Table Tennis Tournament',
      description: 'Collegiate singles and doubles table tennis competition for student athletes across academic departments.',
      category: 'Sports',
      venue: 'Indoor Gymnasium Court 2',
      starts_at: offsetFromBase(20, 9, 0),
      ends_at: offsetFromBase(20, 18, 0),
      registration_deadline: offsetFromBase(19, 20, 0),
      capacity: 32,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Defensive Cybersecurity Bootcamp',
      description: 'Intensive network defense, intrusion analysis, and forensic simulation. Prerequisite background in networking protocols recommended.',
      category: 'Technology & STEM',
      venue: 'Cyber Range Lab 3',
      starts_at: offsetFromBase(22, 13, 0),
      ends_at: offsetFromBase(22, 19, 0),
      registration_deadline: offsetFromBase(21, 15, 0),
      capacity: 20,
      fee_amount: 500.00,
      requires_approval: 1,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Mindfulness and Exam Preparation Workshop',
      description: 'Practical cognitive resilience techniques and stress management exercises designed for students preparing for midterm assessments.',
      category: 'Community & Service',
      venue: 'Guidance Seminar Room',
      starts_at: offsetFromBase(24, 14, 0),
      ends_at: offsetFromBase(24, 16, 30),
      registration_deadline: offsetFromBase(23, 23, 59),
      capacity: 45,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Student Photography and Visual Arts Exhibition',
      description: 'Curated gallery displaying student photography documenting campus architecture, civic life, and regional cultural heritage.',
      category: 'Arts & Culture',
      venue: 'Atrium Exhibition Hall',
      starts_at: offsetFromBase(26, 10, 0),
      ends_at: offsetFromBase(28, 17, 0),
      registration_deadline: offsetFromBase(25, 18, 0),
      capacity: 80,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Collegiate Forum on Artificial Intelligence Ethics',
      description: 'Panel forum featuring regional computing faculty, software engineers, and student leaders discussing responsible technology development.',
      category: 'Academic',
      venue: 'Centennial Hall',
      starts_at: offsetFromBase(29, 15, 0),
      ends_at: offsetFromBase(29, 18, 0),
      registration_deadline: offsetFromBase(28, 17, 0),
      capacity: 90,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Intramural Volleyball Tournament Opening',
      description: 'Opening matches of the inter-departmental volleyball league. Spectators must reserve admission passes.',
      category: 'Sports',
      venue: 'Covered Court',
      starts_at: offsetFromBase(31, 17, 0),
      ends_at: offsetFromBase(31, 21, 0),
      registration_deadline: offsetFromBase(30, 18, 0),
      capacity: 150,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Undergraduate Research Grant Writing Workshop',
      description: 'Special mentoring workshop for senior science and engineering students preparing formal proposals for competitive external research grants.',
      category: 'Academic',
      venue: 'Faculty Conference Room',
      starts_at: offsetFromBase(33, 13, 0),
      ends_at: offsetFromBase(33, 16, 30),
      registration_deadline: offsetFromBase(32, 17, 0),
      capacity: 18,
      fee_amount: 0.00,
      requires_approval: 1,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Open-Source Civic Software Sprint',
      description: 'Hands-on sprint building open tools and educational software for student organizations and community initiatives.',
      category: 'Technology & STEM',
      venue: 'Software Incubator',
      starts_at: offsetFromBase(35, 10, 0),
      ends_at: offsetFromBase(35, 18, 0),
      registration_deadline: offsetFromBase(34, 20, 0),
      capacity: 50,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
    {
      organizer_id: 2,
      title: 'Student Drama Guild Ensemble Presentation',
      description: 'Live dramatic theater performance staged and produced entirely by student actors, set designers, and stage crews.',
      category: 'Arts & Culture',
      venue: 'Black Box Studio',
      starts_at: offsetFromBase(37, 19, 30),
      ends_at: offsetFromBase(37, 22, 0),
      registration_deadline: offsetFromBase(37, 14, 0),
      capacity: 75,
      fee_amount: 0.00,
      requires_approval: 0,
      status: 'published',
    },
  ];
}

export function generateSeedRegistrations() {
  return [
    // student01 (user_id: 3)
    { event_id: 1, user_id: 3, status: 'approved', registered_at: offsetFromToday(-2, 10, 0), decided_at: offsetFromToday(-2, 10, 0) },
    { event_id: 3, user_id: 3, status: 'pending', registered_at: offsetFromToday(-1, 8, 30), decided_at: null },
    { event_id: 4, user_id: 3, status: 'approved', registered_at: offsetFromToday(-3, 14, 0), decided_at: offsetFromToday(-3, 14, 0) },
    { event_id: 7, user_id: 3, status: 'approved', registered_at: offsetFromToday(-4, 10, 0), decided_at: offsetFromToday(-4, 10, 0) },
    { event_id: 8, user_id: 3, status: 'approved', registered_at: offsetFromToday(-16, 9, 0), decided_at: offsetFromToday(-16, 9, 0) },
    { event_id: 9, user_id: 3, status: 'approved', registered_at: offsetFromToday(-9, 14, 0), decided_at: offsetFromToday(-9, 14, 0) },
    { event_id: 13, user_id: 3, status: 'pending', registered_at: offsetFromToday(-1, 15, 0), decided_at: null },

    // student02 (user_id: 4)
    { event_id: 1, user_id: 4, status: 'approved', registered_at: offsetFromToday(-2, 11, 30), decided_at: offsetFromToday(-2, 11, 30) },
    { event_id: 3, user_id: 4, status: 'pending', registered_at: offsetFromToday(-1, 9, 15), decided_at: null },
    { event_id: 4, user_id: 4, status: 'approved', registered_at: offsetFromToday(-3, 14, 2), decided_at: offsetFromToday(-3, 14, 2) },
    { event_id: 8, user_id: 4, status: 'approved', registered_at: offsetFromToday(-16, 10, 0), decided_at: offsetFromToday(-16, 10, 0) },

    // student03 (user_id: 5)
    { event_id: 1, user_id: 5, status: 'cancelled', registered_at: offsetFromToday(-3, 9, 15), decided_at: offsetFromToday(-2, 14, 0) },
    { event_id: 3, user_id: 5, status: 'approved', registered_at: offsetFromToday(-2, 14, 0), decided_at: offsetFromToday(-1, 10, 0) },
    { event_id: 7, user_id: 5, status: 'approved', registered_at: offsetFromToday(-4, 11, 0), decided_at: offsetFromToday(-4, 11, 0) },

    // student04 (user_id: 6)
    { event_id: 3, user_id: 6, status: 'rejected', registered_at: offsetFromToday(-2, 15, 30), decided_at: offsetFromToday(-1, 10, 5) },
  ];
}

export function generateSeedNotifications() {
  return [
    {
      user_id: 3,
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive has been submitted and is awaiting organizer approval.',
      event_id: 3,
      is_read: 0,
      created_at: offsetFromToday(-1, 8, 30),
    },
    {
      user_id: 3,
      type: 'EVENT_UPDATE',
      message: 'Notice: Charity 5K Fun Run has been cancelled by the organizer.',
      event_id: 7,
      is_read: 0,
      created_at: offsetFromToday(-1, 14, 0),
    },
    {
      user_id: 3,
      type: 'REGISTRATION_STATUS',
      message: 'Your admission pass for Annual Research Colloquium is confirmed.',
      event_id: 1,
      is_read: 0,
      created_at: offsetFromToday(-2, 10, 0),
    },
    {
      user_id: 5,
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive has been approved.',
      event_id: 3,
      is_read: 0,
      created_at: offsetFromToday(-1, 10, 0),
    },
    {
      user_id: 6,
      type: 'REGISTRATION_STATUS',
      message: 'Your registration for Voluntary Blood Donation Drive was declined by the organizer.',
      event_id: 3,
      is_read: 1,
      created_at: offsetFromToday(-1, 10, 5),
    },
  ];
}
