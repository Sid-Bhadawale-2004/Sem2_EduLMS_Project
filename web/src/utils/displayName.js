/**
 * Get display name from user object
 * Handles student, faculty, and fallback cases
 */
export function getDisplayName(user) {
  if (!user) return 'User';
  
  // Try student name first
  if (user.student?.name) {
    return user.student.name;
  }
  
  // Try faculty name
  if (user.faculty?.name) {
    return user.faculty.name;
  }
  
  // Fallback to email username (before @)
  if (user.email) {
    const emailName = user.email.split('@')[0];
    // Only use if it's not just a number (like roll number)
    if (!/^\d+$/.test(emailName)) {
      return emailName;
    }
  }
  
  return 'User';
}

/**
 * Get display identifier (name or roll number)
 * For students, try to show name; for faculty show employee ID or name
 */
export function getDisplayIdentifier(user) {
  if (!user) return '';
  
  if (user.student) {
    // Prefer name over roll number
    return user.student.name || user.student.rollNumber || '';
  }
  
  if (user.faculty) {
    return user.faculty.name || user.faculty.employeeId || '';
  }
  
  return user.email || '';
}
