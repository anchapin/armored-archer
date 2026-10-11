// Notification types
export type NotificationType = 'daily_reward' | 'event' | 'pvp_challenge' | 'promotion' | 'custom';

// Notification templates for different types
const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; body: string }> = {
  daily_reward: {
    title: '🎁 Daily Rewards Await!',
    body: 'Your daily rewards are ready to claim. Come back and collect your gems!',
  },
  event: {
    title: '🎉 New Event Available!',
    body: 'A new event has started. Check it out and earn exclusive rewards!',
  },
  pvp_challenge: {
    title: '⚔️ PvP Challenge Ready!',
    body: 'Your opponents are waiting. Prove your skills in the arena!',
  },
  promotion: {
    title: '🔥 Special Offer!',
    body: 'Limited time offer! Get bonus gems with your purchase.',
  },
  custom: {
    title: '📢 Announcement',
    body: 'You have a new message from Armored Archer.',
  },
};

export function getNotificationTemplate(type: NotificationType): { title: string; body: string } {
  return NOTIFICATION_TEMPLATES[type] || NOTIFICATION_TEMPLATES.custom;
}
