export function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    matricNumber: u.matricNumber ?? null,
    department: u.department ?? null,
    faculty: u.faculty ?? null,
    program: u.program ?? null,
    level: u.level ?? null,
    verified: u.verified,
    mustChangePassword: u.mustChangePassword,
    rewardPoints: u.rewardPoints,
    promptsPerDay: u.promptsPerDay,
    promptsPerWeek: u.promptsPerWeek,
    dailyUsed: u.dailyUsed,
    weeklyUsed: u.weeklyUsed,
    dailyResetAt: u.dailyResetAt,
    weeklyResetAt: u.weeklyResetAt,
  };
}
