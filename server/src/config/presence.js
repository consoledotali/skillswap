export const connectedUsers = new Map();

export function isUserOnline(userId) {
  if (!userId) return false;
  return connectedUsers.has(String(userId));
}

export function getConnectedUserIds() {
  return [...connectedUsers.keys()];
}
