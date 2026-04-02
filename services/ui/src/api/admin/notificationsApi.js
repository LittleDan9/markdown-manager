import { Api } from '../api.js';

export class AdminNotificationsApi extends Api {
  constructor() {
    super();
  }

  async sendNotification({ title, message, category = 'info', detail = null, userIds = null }) {
    const body = { title, message, category };
    if (detail) body.detail = detail;
    if (userIds && userIds.length > 0) body.user_ids = userIds;
    const response = await this.apiCall('/admin/notifications/send', 'POST', body);
    return response.data;
  }
}

export default new AdminNotificationsApi();
