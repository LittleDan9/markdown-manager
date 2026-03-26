import { Api } from './api';

class NotificationsApi extends Api {
  constructor() {
    super();
  }

  async list({ unreadOnly = false, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (unreadOnly) params.set('unread_only', 'true');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const response = await this.apiCall(`/notifications?${params}`);
    return response.data;
  }

  async getUnreadCount() {
    const response = await this.apiCall('/notifications/unread-count');
    return response.data;
  }

  async markRead(notificationId) {
    const response = await this.apiCall(`/notifications/${notificationId}/read`, 'PATCH');
    return response.data;
  }

  async markAllRead() {
    const response = await this.apiCall('/notifications/read-all', 'PATCH');
    return response.data;
  }

  async deleteNotification(notificationId) {
    const response = await this.apiCall(`/notifications/${notificationId}`, 'DELETE');
    return response.data;
  }

  async clearAll() {
    const response = await this.apiCall('/notifications', 'DELETE');
    return response.data;
  }
}

export default new NotificationsApi();
