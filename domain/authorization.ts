export type UserRole = "admin" | "operator";

export function canConfigureParking(role: UserRole): boolean {
  return role === "admin";
}

export function canManageRates(role: UserRole): boolean {
  return role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

export function canOperateSessions(role: UserRole): boolean {
  return role === "admin" || role === "operator";
}

export function canViewAudit(role: UserRole): boolean {
  return role === "admin";
}
