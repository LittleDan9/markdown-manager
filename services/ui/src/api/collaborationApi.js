import { Api } from './api';

class CollaborationApi extends Api {
  /**
   * List collaborators for a document.
   */
  async getCollaborators(documentId) {
    const res = await this.apiCall(`/documents/${documentId}/collaborators`);
    return res.data;
  }

  /**
   * Invite a user to collaborate on a document.
   * @param {number} documentId
   * @param {string} email
   * @param {string} role - 'editor' or 'viewer'
   */
  async inviteCollaborator(documentId, email, role = 'viewer') {
    const res = await this.apiCall(`/documents/${documentId}/collaborators`, 'POST', { email, role });
    return res.data;
  }

  /**
   * Change a collaborator's role.
   */
  async updateCollaboratorRole(documentId, userId, role) {
    const res = await this.apiCall(`/documents/${documentId}/collaborators/${userId}`, 'PATCH', { role });
    return res.data;
  }

  /**
   * Remove a collaborator.
   */
  async removeCollaborator(documentId, userId) {
    await this.apiCall(`/documents/${documentId}/collaborators/${userId}`, 'DELETE');
  }

  /**
   * List documents shared with the current user.
   */
  async getSharedWithMe() {
    const res = await this.apiCall('/documents/shared-with-me');
    return res.data;
  }
}

export default new CollaborationApi();
