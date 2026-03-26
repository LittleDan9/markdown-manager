import { Api } from './api';

class CommentsApi extends Api {
  constructor() {
    super();
  }

  async list(documentId, { lineNumber, status } = {}) {
    const params = new URLSearchParams();
    if (lineNumber != null) params.set('line_number', String(lineNumber));
    if (status) params.set('status', status);
    const qs = params.toString();
    const response = await this.apiCall(`/documents/${documentId}/comments${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async create(documentId, { content, lineNumber, parentId }) {
    const body = { content };
    if (lineNumber != null) body.line_number = lineNumber;
    if (parentId != null) body.parent_id = parentId;
    const response = await this.apiCall(`/documents/${documentId}/comments`, 'POST', body);
    return response.data;
  }

  async update(commentId, { content, status }) {
    const body = {};
    if (content !== undefined) body.content = content;
    if (status !== undefined) body.status = status;
    const response = await this.apiCall(`/comments/${commentId}`, 'PATCH', body);
    return response.data;
  }

  async remove(commentId) {
    await this.apiCall(`/comments/${commentId}`, 'DELETE');
  }
}

export default new CommentsApi();
